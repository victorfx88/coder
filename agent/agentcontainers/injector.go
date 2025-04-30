package agentcontainers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime"
	"time"

	"cdr.dev/slog"
	"github.com/coder/coder/v2/agent/agentexec"
	"github.com/coder/coder/v2/agent/proto"
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

	// TODO(DanielleMaywood):
	// If the docker daemon hasn't started yet, this may fail.
	// We ideally want to ensure we handle that error vs other
	// errors differently.
	if err := i.populateChildren(ctx); err != nil {
		i.logger.Error(ctx, "populate children", slog.Error(err))
	}

	accessURL := os.Getenv("CODER_AGENT_URL")
	resp, err := http.Get(fmt.Sprintf("%sbin/coder-linux-%s", accessURL, runtime.GOARCH))
	if err != nil {
		i.logger.Error(ctx, "download coder")
		return err
	}
	defer resp.Body.Close()

	file, err := afero.TempFile(i.fs, "/tmp", "coder")
	if err != nil {
		i.logger.Error(ctx, "create agent file", slog.Error(err))
		return err
	}
	defer file.Close()

	if _, err = io.Copy(file, resp.Body); err != nil {
		i.logger.Error(ctx, "copy agent file", slog.Error(err))
		return err
	}

	i.clock.TickerFunc(ctx, 10*time.Second, func() error {
		if err := i.runInjectionProc(ctx, file.Name()); err != nil {
			i.logger.Error(ctx, "run injection proc", slog.Error(err))
		}

		// TODO(DanielleMaywood):
		// Uncomment this block. We need to ensure injection works properly
		// first before attempting cleanup.

		// if err := i.runCleanupProc(ctx); err != nil {
		// 	i.logger.Error(ctx, "run cleanup proc", slog.Error(err))
		// }

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

		delete(i.children, containerID)
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

		i.logger.Info(ctx, "copying coder")
		stdout, stderr, err := run(ctx, i.execer,
			"docker", "container", "cp", bootstrapScript,
			fmt.Sprintf("%s:/tmp/coder-agent", container.ID),
		)
		if stdout != "" {
			i.logger.Info(ctx, stdout)
		}
		if stderr != "" {
			i.logger.Error(ctx, stderr)
		}
		if err != nil {
			return xerrors.Errorf("copy coder executable: %w", err)
		}

		i.logger.Info(ctx, "marking coder as executable")
		stdout, stderr, err = run(ctx, i.execer, "docker", "container", "exec", container.ID, "chmod", "+x", "/tmp/coder")
		if stdout != "" {
			i.logger.Info(ctx, stdout)
		}
		if stderr != "" {
			i.logger.Error(ctx, stderr)
		}
		if err != nil {
			return xerrors.Errorf("make coder executable: %w", err)
		}

		i.logger.Info(ctx, "running coder")
		stdout, stderr, err = run(ctx, i.execer, "docker", "container", "exec",
			"--env", fmt.Sprintf("CODER_AGENT_URL=%s", accessURL),
			"--env", fmt.Sprintf("CODER_AGENT_AUTH=%s", authType),
			"--env", fmt.Sprintf("CODER_AGENT_TOKEN=%s", childAuthToken.String()),
			container.ID,
			"/tmp/coder", "agent",
		)
		if stdout != "" {
			i.logger.Info(ctx, stdout)
		}
		if stderr != "" {
			i.logger.Error(ctx, stderr)
		}
		if err != nil {
			return xerrors.Errorf("running coder: %w", err)
		}
	}

	return nil
}
