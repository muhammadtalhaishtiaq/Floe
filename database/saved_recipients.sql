-- Saved Recipients Table
-- For storing frequently used payment recipients

CREATE TABLE IF NOT EXISTS saved_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_name VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  nickname VARCHAR(100), -- Optional friendly name like "John", "Mom", "Landlord"
  notes TEXT, -- Optional notes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_saved_recipients_user_id ON saved_recipients(user_id);
CREATE INDEX idx_saved_recipients_nickname ON saved_recipients(nickname);

-- Prevent duplicate recipients for same user
CREATE UNIQUE INDEX idx_saved_recipients_user_address ON saved_recipients(user_id, wallet_address);

COMMENT ON TABLE saved_recipients IS 'Stores saved payment recipients for easy voice/UI selection';
COMMENT ON COLUMN saved_recipients.recipient_name IS 'Full name of the recipient';
COMMENT ON COLUMN saved_recipients.nickname IS 'Short name for voice commands (e.g., "John", "Mom")';
COMMENT ON COLUMN saved_recipients.wallet_address IS 'Blockchain wallet address';

