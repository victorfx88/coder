package agentcontainers

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"cdr.dev/slog"
	"github.com/coder/coder/v2/agent/agentexec"
	"github.com/coder/coder/v2/agent/proto"
	"github.com/coder/coder/v2/provisionersdk"
	"github.com/coder/quartz"
	"github.com/google/uuid"
	"github.com/spf13/afero"
	"golang.org/x/xerrors"
)

type Injector struct {
	fs     afero.Fs
	cl     Lister
	logger slog.Logger
	clock  quartz.Clock
	api    proto.DRPCAgentClient25
	execer agentexec.Execer

	children map[string]uuid.UUID
}

func NewInjector(
	fs afero.Fs,
	logger slog.Logger,
	clock quartz.Clock,
	cl Lister,
	api proto.DRPCAgentClient25,
	execer agentexec.Execer,
) *Injector {
	return &Injector{
		fs:       fs,
		cl:       cl,
		api:      api,
		logger:   logger,
		clock:    clock,
		execer:   execer,
		children: make(map[string]uuid.UUID),
	}
}

func (i *Injector) populateChildren(ctx context.Context) error {
	children, err := i.api.ListChildAgents(ctx, &proto.ListChildAgentsRequest{})
	if err != nil {
		return xerrors.Errorf("list child agents: %w", err)
	}

	listing, err := i.cl.List(ctx)
	if err != nil {
		return xerrors.Errorf("list containers: %w", err)
	}

	containerMap := make(map[string]string)
	for _, container := range listing.Containers {
		containerMap[container.FriendlyName] = container.ID
	}

	for _, child := range children.Agents {
		containerID, ok := containerMap[child.Name]
		if !ok {
			continue
		}

		agentID, err := uuid.ParseBytes(child.Id)
		if err != nil {
			return xerrors.Errorf("parse child ID: %w", err)
		}

		i.logger.Debug(ctx, "found child", slog.F("container_id", containerID), slog.F("agent_id", agentID))
		i.children[containerID] = agentID
	}

	return nil
}

func (i *Injector) Start(ctx context.Context) error {
	i.logger.Info(ctx, "starting injector routine")

	if err := i.populateChildren(ctx); err != nil {
		i.logger.Error(ctx, "populate children", slog.Error(err))
		return err
	}

	agentScripts := provisionersdk.AgentScriptEnv()
	agentScript := agentScripts[fmt.Sprintf("CODER_AGENT_SCRIPT_%s_%s", runtime.GOOS, runtime.GOARCH)]

	file, err := afero.TempFile(i.fs, "/tmp", "agent-script")
	if err != nil {
		i.logger.Error(ctx, "create agent-script file", slog.Error(err))
		return err
	}
	if _, err := file.Write([]byte(agentScript)); err != nil {
		i.logger.Error(ctx, "write agent-script content", slog.Error(err))
		return err
	}
	if err := file.Close(); err != nil {
		i.logger.Error(ctx, "close agent-script file", slog.Error(err))
		return err
	}

	i.clock.TickerFunc(ctx, 10*time.Second, func() error {
		if err := i.runInjectionProc(ctx, file.Name()); err != nil {
			i.logger.Error(ctx, "run injection proc", slog.Error(err))
		}

		if err := i.runCleanupProc(ctx); err != nil {
			i.logger.Error(ctx, "run cleanup proc", slog.Error(err))
		}

		return nil
	}, "injector")

	return nil
}

func (i *Injector) runCleanupProc(ctx context.Context) error {
	listing, err := i.cl.List(ctx)
	if err != nil {
		return xerrors.Errorf("list containers: %w", err)
	}

	containerMap := make(map[string]struct{})
	for _, container := range listing.Containers {
		containerMap[container.ID] = struct{}{}
	}

	for containerID, agentID := range i.children {
		if _, ok := containerMap[containerID]; !ok {
			continue
		}

		i.logger.Info(ctx, "deleting child agent", slog.F("child_id", agentID))

		if _, err := i.api.DeleteChildAgent(ctx, &proto.DeleteChildAgentRequest{
			Id: agentID[:],
		}); err != nil {
			return xerrors.Errorf("delete child agent: %w", err)
		}
	}

	return nil
}

func (i *Injector) runInjectionProc(ctx context.Context, bootstrapScript string) error {
	listing, err := i.cl.List(ctx)
	if err != nil {
		return xerrors.Errorf("list containers: %w", err)
	}

	for _, container := range listing.Containers {
		workspaceFolder, exists := container.Labels[DevcontainerLocalFolderLabel]
		if !exists || workspaceFolder == "" {
			continue
		}

		// Child has already been injected with the agent, we can ignore it.
		if _, childInjected := i.children[container.ID]; childInjected {
			continue
		}

		resp, err := i.api.CreateChildAgent(ctx, &proto.CreateChildAgentRequest{
			Name:      container.FriendlyName,
			Directory: workspaceFolder,
		})
		if err != nil {
			return xerrors.Errorf("create child agent: %w", err)
		}

		childAgentID, err := uuid.FromBytes(resp.Id)
		if err != nil {
			return xerrors.Errorf("parse agent id: %w", err)
		}

		childAuthToken, err := uuid.FromBytes(resp.AuthToken)
		if err != nil {
			return xerrors.Errorf("parse auth token: %w", err)
		}

		i.children[container.ID] = childAgentID

		accessURL := os.Getenv("CODER_AGENT_URL")
		authType := "token"

		stdout, stderr, err := run(ctx, i.execer,
			"docker", "container", "cp", bootstrapScript,
			fmt.Sprintf("%s:/tmp/bootstrap.sh", container.ID),
		)
		i.logger.Info(ctx, stdout)
		i.logger.Error(ctx, stderr)
		if err != nil {
			return xerrors.Errorf("copy bootstrap script: %w", err)
		}

		stdout, stderr, err = run(ctx, i.execer, "docker", "container", "exec", container.ID, "chmod", "+x", "/tmp/bootstrap.sh")
		i.logger.Info(ctx, stdout)
		i.logger.Error(ctx, stderr)
		if err != nil {
			return xerrors.Errorf("make bootstrap script executable: %w", err)
		}

		cmd := i.execer.CommandContext(ctx, "docker", "container", "exec",
			"--detach",
			"--env", fmt.Sprintf("ACCESS_URL=%s", accessURL),
			"--env", fmt.Sprintf("AUTH_TYPE=%s", authType),
			"--env", fmt.Sprintf("CODER_AGENT_TOKEN=%s", childAuthToken.String()),
			container.ID,
			"bash", "-c", "/tmp/bootstrap.sh",
		)

		var stdoutBuf, stderrBuf strings.Builder

		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf

		if err := cmd.Start(); err != nil {
			return xerrors.Errorf("start command: %w", err)
		}

		go func() {
			for {
				i.logger.Info(ctx, stdoutBuf.String())
				i.logger.Error(ctx, stderrBuf.String())

				time.Sleep(5 * time.Second)
			}
		}()

		go func() {
			if err := cmd.Wait(); err != nil {
				i.logger.Error(ctx, "running command", slog.Error(err))
			}
		}()
	}

	return nil
}
