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

export interface CreateAgentData {
  taskName: string;
  model: string;
  costLimit: number;
  communicationMethod: "Github Issue" | "Running Console";
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
  const form = useFormik({
    initialValues: {
      taskName: "",
      model: "claude-3-5-sonnet",
      costLimit: 10,
      communicationMethod: "Github Issue" as "Github Issue" | "Running Console",
    },
    validationSchema: Yup.object({
      taskName: Yup.string().required("Task name is required"),
      model: Yup.string().required("Model is required"),
      costLimit: Yup.number()
        .required("Cost limit is required")
        .min(1, "Cost limit must be at least $1")
        .max(1000, "Cost limit cannot exceed $1000"),
      communicationMethod: Yup.string().required("Communication method is required"),
    }),
    onSubmit: (values) => {
      onConfirm({
        ...values,
        communicationMethod: values.communicationMethod as "Github Issue" | "Running Console",
      });
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
      title="Create New AI Agent"
      description={
        <form id="create-agent" onSubmit={form.handleSubmit}>
          <Stack spacing={3}>
            <p>Configure a new AI agent for your workspace.</p>
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
                  <SelectTrigger id="model-select">
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
                  onValueChange={(value: "Github Issue" | "Running Console") => {
                    form.setFieldValue("communicationMethod", value);
                  }}
                  disabled={isCreating}
                >
                  <SelectTrigger id="communication-select">
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
            </FormFields>
          </Stack>
        </form>
      }
    />
  );
};

const styles = {
  selectLabel: (theme: Theme) => ({
    fontSize: 14,
    marginBottom: 8,
    display: "block",
    color: theme.palette.text.secondary,
  }),
} satisfies Record<string, Interpolation<Theme>>;
