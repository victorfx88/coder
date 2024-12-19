package devcmd

import (
	"context"
	"net"
	"net/url"
	"os"
	"strconv"
	"time"

	"golang.org/x/exp/slices"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"

	"cdr.dev/slog"
	"github.com/coder/serpent"
)

var (
	configSetupGroup = serpent.Group{
		Name: "Coder Setup",
		YAML: "coder-setup",
		Description: "Any configuration related to setting up the coder dev server " +
			"that do not pass into Coder flags.",
	}
)

func Root() *serpent.Command {
	cmd := &serpent.Command{
		Use: "devserver",
		Children: []*serpent.Command{
			Server(),
		},
	}

	var verbose bool
	cmd.Walk(func(cmd *serpent.Command) {
		cmd.Options = append(cmd.Options, serpent.Option{
			Name:          "verbose",
			Description:   "Enables debug logging.",
			Flag:          "verbose",
			FlagShorthand: "v",
			Value:         serpent.BoolOf(&verbose),
		})
	})

	return cmd
}

func Server() *serpent.Command {
	var (
		clientAccessURL url.URL
		userPassword    string
		dockerPostgres  bool
		logger          slog.Logger
	)
	cmd := &serpent.Command{
		Use:        "server [devserver args + flags] -- [coderd args + flags]",
		Long:       "",
		Middleware: CLILogger(&logger),
		Options: serpent.OptionSet{
			{
				Name:        "client access url",
				Description: "URL for the client to connect to the coder instance.",
				Flag:        "client-access-url",
				Default:     "http://127.0.0.1:3000",
				Value:       serpent.URLOf(&clientAccessURL),
			},
			{
				Name:        "new user passwords",
				Description: "Passwords for the new users created by the dev server.",
				Group:       &configSetupGroup,
				Value:       serpent.StringOf(&userPassword),
				Flag:        "new-user-password",
				Default:     "SomeSecurePassword!",
			},
			{
				Name:        "docker postgres",
				Description: "Use postgres running in local docker via 'test-postgres-docker'.",
				Group:       &configSetupGroup,
				Value:       serpent.BoolOf(&dockerPostgres),
				Flag:        "docker-postgres",
			},
		},
		Handler: func(i *serpent.Invocation) error {
			ctx := i.Context()

			// Run all preflight checks
			if !preflightCheck(ctx, logger, map[string]func(ctx context.Context) error{
				"ports available": func(ctx context.Context) error {
					return portsAvailable(ctx, 8080, 3000)
				},
				"dependenices": dependencies,
				"project root": func(ctx context.Context) error {
					_, err := ProjectRoot(ctx)
					return err
				},
			}) {
				return xerrors.New("preflight checks failed, fix the issues above and try again")
			}

			var extraArgs []string
			if dockerPostgres {
				extraArgs = append(extraArgs, "--postgres-url", `postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable`)
			}

			var group *errgroup.Group
			group, ctx = errgroup.WithContext(ctx)
			err := CoderServer(ctx, logger, i, group, append(coderdArgs(i), extraArgs...)...)
			if err != nil {
				return xerrors.Errorf("run coder server: %w", err)
			}

			err = group.Wait()
			if err != nil {
				return xerrors.Errorf("errorgroup: %w", err)
			}
			<-ctx.Done()

			return nil
		},
	}

	return cmd
}

func preflightCheck(ctx context.Context, logger slog.Logger, checks map[string]func(ctx context.Context) error) bool {
	ok := true
	for name, f := range checks {
		err := f(ctx)
		if err != nil {
			logger.Error(ctx, "preflight check failed", slog.F("name", name), slog.Error(err))
			ok = false
		}
	}
	return ok
}

func portsAvailable(ctx context.Context, ports ...int) error {
	d := net.Dialer{}

	for _, port := range ports {
		ctx, cancel := context.WithTimeout(ctx, time.Millisecond*250)
		defer cancel()

		conn, err := d.DialContext(ctx, "tcp", "localhost:"+strconv.Itoa(port))
		if err == nil {
			_ = conn.Close()
			return xerrors.Errorf("something is listening on port %d. Kill it and re-run this script.", port)
		}
	}
	return nil
}

func dependencies(ctx context.Context) error {
	deps := [][]string{
		{"curl", "--version"},
		{"git", "--version"},
		{"go", "version"},
		{"make", "--version"},
		{"pnpm", "--version"},
	}
	for _, dep := range deps {
		err := ExecutableCheck(ctx, dep[0], dep[1:]...)
		if err != nil {
			return err
		}
	}
	return nil
}

func coderdArgs(inv *serpent.Invocation) []string {
	i := slices.Index(os.Args, "--")
	if i == -1 || len(os.Args) <= i+1 {
		return []string{}
	}

	next := os.Args[i+1]
	return inv.Args[slices.Index(inv.Args, next):]
}
