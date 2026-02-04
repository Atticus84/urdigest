-- Migration: Add content extraction fields to saved_posts
-- Purpose: Store transcripts, OCR text, processing status, and source attribution
-- Date: 2026-02-04

-- Add content extraction fields
ALTER TABLE saved_posts
ADD COLUMN IF NOT EXISTS transcript_text TEXT,
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS extracted_metadata JSONB,
ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS media_downloaded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS media_file_paths JSONB,
ADD COLUMN IF NOT EXISTS sources_used JSONB,
ADD COLUMN IF NOT EXISTS content_confidence VARCHAR(20);

-- Add index on processing_status for efficient querying
CREATE INDEX IF NOT EXISTS idx_saved_posts_processing_status
ON saved_posts(processing_status);

-- Add index on enrichment_completed_at
CREATE INDEX IF NOT EXISTS idx_saved_posts_enrichment_completed
ON saved_posts(enrichment_completed_at);

-- Add comments for documentation
COMMENT ON COLUMN saved_posts.transcript_text IS 'Extracted transcript from video/reel audio (via Whisper or similar)';
COMMENT ON COLUMN saved_posts.ocr_text IS 'Extracted text from images via OCR (combined from all carousel images)';
COMMENT ON COLUMN saved_posts.extracted_metadata IS 'Additional metadata from Instagram Graph API (if available)';
COMMENT ON COLUMN saved_posts.processing_status IS 'Status: pending, enriching, completed, failed';
COMMENT ON COLUMN saved_posts.processing_error IS 'Error message if enrichment failed';
COMMENT ON COLUMN saved_posts.enrichment_completed_at IS 'Timestamp when enrichment finished';
COMMENT ON COLUMN saved_posts.media_downloaded IS 'Whether media files were downloaded to temp storage';
COMMENT ON COLUMN saved_posts.media_file_paths IS 'Array of downloaded file paths/URLs';
COMMENT ON COLUMN saved_posts.sources_used IS 'Object tracking which sources were used: {transcript: bool, ocr: bool, caption: bool, metadata: bool}';
COMMENT ON COLUMN saved_posts.content_confidence IS 'Confidence level: low, medium, high';
