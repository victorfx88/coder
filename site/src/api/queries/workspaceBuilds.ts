import { API } from "api/api";
import type {
	WorkspaceBuild,
	WorkspaceBuildParameter,
	WorkspaceBuildsRequest,
} from "api/typesGenerated";
import type { QueryOptions, UseInfiniteQueryOptions } from "react-query";

function workspaceBuildParametersKey(workspaceBuildId: string) {
	return ["workspaceBuilds", workspaceBuildId, "parameters"] as const;
}

export function workspaceBuildParameters(workspaceBuildId: string) {
	return {
		queryKey: workspaceBuildParametersKey(workspaceBuildId),
		queryFn: () => API.getWorkspaceBuildParameters(workspaceBuildId),
	} as const satisfies QueryOptions<WorkspaceBuildParameter[]>;
}

export const workspaceBuildByNumber = (
	username: string,
	workspaceName: string,
	buildNumber: number,
) => {
	return {
		queryKey: ["workspaceBuild", username, workspaceName, buildNumber],
		queryFn: () =>
			API.getWorkspaceBuildByNumber(username, workspaceName, buildNumber),
	};
};

export const workspaceBuildsKey = (workspaceId: string) => [
	"workspaceBuilds",
	workspaceId,
];

export const infiniteWorkspaceBuilds = (
	workspaceId: string,
	req?: WorkspaceBuildsRequest,
) => {
	const limit = req?.limit ?? 25;

	return {
		queryKey: [...workspaceBuildsKey(workspaceId), req],
		getNextPageParam: (lastPage, pages) => {
			if (lastPage.length < limit) {
				return undefined;
			}
			return pages.length + 1;
		},
		initialPageParam: 0,
		queryFn: ({ pageParam }) => {
			if (typeof pageParam !== "number") {
				throw new Error("pageParam must be a number");
			}
			return API.getWorkspaceBuilds(workspaceId, {
				limit,
				offset: pageParam <= 0 ? 0 : (pageParam - 1) * limit,
			});
		},
	} satisfies UseInfiniteQueryOptions<WorkspaceBuild[]>;
};

// We use readyAgentsCount to invalidate the query when an agent connects
export const workspaceBuildTimings = (workspaceBuildId: string) => {
	return {
		queryKey: ["workspaceBuilds", workspaceBuildId, "timings"],
		queryFn: () => API.workspaceBuildTimings(workspaceBuildId),
	};
};
