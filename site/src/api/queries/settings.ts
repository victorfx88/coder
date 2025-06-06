import { API } from "api/api";
import type {
	UpdateUserQuietHoursScheduleRequest,
	UserQuietHoursScheduleResponse,
} from "api/typesGenerated";
import type { QueryClient, QueryOptions } from "react-query";

const userQuietHoursScheduleKey = (userId: string) => [
	"settings",
	userId,
	"quietHours",
];

export const userQuietHoursSchedule = (userId: string) => {
	return {
		queryKey: userQuietHoursScheduleKey(userId),
		queryFn: () => API.getUserQuietHoursSchedule(userId),
	} satisfies QueryOptions<UserQuietHoursScheduleResponse>;
};

export const updateUserQuietHoursSchedule = (
	userId: string,
	queryClient: QueryClient,
) => {
	return {
		mutationFn: (request: UpdateUserQuietHoursScheduleRequest) =>
			API.updateUserQuietHoursSchedule(userId, request),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: userQuietHoursScheduleKey(userId),
			});
		},
	};
};
