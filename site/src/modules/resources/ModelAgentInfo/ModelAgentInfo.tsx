import type { Interpolation, Theme } from "@emotion/react";
import { useTheme } from "@emotion/react";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Collapse from "@mui/material/Collapse";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Link from "@mui/material/Link";
import Chip from "@mui/material/Chip";
import type { WorkspaceAgent } from "api/typesGenerated";
import { Stack } from "components/Stack/Stack";
import type { FC } from "react";
import { useState } from "react";
import { CreateAgentButton, type CreateAgentData } from "./CreateAgentDialog";

export interface ModelAgentInfoProps {
  agent: WorkspaceAgent;
  onCreateAgent?: (data: CreateAgentData) => void;
  isCreating?: boolean;
  creationError?: unknown;
}

type AgentStatus = "thinking" | "waiting" | "stopped" | "error";

interface AgentData {
  id: string;
  workspaceLink: string;
  taskName: string;
  modelName: string;
  status: AgentStatus;
  agentLink: string;
  cost: string;
  costLimit: string;
}

/**
 * The ModelAgentInfo component displays information about AI agents 
 * running within workspaces. This component is shown below the workspace 
 * build timeline when AI agents are detected.
 * 
 * Currently configured to always display mock data regardless of agent configuration.
 */
export const ModelAgentInfo: FC<ModelAgentInfoProps> = ({ 
  agent, 
  onCreateAgent,
  isCreating = false,
  creationError
}) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Always show model mock data regardless of agent configuration
  const isModelAgent = true;

  // Mock agent data showing two different model agents
  const mockAgents: AgentData[] = [
    {
      id: "agent-123",
      workspaceLink: "/workspaces/1",
      taskName: "Code analysis of billing service",
      modelName: "Claude 3.5 Sonnet",
      status: "thinking",
      agentLink: "https://console.anthropic.com/claude/chat/abc123",
      cost: "$4.50",
      costLimit: "$10.00"
    },
    {
      id: "agent-456",
      workspaceLink: "/workspaces/2",
      taskName: "Generate unit tests for authentication module",
      modelName: "GPT-4o",
      status: "waiting",
      agentLink: "https://github.com/anthropics/claude-code/issues/789",
      cost: "$3.25",
      costLimit: "$15.00"
    }
  ];

  // Helper function to get color for status chip
  const getStatusColor = (status: AgentStatus): string => {
    switch (status) {
      case "thinking":
        return theme.palette.primary.main;
      case "waiting":
        return theme.palette.warning.main;
      case "stopped":
        return theme.palette.text.secondary;
      case "error":
        return theme.palette.error.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  return (
    <div css={styles.container}>
      <Button
        variant="text"
        css={styles.collapseTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div css={{ display: "flex", alignItems: "center" }}>
          {isOpen ? (
            <KeyboardArrowUp css={{ fontSize: 16, marginRight: 16 }} />
          ) : (
            <KeyboardArrowDown css={{ fontSize: 16, marginRight: 16 }} />
          )}
          <span>AI Agents</span>
          <Tooltip title="This workspace contains AI agents">
            <InfoOutlined 
              css={{ 
                fontSize: 16, 
                marginLeft: 8, 
                color: theme.palette.primary.main 
              }} 
            />
          </Tooltip>
        </div>
        {onCreateAgent && (
          <CreateAgentButton
            onCreateAgent={onCreateAgent}
            isCreating={isCreating}
            creationError={creationError}
          />
        )}
      </Button>

      <Collapse in={isOpen}>
        <div css={styles.collapseBody}>
          <Stack direction="column" spacing={2} css={{ padding: 16 }}>
            <div css={styles.sectionTitle}>Connected AI Agents</div>
            {mockAgents.length > 0 ? (
              <div css={styles.agentGrid}>
                {mockAgents.map((agentData) => (
                  <div key={agentData.id} css={styles.agentItem}>
                    <div css={styles.agentHeader}>
                      <Link 
                        href={agentData.agentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        css={styles.agentName}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {agentData.taskName}
                      </Link>
                      <Chip
                        label={agentData.status}
                        size="small"
                        css={{
                          backgroundColor: getStatusColor(agentData.status) + "20",
                          color: getStatusColor(agentData.status),
                          fontWeight: 500,
                          fontSize: 12,
                        }}
                      />
                    </div>
                    
                    <div css={styles.agentDetails}>
                      <div css={styles.agentDetailItem}>
                        <div css={styles.detailLabel}>Model</div>
                        <div css={styles.detailValue}>{agentData.modelName}</div>
                      </div>
                      
                      <div css={styles.agentDetailItem}>
                        <div css={styles.detailLabel}>Cost / Limit</div>
                        <div css={styles.detailValue}>{agentData.cost} / {agentData.costLimit}</div>
                      </div>
                      
                      <div css={styles.agentDetailItem}>
                        <div css={styles.detailLabel}>Workspace</div>
                        <Link 
                          href={agentData.workspaceLink} 
                          css={styles.workspaceLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View workspace <OpenInNewIcon css={{ fontSize: 14, marginLeft: 4 }} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div css={styles.emptyState}>No model agents connected</div>
            )}
          </Stack>
        </div>
      </Collapse>
    </div>
  );
};

const styles = {
  container: (theme) => ({
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    margin: "24px 0",
  }),
  collapseTrigger: {
    background: "none",
    border: 0,
    padding: 16,
    color: "inherit",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 57,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  collapseBody: (theme) => ({
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
  }),
  sectionTitle: (theme) => ({
    fontWeight: 600,
    fontSize: 14,
    color: theme.palette.text.primary,
  }),
  agentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 16,
  },
  agentItem: (theme) => ({
    padding: 16,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  agentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  agentName: (theme) => ({
    fontWeight: 600,
    fontSize: 14,
    color: theme.palette.text.primary,
    flexGrow: 1,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
      color: theme.palette.primary.main,
    },
  }),
  agentDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  agentDetailItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  detailLabel: (theme) => ({
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontWeight: 500,
  }),
  detailValue: {
    fontSize: 14,
  },
  workspaceLink: (theme) => ({
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    color: theme.palette.primary.main,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  }),
  emptyState: (theme) => ({
    fontSize: 14,
    color: theme.palette.text.secondary,
    fontStyle: "italic",
    padding: 16,
    textAlign: "center",
  }),
} satisfies Record<string, Interpolation<Theme>>;