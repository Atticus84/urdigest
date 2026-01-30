-- Add instagram_user_id column for webhook message matching
ALTER TABLE users ADD COLUMN instagram_user_id VARCHAR(255);

-- Index for looking up users by Instagram user ID (used in webhook handler)
CREATE INDEX idx_users_instagram_user_id ON users(instagram_user_id) WHERE instagram_user_id IS NOT NULL;
