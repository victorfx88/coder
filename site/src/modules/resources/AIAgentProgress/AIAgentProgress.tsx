import { useMemo, type FC } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import LinearProgress from "@mui/material/LinearProgress";
import { formatDistanceToNow } from "date-fns";
import type {
	WorkspaceAgentLog,
	WorkspaceAgentLogSource,
} from "api/typesGenerated";

// This interface will need to be updated once the backend is implemented
export interface AIAgentReport {
	id: string;
	message: string;
	timestamp: string;
}

export interface AIAgentProgressProps {
	logs: readonly WorkspaceAgentLog[];
	sources: readonly WorkspaceAgentLogSource[];
	isLoading?: boolean;
}

export const AIAgentProgress: FC<AIAgentProgressProps> = ({
	logs,
	sources,
	isLoading = false,
}) => {
	if (isLoading) {
		return (
			<Box sx={{ padding: 2 }}>
				<LinearProgress />
				<Typography variant="body2" sx={{ mt: 2 }}>
					Loading AI agent progress...
				</Typography>
			</Box>
		);
	}

	const logSourceByID = useMemo(() => {
		const sourcesById: { [id: string]: WorkspaceAgentLogSource } = {};
		for (const source of sources) {
			sourcesById[source.id] = source;
		}
		return sourcesById;
	}, [sources]);

	const filteredLogs = useMemo(() => {
		const filtered = logs.filter(
			(log) => logSourceByID[log.source_id]?.display_name === "AI Agent",
		);
		return filtered.sort((a, b) => {
			return (
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);
		});
	}, [logs, logSourceByID]);

	if (filteredLogs.length === 0) {
		return (
			<Box sx={{ padding: 2 }}>
				<Typography variant="body2" color="text.secondary">
					No AI agent activity to report.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ padding: 2, maxHeight: 350, overflow: "auto" }}>
			<Stack spacing={2}>
				<Typography variant="subtitle2">Activity Log</Typography>

				{filteredLogs.map((report, index) => (
					<Box
						key={report.id}
						sx={{
							p: 1.5,
							borderRadius: 1,
							backgroundColor: "background.paper",
							border: "1px solid",
							borderColor: "divider",
						}}
					>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							mb={0.5}
						>
							<Chip
								label={`Step ${filteredLogs.length - index}`}
								size="small"
								color={index === 0 ? "primary" : "default"}
								variant={index === 0 ? "filled" : "outlined"}
							/>
							<Typography variant="caption" color="text.secondary">
								{formatDistanceToNow(new Date(report.created_at), {
									addSuffix: true,
								})}
							</Typography>
						</Stack>
						<Typography variant="body2">{report.output}</Typography>
					</Box>
				))}
			</Stack>
		</Box>
	);
};

export default AIAgentProgress;
