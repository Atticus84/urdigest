-- Add password_set_at field to track when user sets their password
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
