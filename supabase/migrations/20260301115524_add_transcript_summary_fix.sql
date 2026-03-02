-- Migration: Add transcript summary field to saved_posts
-- Purpose: Store AI-generated summary of video transcripts
-- Date: 2026-02-25

-- Add transcript summary field
ALTER TABLE saved_posts
ADD COLUMN IF NOT EXISTS transcript_summary TEXT,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;

-- Add index on summary_generated_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_saved_posts_summary_generated
ON saved_posts(summary_generated_at);

-- Add comments for documentation
COMMENT ON COLUMN saved_posts.transcript_summary IS 'AI-generated summary of the video transcript (via OpenAI GPT)';
COMMENT ON COLUMN saved_posts.summary_generated_at IS 'Timestamp when the summary was generated';
