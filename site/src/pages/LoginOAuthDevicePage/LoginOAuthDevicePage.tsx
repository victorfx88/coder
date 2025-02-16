
import Button from "@mui/material/Button";
import { useEffect } from "react";
import type { ApiErrorResponse } from "api/errors";
import {
	exchangeExternalAuthDevice,
	externalAuthDevice,
	externalAuthProvider,
} from "api/queries/externalAuth";
import { getGitHubDevice, getGitHubCallback } from "api/queries/oauth2";
import { isAxiosError } from "axios";
import { SignInLayout } from "components/SignInLayout/SignInLayout";
import { Welcome } from "components/Welcome/Welcome";
import { useAuthenticated } from "contexts/auth/RequireAuth";
import type { FC } from "react";
import { useQuery, useQueryClient } from "react-query";
import { useParams, useSearchParams } from "react-router-dom";
import LoginOAuthDevicePageView from "./LoginOAuthDevicePageView";

const LoginOAuthDevicePage: FC = () => {
	const [searchParams] = useSearchParams();

	const state = searchParams.get("state");
	if (!state) {
		return <SignInLayout>
			<Welcome>Missing OAuth2 state</Welcome>
		</SignInLayout>
	}

	const externalAuthDeviceQuery = useQuery({
		...getGitHubDevice(),
		refetchOnMount: false,
	});
	const exchangeExternalAuthDeviceQuery = useQuery({
		...getGitHubCallback(
			externalAuthDeviceQuery.data?.device_code ?? "",
			state,
		),
		enabled: Boolean(externalAuthDeviceQuery.data),
		retry: true,
		retryDelay: (externalAuthDeviceQuery.data?.interval || 5) * 1000,
		refetchOnWindowFocus: (query) =>
			query.state.status === "success" ? false : "always",
	});

	useEffect(() => {
		if (!exchangeExternalAuthDeviceQuery.isSuccess) {
			return
		}
		// TODO: should this be replaced with a navigate?
		// https://github.com/coder/coder/blob/0f5a93263f854c083ebe6c23bd467fd12f46367a/site/src/pages/LoginPage/LoginPage.tsx#L54
		window.location.href = exchangeExternalAuthDeviceQuery.data;
	}, [exchangeExternalAuthDeviceQuery.isSuccess]);

	let deviceExchangeError: ApiErrorResponse | undefined;
	if (isAxiosError(exchangeExternalAuthDeviceQuery.failureReason)) {
		deviceExchangeError =
			exchangeExternalAuthDeviceQuery.failureReason.response?.data;
	} else if (isAxiosError(externalAuthDeviceQuery.failureReason)) {
		deviceExchangeError = externalAuthDeviceQuery.failureReason.response?.data;
	}


	return (
		<LoginOAuthDevicePageView
			externalAuth={{
				authenticated: false,
				device: true,
				display_name: "GitHub",
				user: null,
				app_installable: true,
				installations: [],
				app_install_url: "",
			}}
			onReauthenticate={() => { }}
			viewExternalAuthConfig={false}
			deviceExchangeError={deviceExchangeError}
			externalAuthDevice={externalAuthDeviceQuery.data}
		/>
	);
};

export default LoginOAuthDevicePage;
