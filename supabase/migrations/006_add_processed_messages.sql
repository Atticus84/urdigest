-- Track processed Instagram webhook message IDs for deduplication
CREATE TABLE processed_messages (
  message_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup of old entries
CREATE INDEX idx_processed_messages_processed_at ON processed_messages (processed_at);

-- Enable RLS (no user access needed, only service role)
ALTER TABLE processed_messages ENABLE ROW LEVEL SECURITY;
