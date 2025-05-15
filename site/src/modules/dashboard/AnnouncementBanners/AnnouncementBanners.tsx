import { useDashboard } from "modules/dashboard/useDashboard";
import { FC, useState, useCallback } from "react";
import { AnnouncementBannerView } from "./AnnouncementBannerView";
import { dismissAnnouncementBanner } from "api/queries/appearance";

export const AnnouncementBanners: FC = () => {
	const { appearance, entitlements } = useDashboard();
	const announcementBanners = appearance.announcement_banners;

	// Track dismissed banner messages locally to provide immediate UI feedback
	const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(
		new Set<string>()
	);

	const isEntitled =
		entitlements.features.appearance.entitlement !== "not_entitled";
	if (!isEntitled) {
		return null;
	}

	const handleDismiss = useCallback(async (message: string) => {
		try {
			// Update local state immediately for responsive UI
			setDismissedBanners((prev) => {
				const next = new Set(prev);
				next.add(message);
				return next;
			});

			// Call the API to persist the dismissal
			await dismissAnnouncementBanner(message);
		} catch (error) {
			console.error("Failed to dismiss announcement banner:", error);
			
			// Revert the local state if API call fails
			setDismissedBanners((prev) => {
				const next = new Set(prev);
				next.delete(message);
				return next;
			});
		}
	}, []);

	return (
		<>
			{announcementBanners
				.filter((banner) => banner.enabled && !dismissedBanners.has(banner.message))
				.map((banner) => (
					<AnnouncementBannerView
						key={banner.message}
						message={banner.message}
						backgroundColor={banner.background_color}
						dismissible={banner.dismissible}
						onDismiss={banner.dismissible ? handleDismiss : undefined}
					/>
				))}
		</>
	);
};
