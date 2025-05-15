-- User dismissed banners will be stored in the user_configs table
-- with keys in the format "dismissed_announcement_banner_<message_hash>"
-- where <message_hash> is a hash of the banner message
-- The value will be the timestamp when the banner was dismissed

-- Create an index on the user_configs table for faster lookups of dismissed banners
CREATE INDEX IF NOT EXISTS idx_user_configs_dismissed_banners
ON user_configs (user_id, key)
WHERE key LIKE 'dismissed_announcement_banner_%';

-- Add a comment to document the use of this pattern
COMMENT ON INDEX idx_user_configs_dismissed_banners IS 
'Index to quickly find announcement banners that have been dismissed by users. Keys follow the pattern: dismissed_announcement_banner_<message_hash>';