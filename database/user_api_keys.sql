-- User API Keys Table
-- For storing encrypted API keys per user

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_name VARCHAR(50) NOT NULL, -- 'elevenlabs', 'cloudflare', 'openai', etc.
  api_key_encrypted TEXT NOT NULL, -- Encrypted API key
  additional_config JSONB, -- For extra config like account_id for Cloudflare
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_service ON user_api_keys(service_name);

-- Ensure one key per service per user
CREATE UNIQUE INDEX idx_user_api_keys_user_service ON user_api_keys(user_id, service_name);

COMMENT ON TABLE user_api_keys IS 'Stores encrypted API keys for external services per user';
COMMENT ON COLUMN user_api_keys.service_name IS 'Service identifier: elevenlabs, cloudflare, openai';
COMMENT ON COLUMN user_api_keys.api_key_encrypted IS 'Encrypted API key using AES-256';
COMMENT ON COLUMN user_api_keys.additional_config IS 'JSON config for service-specific settings';

