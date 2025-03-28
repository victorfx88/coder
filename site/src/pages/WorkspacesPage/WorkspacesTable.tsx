import { useTheme } from "@emotion/react";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import Star from "@mui/icons-material/Star";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { visuallyHidden } from "@mui/utils";
import type { Template, Workspace, WorkspaceAgentTask } from "api/typesGenerated";
import { Avatar } from "components/Avatar/Avatar";
import { AvatarData } from "components/Avatar/AvatarData";
import { AvatarDataSkeleton } from "components/Avatar/AvatarDataSkeleton";
import { InfoTooltip } from "components/InfoTooltip/InfoTooltip";
import { Stack } from "components/Stack/Stack";
import {
	TableLoaderSkeleton,
	TableRowSkeleton,
} from "components/TableLoader/TableLoader";
import { useProxy } from "contexts/ProxyContext";
import { useClickableTableRow } from "hooks/useClickableTableRow";
import { useDashboard } from "modules/dashboard/useDashboard";
import { WorkspaceDormantBadge } from "modules/workspaces/WorkspaceDormantBadge/WorkspaceDormantBadge";
import { WorkspaceOutdatedTooltip } from "modules/workspaces/WorkspaceOutdatedTooltip/WorkspaceOutdatedTooltip";
import { WorkspaceStatusBadge } from "modules/workspaces/WorkspaceStatusBadge/WorkspaceStatusBadge";
import { LastUsed } from "pages/WorkspacesPage/LastUsed";
import { useMemo, type FC, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createAppLinkHref } from "utils/apps";
import { getDisplayWorkspaceTemplateName } from "utils/workspace";
import { WorkspacesEmpty } from "./WorkspacesEmpty";

export interface WorkspacesTableProps {
	workspaces?: readonly Workspace[];
	checkedWorkspaces: readonly Workspace[];
	error?: unknown;
	isUsingFilter: boolean;
	onUpdateWorkspace: (workspace: Workspace) => void;
	onCheckChange: (checkedWorkspaces: readonly Workspace[]) => void;
	onActiveAppURLChange: (appURL: string) => void;
	canCheckWorkspaces: boolean;
	templates?: Template[];
	canCreateTemplate: boolean;
}

export const WorkspacesTable: FC<WorkspacesTableProps> = ({
	workspaces,
	checkedWorkspaces,
	isUsingFilter,
	onUpdateWorkspace,
	onCheckChange,
	onActiveAppURLChange,
	canCheckWorkspaces,
	templates,
	canCreateTemplate,
}) => {
	const theme = useTheme();
	const dashboard = useDashboard();
	const { proxy } = useProxy();

	// Create a map of workspace IDs to their tasks
	const tasksByWorkspace: Record<string, {
		latestTask: WorkspaceAgentTask,
		waitingForUserInput: boolean,
		claudeCodeAppURL?: string
		claudeCodeAppIcon?: string
	}> = useMemo(() => workspaces?.reduce((acc, workspace) => {
		const agents = workspace.latest_build.resources
			?.flatMap(resource => resource.agents || [])
		// Get all tasks from all agents across all resources for this workspace
		const workspaceTasks = agents
			.filter(agent => agent && agent.tasks?.length > 0)
			.flatMap(agent => agent.tasks || []);
		const waitingForUserInput = agents.filter(agent => agent.task_waiting_for_user_input).length > 0
		const claudeCodeApp = agents.flatMap(agent => agent.apps.filter(app => app.display_name === "Claude Code"))

		// Only add to the map if there are tasks
		if (workspaceTasks && workspaceTasks.length > 0) {

			let claudeCodeAppURL = undefined;
			if (claudeCodeApp[0]) {
				claudeCodeAppURL = createAppLinkHref(
					window.location.protocol,
					proxy.preferredPathAppURL,
					proxy.preferredWildcardHostname,
					claudeCodeApp[0].slug,
					workspace.owner_name,
					workspace,
					agents[0],
					claudeCodeApp[0]
				)
				if (claudeCodeAppURL.startsWith("/")) {
					claudeCodeAppURL = `${window.location.origin}${claudeCodeAppURL}`
				}
			}

			acc[workspace.id] = {
				latestTask: workspaceTasks[0],
				waitingForUserInput,
				claudeCodeAppURL,
				claudeCodeAppIcon: claudeCodeApp[0] ? claudeCodeApp[0].icon : undefined
			};
		}

		return acc;
	}, {} as Record<string, {
		latestTask: WorkspaceAgentTask,
		waitingForUserInput: boolean,
		claudeCodeAppURL?: string,
		claudeCodeAppIcon?: string
	}>) || {},
		[workspaces],
	);
	const hasTasks = useMemo(() => Object.values(tasksByWorkspace).some(tasks => tasks.latestTask !== undefined), [tasksByWorkspace]);

	return (
		<TableContainer>
			<Table>
				<TableHead>
					<TableRow>
						<TableCell width="25%">
							<div css={{ display: "flex", alignItems: "center", gap: 8 }}>
								{canCheckWorkspaces && (
									<Checkbox
										// Remove the extra padding added for the first cell in the
										// table
										css={{
											marginLeft: "-20px",
											// MUI by default adds 9px padding to enhance the
											// clickable area. We aim to prevent this from impacting
											// the layout of surrounding elements.
											marginTop: -9,
											marginBottom: -9,
										}}
										disabled={!workspaces || workspaces.length === 0}
										checked={checkedWorkspaces.length === workspaces?.length}
										size="xsmall"
										onChange={(_, checked) => {
											if (!workspaces) {
												return;
											}

											if (!checked) {
												onCheckChange([]);
											} else {
												onCheckChange(workspaces);
											}
										}}
									/>
								)}
								Name
							</div>
						</TableCell>
						{hasTasks && (
							<TableCell width="30%">Task</TableCell>
						)}
						<TableCell width="10%">Template</TableCell>
						<TableCell width="10%">Last used</TableCell>
						<TableCell width="15%">Status</TableCell>
						<TableCell width="1%" />
					</TableRow>
				</TableHead>
				<TableBody>
					{!workspaces && (
						<TableLoader canCheckWorkspaces={canCheckWorkspaces} />
					)}
					{workspaces && workspaces.length === 0 && (
						<WorkspacesEmpty
							templates={templates}
							isUsingFilter={isUsingFilter}
							canCreateTemplate={canCreateTemplate}
						/>
					)}
					{workspaces?.map((workspace) => {
						const checked = checkedWorkspaces.some(
							(w) => w.id === workspace.id,
						);
						const activeOrg = dashboard.organizations.find(
							(o) => o.id === workspace.organization_id,
						);
						const task = tasksByWorkspace[workspace.id];

						return (
							<WorkspacesRow
								workspace={workspace}
								key={workspace.id}
								checked={checked}
							>
								<TableCell>
									<div css={{ display: "flex", alignItems: "center", gap: 8 }}>
										{canCheckWorkspaces && (
											<Checkbox
												// Remove the extra padding added for the first cell in the
												// table
												css={{
													marginLeft: "-20px",
												}}
												data-testid={`checkbox-${workspace.id}`}
												size="xsmall"
												disabled={cantBeChecked(workspace)}
												checked={checked}
												onClick={(e) => {
													e.stopPropagation();
												}}
												onChange={(e) => {
													if (e.currentTarget.checked) {
														onCheckChange([...checkedWorkspaces, workspace]);
													} else {
														onCheckChange(
															checkedWorkspaces.filter(
																(w) => w.id !== workspace.id,
															),
														);
													}
												}}
											/>
										)}
										<AvatarData
											title={
												<Stack
													direction="row"
													spacing={0.5}
													alignItems="center"
												>
													{workspace.name}
													{workspace.favorite && (
														<Star css={{ width: 16, height: 16 }} />
													)}
													{workspace.outdated && (
														<WorkspaceOutdatedTooltip
															organizationName={workspace.organization_name}
															templateName={workspace.template_name}
															latestVersionId={
																workspace.template_active_version_id
															}
															onUpdateVersion={() => {
																onUpdateWorkspace(workspace);
															}}
														/>
													)}
												</Stack>
											}
											subtitle={
												<div>
													<span css={{ ...visuallyHidden }}>User: </span>
													{workspace.owner_name}
												</div>
											}
											avatar={
												<Avatar
													variant="icon"
													src={workspace.template_icon}
													fallback={workspace.name}
												/>
											}
										/>
									</div>
								</TableCell>

								{hasTasks && (
									<TableCell>
										{task?.latestTask ? (
											<div css={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between"
											}}>
												<div css={{
													display: "flex",
													alignItems: "center",
													gap: 8,
												}}>
													{/* Task status indicators */}
													{task.waitingForUserInput ? (
														<span css={{
															display: "inline-flex",
															alignItems: "center",
															justifyContent: "center",
															color: theme.palette.info.main,
															marginRight: 8
														}}>
															<span role="img" aria-label="Input needed">
															🙋
															</span>
														</span>
													) : (
														<span css={{
															display: "inline-block",
															width: 16,
															
															height: 16,
															marginRight: 8,
															borderRadius: "50%",
															border: `2px solid ${theme.palette.divider}`,
															borderTopColor: theme.palette.primary.main,
															animation: "spin 1.5s linear infinite",
															"@keyframes spin": {
																to: { transform: "rotate(360deg)" }
															}
														}} />
													)}
													
													{/* Task summary with icon */}
													<div css={{ color: theme.palette.text.secondary }}>
														{task.latestTask.summary}
													</div>
												</div>
												
												{/* Claude Code button aligned to the right */}
												{task?.claudeCodeAppURL && (
													<Button
														variant="outlined"
														size="small"
														onClick={(e) => {
															e.stopPropagation();
															onActiveAppURLChange(task.claudeCodeAppURL!);
														}}
														css={{
															fontSize: 12,
															minWidth: "auto",
															padding: "4px 8px",
															marginRight: 64,
														}}
													>
														<img width={16} height={16} src={task.claudeCodeAppIcon} alt="Claude Code" />
													</Button>
												)}
											</div>
										) : (
											<div css={{ color: theme.palette.text.secondary }}>
												No active tasks
											</div>
										)}
									</TableCell>
								)}

								<TableCell>
									<div>{getDisplayWorkspaceTemplateName(workspace)}</div>

									{dashboard.showOrganizations && (
										<div
											css={{
												fontSize: 13,
												color: theme.palette.text.secondary,
												lineHeight: 1.5,
											}}
										>
											<span css={{ ...visuallyHidden }}>Organization: </span>
											{activeOrg?.display_name || workspace.organization_name}
										</div>
									)}
								</TableCell>

								<TableCell>
									<LastUsed lastUsedAt={workspace.last_used_at} />
								</TableCell>

								<TableCell>
									<div css={{ display: "flex", alignItems: "center", gap: 8 }}>
										<WorkspaceStatusBadge workspace={workspace} />
										{workspace.latest_build.status === "running" &&
											!workspace.health.healthy && (
												<InfoTooltip
													type="warning"
													title="Workspace is unhealthy"
													message="Your workspace is running but some agents are unhealthy."
												/>
											)}
										{workspace.dormant_at && (
											<WorkspaceDormantBadge workspace={workspace} />
										)}
									</div>
								</TableCell>

								<TableCell>
									<div css={{ display: "flex", paddingLeft: 16 }}>
										<KeyboardArrowRight
											css={{
												color: theme.palette.text.secondary,
												width: 20,
												height: 20,
											}}
										/>
									</div>
								</TableCell>
							</WorkspacesRow>
						);
					})}
				</TableBody>
			</Table>
		</TableContainer>
	);
};

interface WorkspacesRowProps {
	workspace: Workspace;
	children?: ReactNode;
	checked: boolean;
}

const WorkspacesRow: FC<WorkspacesRowProps> = ({
	workspace,
	children,
	checked,
}) => {
	const navigate = useNavigate();
	const theme = useTheme();

	const workspacePageLink = `/@${workspace.owner_name}/${workspace.name}`;
	const openLinkInNewTab = () => window.open(workspacePageLink, "_blank");
	const clickableProps = useClickableTableRow({
		onMiddleClick: openLinkInNewTab,
		onClick: (event) => {
			// Order of booleans actually matters here for Windows-Mac compatibility;
			// meta key is Cmd on Macs, but on Windows, it's either the Windows key,
			// or the key does nothing at all (depends on the browser)
			const shouldOpenInNewTab =
				event.shiftKey || event.metaKey || event.ctrlKey;

			if (shouldOpenInNewTab) {
				openLinkInNewTab();
			} else {
				navigate(workspacePageLink);
			}
		},
	});

	const bgColor = checked ? theme.palette.action.hover : undefined;

	return (
		<TableRow
			{...clickableProps}
			data-testid={`workspace-${workspace.id}`}
			css={{
				...clickableProps.css,
				backgroundColor: bgColor,

				"&:hover": {
					backgroundColor: `${bgColor} !important`,
				},
			}}
		>
			{children}
		</TableRow>
	);
};

interface TableLoaderProps {
	canCheckWorkspaces?: boolean;
}

const TableLoader: FC<TableLoaderProps> = ({ canCheckWorkspaces }) => {
	return (
		<TableLoaderSkeleton>
			<TableRowSkeleton>
				<TableCell width="40%">
					<div css={{ display: "flex", alignItems: "center", gap: 8 }}>
						{canCheckWorkspaces && (
							<Checkbox size="small" disabled css={{ marginLeft: "-20px" }} />
						)}
						<AvatarDataSkeleton />
					</div>
				</TableCell>
				<TableCell>
					<Skeleton variant="text" width="25%" />
				</TableCell>
				<TableCell>
					<Skeleton variant="text" width="25%" />
				</TableCell>
				<TableCell>
					<Skeleton variant="text" width="25%" />
				</TableCell>
				<TableCell>
					<Skeleton variant="text" width="25%" />
				</TableCell>
			</TableRowSkeleton>
		</TableLoaderSkeleton>
	);
};

const cantBeChecked = (workspace: Workspace) => {
	return ["deleting", "pending"].includes(workspace.latest_build.status);
};
