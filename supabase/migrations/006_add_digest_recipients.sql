-- Digest recipients: allows users to send digests to multiple email addresses
CREATE TABLE digest_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_recipient UNIQUE(user_id, email)
);

CREATE INDEX idx_digest_recipients_user_id ON digest_recipients(user_id);

-- RLS
ALTER TABLE digest_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recipients" ON digest_recipients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipients" ON digest_recipients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipients" ON digest_recipients
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own recipients" ON digest_recipients
  FOR UPDATE USING (auth.uid() = user_id);
