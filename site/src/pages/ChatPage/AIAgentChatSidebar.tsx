import type { FC } from "react";
import { useState } from "react";
import { useTheme } from "@emotion/react";
import { Loader } from "../../components/Loader/Loader";
import { useAIAgentChats } from "../../hooks/useAIAgentChats";
import type { AIAgent } from "api/typesGenerated";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import SmartToyIcon from "@mui/icons-material/SmartToy";

export interface AIAgentChatSidebarProps {
	selectedAgent?: AIAgent;
	onAgentSelect?: (agent: AIAgent) => void;
}

export const AIAgentChatSidebar: FC<AIAgentChatSidebarProps> = ({
	selectedAgent,
	onAgentSelect,
}) => {
	const theme = useTheme();
	const { data, isLoading, error } = useAIAgentChats();

	const handleAgentSelect = (agent: AIAgent) => {
		if (onAgentSelect) {
			onAgentSelect(agent);
		}
	};

	if (isLoading) {
		return <Loader />;
	}

	if (error) {
		return (
			<div
				css={{
					padding: theme.spacing(2),
					color: theme.palette.error.main,
				}}
			>
				Failed to load AI agents
			</div>
		);
	}

	if (!data?.agents || data.agents.length === 0) {
		return (
			<div
				css={{
					padding: theme.spacing(2),
					flexGrow: 1,
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					color: theme.palette.text.secondary,
				}}
			>
				<SmartToyIcon
					fontSize="large"
					color="primary"
					css={{ marginBottom: theme.spacing(1) }}
				/>
				<div css={{ textAlign: "center" }}>
					<div css={{ fontWeight: 600, marginBottom: theme.spacing(1) }}>
						No AI Agents Available
					</div>
					<div css={{ fontSize: "0.875rem" }}>
						Create an AI agent in a workspace to get started.
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			css={{
				display: "flex",
				flexDirection: "column",
				height: "100%",
				overflow: "hidden",
			}}
		>
			<div
				css={{
					padding: theme.spacing(2),
					fontWeight: 600,
					borderBottom: `1px solid ${theme.palette.divider}`,
				}}
			>
				Available AI Agents
			</div>
			<div
				css={{
					flexGrow: 1,
					overflow: "auto",
				}}
			>
				<List>
					{data.agents.map((agent) => (
						<ListItem key={agent.workspace_agent_id} disablePadding>
							<ListItemButton
								selected={
									selectedAgent?.workspace_agent_id === agent.workspace_agent_id
								}
								onClick={() => handleAgentSelect(agent)}
								css={{
									padding: theme.spacing(1, 2),
								}}
							>
								<ListItemAvatar>
									{agent.icon ? (
										<Avatar src={agent.icon} alt={agent.display_name} />
									) : (
										<Avatar>
											<SmartToyIcon />
										</Avatar>
									)}
								</ListItemAvatar>
								<ListItemText
									primary={agent.display_name}
									secondary={`${agent.workspace_name}`}
									primaryTypographyProps={{
										noWrap: true,
										variant: "body2",
									}}
									secondaryTypographyProps={{
										noWrap: true,
										variant: "caption",
									}}
								/>
							</ListItemButton>
						</ListItem>
					))}
				</List>
			</div>
		</div>
	);
};

export default AIAgentChatSidebar;
