import TextField from "@mui/material/TextField";
import type { UpdateUserProfileRequest } from "api/typesGenerated";
import { ErrorAlert } from "components/Alert/ErrorAlert";
import { Button } from "components/Button/Button";
import { Form, FormFields } from "components/Form/Form";
import { Spinner } from "components/Spinner/Spinner";
import { type FormikTouched, useFormik } from "formik";
import type { FC } from "react";
import {
	getFormHelpers,
	nameValidator,
	onChangeTrimmed,
} from "utils/formUtils";
import * as Yup from "yup";

export const Language = {
	usernameLabel: "Username",
	emailLabel: "Email",
	nameLabel: "Name",
	updateSettings: "Update account",
};

const validationSchema = Yup.object({
	username: nameValidator(Language.usernameLabel),
	name: Yup.string(),
});

interface AccountFormProps {
	editable: boolean;
	email: string;
	isLoading: boolean;
	initialValues: UpdateUserProfileRequest;
	onSubmit: (values: UpdateUserProfileRequest) => void;
	updateProfileError?: unknown;
	// initialTouched is only used for testing the error state of the form.
	initialTouched?: FormikTouched<UpdateUserProfileRequest>;
}

export const AccountForm: FC<AccountFormProps> = ({
	editable,
	email,
	isLoading,
	onSubmit,
	initialValues,
	updateProfileError,
	initialTouched,
}) => {
	const form = useFormik({
		initialValues,
		validationSchema,
		onSubmit,
		initialTouched,
	});
	const getFieldHelpers = getFormHelpers(form, updateProfileError);

	return (
		<Form onSubmit={form.handleSubmit}>
			<FormFields>
				{Boolean(updateProfileError) && (
					<ErrorAlert error={updateProfileError} />
				)}

				<TextField
					disabled
					fullWidth
					label={Language.emailLabel}
					value={email}
				/>
				<TextField
					{...getFieldHelpers("username")}
					onChange={onChangeTrimmed(form)}
					aria-disabled={!editable}
					autoComplete="username"
					disabled={!editable}
					fullWidth
					label={Language.usernameLabel}
				/>
				<TextField
					{...getFieldHelpers("name")}
					fullWidth
					onBlur={(e) => {
						e.target.value = e.target.value.trim();
						form.handleChange(e);
					}}
					label={Language.nameLabel}
					helperText='The human-readable name is optional and can be accessed in a template via the "data.coder_workspace_owner.me.full_name" property.'
				/>

				<div>
					<Button disabled={isLoading} type="submit">
						<Spinner loading={isLoading} />
						{Language.updateSettings}
					</Button>
				</div>
			</FormFields>
		</Form>
	);
};
