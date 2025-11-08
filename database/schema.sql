-- PayMind RWA Database Schema
-- PostgreSQL Database Schema for Real-World Asset Payment Automation

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  wallet_address TEXT,
  circle_wallet_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user', -- 'payer' | 'payee' | 'admin' | 'user'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_circle_wallet ON users(circle_wallet_id);

-- ============================================
-- TOKENIZED ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tokenized_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL, -- 'real_estate' | 'invoice' | 'bond' | 'equipment' | 'inventory'
  asset_name TEXT NOT NULL,
  token_id TEXT, -- NFT token ID if applicable
  owner_id UUID REFERENCES users(id),
  valuation_usdc DECIMAL(18,6),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_owner ON tokenized_assets(owner_id);
CREATE INDEX idx_assets_type ON tokenized_assets(asset_type);

-- ============================================
-- RWA CONTRACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rwa_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type TEXT NOT NULL, -- 'lease' | 'invoice' | 'bond' | 'milestone' | 'sla'
  payer_id UUID REFERENCES users(id),
  payee_id UUID REFERENCES users(id),
  asset_id TEXT, -- Reference to tokenized asset (optional)
  asset_description TEXT,
  total_amount_usdc DECIMAL(18,6) NOT NULL,
  payment_type TEXT NOT NULL, -- 'one_time' | 'recurring' | 'conditional' | 'milestone'
  raw_contract_text TEXT, -- Original contract for AI parsing
  parsed_terms JSONB, -- AI-extracted payment logic
  status TEXT DEFAULT 'active', -- 'active' | 'completed' | 'cancelled' | 'disputed'
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contracts_payer ON rwa_contracts(payer_id);
CREATE INDEX idx_contracts_payee ON rwa_contracts(payee_id);
CREATE INDEX idx_contracts_status ON rwa_contracts(status);
CREATE INDEX idx_contracts_type ON rwa_contracts(contract_type);

-- ============================================
-- PAYMENT SCHEDULES TABLE (for recurring payments)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES rwa_contracts(id),
  payer_wallet_id TEXT NOT NULL,
  payee_wallet_id TEXT NOT NULL,
  amount_usdc DECIMAL(18,6) NOT NULL,
  frequency TEXT NOT NULL, -- 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom'
  cron_expression TEXT, -- For custom schedules
  next_payment_date TIMESTAMP NOT NULL,
  last_payment_date TIMESTAMP,
  status TEXT DEFAULT 'active', -- 'active' | 'paused' | 'completed' | 'failed'
  failure_count INT DEFAULT 0,
  conditions JSONB, -- Conditional logic (e.g., "uptime >= 95%")
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schedules_contract ON payment_schedules(contract_id);
CREATE INDEX idx_schedules_next_payment ON payment_schedules(next_payment_date);
CREATE INDEX idx_schedules_status ON payment_schedules(status);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES rwa_contracts(id),
  schedule_id UUID REFERENCES payment_schedules(id),
  tx_hash TEXT,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount_usdc DECIMAL(18,6) NOT NULL,
  type TEXT NOT NULL, -- 'scheduled' | 'conditional' | 'milestone' | 'manual' | 'refund'
  status TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'failed'
  circle_payment_id TEXT,
  metadata JSONB, -- Additional context (milestone %, tracking #, etc.)
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_contract ON transactions(contract_id);
CREATE INDEX idx_transactions_schedule ON transactions(schedule_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet);
CREATE INDEX idx_transactions_executed_at ON transactions(executed_at);

-- ============================================
-- EVIDENCE TABLE (for conditional payments)
-- ============================================
CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES rwa_contracts(id),
  submitted_by UUID REFERENCES users(id),
  evidence_type TEXT NOT NULL, -- 'document' | 'tracking' | 'sensor_data' | 'inspection' | 'photo'
  file_url TEXT,
  raw_data JSONB,
  ai_analysis JSONB, -- AI verdict: { verified: true, confidence: 0.92, ... }
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_evidence_contract ON evidence(contract_id);
CREATE INDEX idx_evidence_submitted_by ON evidence(submitted_by);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL, -- 'payment_success' | 'low_balance' | 'payment_failed' | 'condition_met' | 'reminder'
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID,
  user_id UUID,
  action TEXT NOT NULL, -- 'contract_created' | 'payment_executed' | 'condition_evaluated' | etc.
  details JSONB,
  ip_address TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_contract ON audit_logs(contract_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active contracts with next payment info
CREATE OR REPLACE VIEW active_contracts_with_payments AS
SELECT 
  c.*,
  ps.next_payment_date,
  ps.amount_usdc as next_payment_amount,
  ps.frequency,
  u1.email as payer_email,
  u2.email as payee_email
FROM rwa_contracts c
LEFT JOIN payment_schedules ps ON c.id = ps.contract_id AND ps.status = 'active'
JOIN users u1 ON c.payer_id = u1.id
JOIN users u2 ON c.payee_id = u2.id
WHERE c.status = 'active';

-- View: User payment summary
CREATE OR REPLACE VIEW user_payment_summary AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(DISTINCT c.id) as total_contracts,
  COUNT(DISTINCT CASE WHEN c.payer_id = u.id THEN c.id END) as contracts_as_payer,
  COUNT(DISTINCT CASE WHEN c.payee_id = u.id THEN c.id END) as contracts_as_payee,
  COALESCE(SUM(CASE WHEN t.from_wallet = u.circle_wallet_id THEN t.amount_usdc ELSE 0 END), 0) as total_paid,
  COALESCE(SUM(CASE WHEN t.to_wallet = u.circle_wallet_id THEN t.amount_usdc ELSE 0 END), 0) as total_received
FROM users u
LEFT JOIN rwa_contracts c ON u.id = c.payer_id OR u.id = c.payee_id
LEFT JOIN transactions t ON c.id = t.contract_id AND t.status = 'confirmed'
GROUP BY u.id, u.email;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-update updated_at for rwa_contracts
CREATE TRIGGER update_rwa_contracts_updated_at BEFORE UPDATE
ON rwa_contracts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger: Auto-update updated_at for users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE
ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- SEED DATA (for testing)
-- ============================================

-- Sample users
INSERT INTO users (email, role) VALUES
  ('maria@example.com', 'payer'),
  ('landlord@example.com', 'payee'),
  ('supplier@example.com', 'payee'),
  ('admin@paymind.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Sample tokenized asset
INSERT INTO tokenized_assets (asset_type, asset_name, owner_id, valuation_usdc) VALUES
  ('real_estate', 'Apartment #405, 123 Main St', (SELECT id FROM users WHERE email = 'landlord@example.com' LIMIT 1), 250000.00)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE users IS 'Users of the PayMind RWA platform';
COMMENT ON TABLE rwa_contracts IS 'Real-world asset contracts with payment terms';
COMMENT ON TABLE payment_schedules IS 'Recurring payment schedules managed by CRON';
COMMENT ON TABLE transactions IS 'USDC payment transaction logs on Arc blockchain';
COMMENT ON TABLE evidence IS 'Evidence submitted for conditional payment verification';
COMMENT ON TABLE notifications IS 'User notifications for payment events';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all system actions';

