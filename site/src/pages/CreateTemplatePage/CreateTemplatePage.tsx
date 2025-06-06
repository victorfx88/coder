import { createTemplate } from "api/queries/templates";
import type { TemplateVersion } from "api/typesGenerated";
import { FullPageHorizontalForm } from "components/FullPageForm/FullPageHorizontalForm";
import { linkToTemplate, useLinks } from "modules/navigation";
import { type FC, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation } from "react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { pageTitle } from "utils/page";
import { BuildLogsDrawer } from "./BuildLogsDrawer";
import { DuplicateTemplateView } from "./DuplicateTemplateView";
import { ImportStarterTemplateView } from "./ImportStarterTemplateView";
import { UploadTemplateView } from "./UploadTemplateView";
import type { CreateTemplatePageViewProps } from "./types";

const CreateTemplatePage: FC = () => {
	const navigate = useNavigate();
	const getLink = useLinks();
	const [searchParams] = useSearchParams();
	const [isBuildLogsOpen, setIsBuildLogsOpen] = useState(false);
	const [templateVersion, setTemplateVersion] = useState<TemplateVersion>();
	const createTemplateMutation = useMutation(createTemplate());
	const variablesSectionRef = useRef<HTMLDivElement>(null);

	const onCancel = () => {
		navigate(-1);
	};

	const pageViewProps: CreateTemplatePageViewProps = {
		onCreateTemplate: async (options) => {
			setIsBuildLogsOpen(true);
			const template = await createTemplateMutation.mutateAsync({
				...options,
				onCreateVersion: setTemplateVersion,
				onTemplateVersionChanges: setTemplateVersion,
			});
			navigate(
				`${getLink(linkToTemplate(options.organization, template.name))}/files`,
			);
		},
		onOpenBuildLogsDrawer: () => setIsBuildLogsOpen(true),
		error: createTemplateMutation.error,
		isCreating: createTemplateMutation.isPending,
		variablesSectionRef,
	};

	return (
		<>
			<Helmet>
				<title>{pageTitle("Create Template")}</title>
			</Helmet>

			<FullPageHorizontalForm title="Create Template" onCancel={onCancel}>
				{searchParams.has("fromTemplate") ? (
					<DuplicateTemplateView {...pageViewProps} />
				) : searchParams.has("exampleId") ? (
					<ImportStarterTemplateView {...pageViewProps} />
				) : (
					<UploadTemplateView {...pageViewProps} />
				)}
			</FullPageHorizontalForm>

			<BuildLogsDrawer
				error={createTemplateMutation.error}
				open={isBuildLogsOpen}
				onClose={() => setIsBuildLogsOpen(false)}
				templateVersion={templateVersion}
				variablesSectionRef={variablesSectionRef}
			/>
		</>
	);
};

export default CreateTemplatePage;
