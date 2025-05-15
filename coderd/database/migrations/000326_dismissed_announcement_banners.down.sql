-- Remove the index for dismissed announcement banners
DROP INDEX IF EXISTS idx_user_configs_dismissed_banners;

-- The user_configs entries for dismissed banners will remain but won't be used anymore
-- We don't delete them as they don't cause any harm and might be useful for data retention
-- If we wanted to clean them up, we could use:
-- DELETE FROM user_configs WHERE key LIKE 'dismissed_announcement_banner_%';