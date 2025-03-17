import type { Interpolation, Theme } from "@emotion/react";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { ConfirmDialog } from "components/Dialogs/ConfirmDialog/ConfirmDialog";
import type { DialogProps } from "components/Dialogs/Dialog";
import { FormFields } from "components/Form/Form";
import { Stack } from "components/Stack/Stack";
import { useFormik } from "formik";
import type { FC } from "react";
import { getFormHelpers } from "utils/formUtils";
import * as Yup from "yup";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "components/Select/Select";
import {
	HelpTooltipText,
	HelpTooltipLink,
	HelpTooltipLinksGroup,
} from "components/HelpTooltip/HelpTooltip";
import { docs } from "utils/docs";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import Button from "@mui/material/Button";
import { Popover, PopoverContent, PopoverTrigger } from "components/Popover/Popover";
import { useState } from "react";

export interface CreateAgentData {
	taskName: string;
	model: string;
	costLimit: number;
	communicationMethod: "Github Issue" | "Running Console";
	prompt: string;
}

export type CreateAgentDialogProps = DialogProps & {
	isCreating: boolean;
	creationError?: unknown;
	onClose: () => void;
	onConfirm: (data: CreateAgentData) => void;
};

const modelOptions = [
	{ value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
	{ value: "claude-3-opus", label: "Claude 3 Opus" },
	{ value: "gpt-4o", label: "GPT-4o" },
	{ value: "gpt-4-turbo", label: "GPT-4 Turbo" }
];

const communicationOptions = [
	{ value: "Github Issue", label: "Github Issue" },
	{ value: "Running Console", label: "Running Console" }
];

export const CreateAgentDialog: FC<CreateAgentDialogProps> = ({
	onConfirm,
	isCreating,
	onClose,
	creationError,
	...dialogProps
}) => {
	const form = useFormik<CreateAgentData>({
		initialValues: {
			taskName: "",
			model: "claude-3-5-sonnet",
			costLimit: 10,
			communicationMethod: "Github Issue",
			prompt: "",
		},
		validationSchema: Yup.object({
			taskName: Yup.string().required("Task name is required"),
			model: Yup.string().required("Model is required"),
			costLimit: Yup.number()
				.required("Cost limit is required")
				.min(1, "Cost limit must be at least $1")
				.max(1000, "Cost limit cannot exceed $1000"),
			communicationMethod: Yup.string().oneOf(
				["Github Issue", "Running Console"],
				"Invalid communication method"
			).required("Communication method is required"),
			prompt: Yup.string().required("Prompt is required"),
		}),
		onSubmit: (values) => {
			onConfirm(values);
		},
	});

	const getFieldHelpers = getFormHelpers(form, creationError);

	const handleClose = () => {
		form.resetForm();
		onClose();
	};

	return (
		<ConfirmDialog
			{...dialogProps}
			confirmLoading={isCreating}
			onClose={handleClose}
			onConfirm={async () => {
				await form.submitForm();
			}}
			hideCancel={false}
			type="success"
			cancelText="Cancel"
			confirmText="Create Agent"
			title="Create AI Agent"
			description={
				<form id="create-agent" onSubmit={form.handleSubmit}>
					<div css={styles.scrollableContent}>
						<Stack spacing={3}>
							<HelpTooltipText>
								Configure a new AI agent for your workspace. AI agents can help with tasks like code analysis, testing, and documentation.
							</HelpTooltipText>

							<FormFields>
								<TextField
									{...getFieldHelpers("taskName")}
									label="Task Name"
									placeholder="Code analysis of repository"
									autoFocus
									disabled={isCreating}
								/>

								<div>
									<label
										htmlFor="model-select"
										css={styles.selectLabel}
									>
										Model
									</label>
									<Select
										value={form.values.model}
										onValueChange={(value) => {
											form.setFieldValue("model", value);
										}}
										disabled={isCreating}
									>
										<SelectTrigger
											id="model-select"
											onClick={(e) => e.stopPropagation()}
										>
											<SelectValue placeholder="Select model" />
										</SelectTrigger>
										<SelectContent>
											{modelOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<TextField
									{...getFieldHelpers("costLimit")}
									label="Cost Limit"
									type="number"
									disabled={isCreating}
									InputProps={{
										startAdornment: <InputAdornment position="start">$</InputAdornment>,
									}}
								/>

								<div>
									<label
										htmlFor="communication-select"
										css={styles.selectLabel}
									>
										Communication Method
									</label>
									<Select
										value={form.values.communicationMethod}
										onValueChange={(value) => {
											form.setFieldValue("communicationMethod", value);
										}}
										disabled={isCreating}
									>
										<SelectTrigger
											id="communication-select"
											onClick={(e) => e.stopPropagation()}
										>
											<SelectValue placeholder="Select communication method" />
										</SelectTrigger>
										<SelectContent>
											{communicationOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<TextField
									{...getFieldHelpers("prompt")}
									label="Prompt"
									placeholder="Describe the task for the AI agent"
									multiline
									rows={4}
									disabled={isCreating}
								/>
							</FormFields>

							<HelpTooltipLinksGroup>
								<HelpTooltipLink href={docs("/user-guides/workspace-access/ai-agents")}>
									Learn more about AI Agents
								</HelpTooltipLink>
								<HelpTooltipLink href={docs("/user-guides/workspace-access/ai-agents/prompt-examples")}>
									Prompt examples
								</HelpTooltipLink>
								<HelpTooltipLink href={docs("/user-guides/workspace-access/ai-agents/cost-management")}>
									Cost management
								</HelpTooltipLink>
							</HelpTooltipLinksGroup>
						</Stack>
					</div>
				</form>
			}
		/>
	);
};

export interface CreateAgentButtonProps {
	onCreateAgent: (data: CreateAgentData) => void;
	isCreating: boolean;
	creationError?: unknown;
}

export const CreateAgentButton: FC<CreateAgentButtonProps> = ({
	onCreateAgent,
	isCreating,
	creationError
}) => {
	const [isOpen, setIsOpen] = useState(false);

	const form = useFormik<CreateAgentData>({
		initialValues: {
			taskName: "",
			model: "claude-3-5-sonnet",
			costLimit: 10,
			communicationMethod: "Github Issue",
			prompt: "",
		},
		validationSchema: Yup.object({
			taskName: Yup.string().required("Task name is required"),
			model: Yup.string().required("Model is required"),
			costLimit: Yup.number()
				.required("Cost limit is required")
				.min(1, "Cost limit must be at least $1")
				.max(1000, "Cost limit cannot exceed $1000"),
			communicationMethod: Yup.string().oneOf(
				["Github Issue", "Running Console"],
				"Invalid communication method"
			).required("Communication method is required"),
			prompt: Yup.string().required("Prompt is required"),
		}),
		onSubmit: (values) => {
			onCreateAgent(values);
			setIsOpen(false);
		},
	});

	const getFieldHelpers = getFormHelpers(form, creationError);

	const handleClose = () => {
		form.resetForm();
		setIsOpen(false);
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="text"
					size="small"
					endIcon={<KeyboardArrowDown />}
					css={{ fontSize: 13, padding: "8px 12px" }}
					onClick={() => setIsOpen(true)}
				>
					Create AI Agent
				</Button>
			</PopoverTrigger>

			<PopoverContent
				className="custom-popover-width"
				css={styles.popoverContent}
				align="end"
				side="bottom"
			>
				<div css={styles.popoverHeader}>
					<h3 css={styles.popoverTitle}>Create AI Agent</h3>
				</div>

				<form id="create-agent-form" onSubmit={form.handleSubmit}>
					<div css={styles.scrollablePopoverContent}>
						<Stack spacing={2} css={styles.formContainer}>
							<HelpTooltipText>
								Create an AI Agent to work on a background task in a copy of this Workspace.
							</HelpTooltipText>

							<FormFields>
								<TextField
									{...getFieldHelpers("githubIssue")}
									label="Github Issue"
									placeholder="Paste a link to a github issue here"
									autoFocus
									disabled={isCreating}
									fullWidth
									size="small"
								/>

								<TextField
									{...getFieldHelpers("workingDirectory")}
									label="Working directory"
									placeholder="Directory to copy for agent to work in"
									autoFocus
									disabled={isCreating}
									fullWidth
									size="small"
								/>

								<TextField
									{...getFieldHelpers("costLimit")}
									label="Cost Limit"
									type="number"
									disabled={isCreating}
									fullWidth
									size="small"
									InputProps={{
										startAdornment: <InputAdornment position="start">$</InputAdornment>,
									}}
								/>
							</FormFields>

							<div css={styles.formActions}>
								<Button
									variant="outlined"
									size="small"
									onClick={handleClose}
									disabled={isCreating}
								>
									Cancel
								</Button>
								<Button
									variant="contained"
									size="small"
									type="submit"
									disabled={isCreating}
								>
									{isCreating ? "Creating..." : "Create Agent"}
								</Button>
							</div>

							<HelpTooltipLinksGroup>
								<HelpTooltipLink href={docs("/user-guides/workspace-access/ai-agents")}>
									Configure agent creation
								</HelpTooltipLink>
							</HelpTooltipLinksGroup>
						</Stack>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
};

const styles = {
	selectLabel: (theme: Theme) => ({
		fontSize: 14,
		marginBottom: 8,
		display: "block",
		color: theme.palette.text.secondary,
	}),
	dialogWidth: {
		width: "900px",
		maxWidth: "90vw",
	},
	scrollableContent: {
		maxHeight: "70vh",
		overflowY: "auto",
		overflowX: "hidden",
		padding: "0 4px",
		marginRight: "-4px",
	},
	popoverContent: {
		width: 900,
		maxWidth: "calc(100vw - 32px)",
		padding: 0,
	},
	scrollablePopoverContent: {
		maxHeight: "70vh",
		overflowY: "auto",
		overflowX: "hidden",
	},
	popoverHeader: (theme: Theme) => ({
		padding: "16px 24px",
		borderBottom: `1px solid ${theme.palette.divider}`,
	}),
	popoverTitle: {
		margin: 0,
		fontSize: 16,
		fontWeight: 600,
	},
	formContainer: {
		padding: "16px 24px 24px",
	},
	formActions: {
		display: "flex",
		justifyContent: "flex-end",
		gap: 8,
		marginTop: 8,
	},
} satisfies Record<string, Interpolation<Theme>>;
