package agentapi

import (
	"context"

	"github.com/coder/coder/v2/agent/proto"
	"github.com/coder/coder/v2/coderd/database"
	"github.com/coder/coder/v2/coderd/database/dbauthz"
	"github.com/coder/coder/v2/coderd/database/dbtime"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
	"golang.org/x/xerrors"
)

type ChildAgentAPI struct {
	AgentID uuid.UUID

	Database database.Store
}

func (a *ChildAgentAPI) CreateChildAgent(ctx context.Context, req *proto.CreateChildAgentRequest) (*proto.CreateChildAgentResponse, error) {
	agent, err := a.Database.GetWorkspaceAgentByID(ctx, a.AgentID)
	if err != nil {
		return nil, xerrors.Errorf("get agent: %w", err)
	}

	childAgentAuthToken := uuid.New()
	childAgent, err := a.Database.InsertWorkspaceAgent(dbauthz.AsSystemRestricted(ctx), database.InsertWorkspaceAgentParams{
		ID:                       uuid.New(),
		CreatedAt:                dbtime.Now(),
		UpdatedAt:                dbtime.Now(),
		ResourceID:               agent.ResourceID,
		Name:                     req.Name,
		AuthToken:                childAgentAuthToken,
		AuthInstanceID:           agent.AuthInstanceID,
		Architecture:             agent.Architecture,
		EnvironmentVariables:     pqtype.NullRawMessage{},
		Directory:                req.Directory,
		OperatingSystem:          agent.OperatingSystem,
		ConnectionTimeoutSeconds: agent.ConnectionTimeoutSeconds,
		TroubleshootingURL:       agent.TroubleshootingURL,
		MOTDFile:                 agent.MOTDFile,
		DisplayApps:              []database.DisplayApp{},
		InstanceMetadata:         pqtype.NullRawMessage{},
		ResourceMetadata:         pqtype.NullRawMessage{},
		DisplayOrder:             agent.DisplayOrder,
	})
	if err != nil {
		return nil, xerrors.Errorf("insert agent: %w", err)
	}

	return &proto.CreateChildAgentResponse{
		Id:        childAgent.ID[:],
		AuthToken: childAgent.AuthToken[:],
	}, nil
}

func (a *ChildAgentAPI) DeleteChildAgent(ctx context.Context, req *proto.DeleteChildAgentRequest) (*proto.DeleteChildAgentResponse, error) {
	agentID, err := uuid.ParseBytes(req.Id)
	if err != nil {
		return nil, xerrors.Errorf("parse agent ID: %w", err)
	}

	if err := a.Database.DeleteWorkspaceAgent(dbauthz.AsSystemRestricted(ctx), agentID); err != nil {
		return nil, xerrors.Errorf("delete agent: %w", err)
	}

	return &proto.DeleteChildAgentResponse{}, nil
}

func (a *ChildAgentAPI) ListChildAgents(ctx context.Context, req *proto.ListChildAgentsRequest) (*proto.ListChildAgentsResponse, error) {
	var response proto.ListChildAgentsResponse

	children, err := a.Database.GetWorkspaceAgentsByParentID(ctx, uuid.NullUUID{Valid: true, UUID: a.AgentID})
	if err != nil {
		return nil, xerrors.Errorf("get agents by parent ID: %w", err)
	}

	response.Agents = make([]*proto.ListChildAgentsResponse_Agent, len(children))
	for i, child := range children {
		response.Agents[i] = &proto.ListChildAgentsResponse_Agent{
			Name: child.Name,
			Id:   child.ID[:],
		}
	}

	return &response, nil
}
