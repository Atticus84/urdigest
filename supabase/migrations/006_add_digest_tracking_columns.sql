-- Add email tracking columns to digests table
ALTER TABLE digests ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
