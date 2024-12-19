package devcmd

import (
	"context"
	"io"
	"os/exec"
	"slices"
	"strings"

	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"

	"cdr.dev/slog"
	"github.com/coder/serpent"
)

type PrefixWriter struct {
	Prefix string
	io.Writer
}

func (p PrefixWriter) Write(b []byte) (int, error) {
	if len(p.Prefix) == 0 {
		return p.Writer.Write(b)
	}
	return p.Writer.Write(append([]byte("["+p.Prefix+"] "), b...))
}

func ExecutableCheck(ctx context.Context, execName string, args ...string) error {
	cmd := exec.CommandContext(ctx, execName, args...)
	err := cmd.Run()
	if err != nil {
		return xerrors.Errorf("execute %s: %w", execName, err)
	}

	if !cmd.ProcessState.Success() {
		return xerrors.Errorf("execute %s: exit code %d", execName, cmd.ProcessState.ExitCode())
	}
	return nil
}

func ProjectRoot(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "--show-toplevel")
	out, err := cmd.Output()
	if err != nil {
		return "", xerrors.Errorf("project root: %w", err)
	}
	projectRoot := string(out)
	return strings.TrimSpace(projectRoot), nil
}

func CoderServer(ctx context.Context, logger slog.Logger, i *serpent.Invocation, group *errgroup.Group, args ...string) error {
	root, err := ProjectRoot(ctx)
	if err != nil {
		return err
	}

	coderArgs := []string{
		"server",
	}

	// If the passed in arguments has the flag already, don't override it
	args = append(coderArgs, args...)
	args = defaultArgument(args, "--access-url", "http://127.0.0.1:3000")
	args = defaultArgument(args, "--http-address", "0.0.0.0:3000")
	args = defaultArgument(args, "--dangerous-allow-cors-requests", "")
	args = defaultArgument(args, "--enable-terraform-debug-mode", "")
	args = defaultArgument(args, "--swagger-enable", "")

	cmd := exec.CommandContext(ctx, "coder",
		args...,
	)
	cmd.Dir = root
	cmd.Stdout = i.Stdout // PrefixWriter{Prefix: "API", Writer: i.Stdout}
	cmd.Stderr = i.Stderr // PrefixWriter{Prefix: "API", Writer: i.Stderr}
	cmd.Stdin = i.Stdin

	logger.Info(ctx, "starting coderd", slog.F("cmd", cmd.String()))
	if err := cmd.Start(); err != nil {
		return xerrors.Errorf("start coder server: %w", err)
	}

	group.Go(cmd.Wait)
	return nil
}

func defaultArgument(args []string, arg string, value string) []string {
	if !slices.ContainsFunc(args, func(passedIn string) bool {
		return strings.Contains(passedIn, arg)
	}) {
		if value != "" {
			return append(args, arg, value)
		}
		return append(args, arg)
	}
	return args
}
