-- Migration: Create A2A (Agent-to-Agent) Payment Requests Table
-- Purpose: Track autonomous payment requests between AI agents
-- Based on x402 protocol: https://github.com/dabit3/a2a-x402-typescript

CREATE TABLE IF NOT EXISTS a2a_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contract reference
  contract_id UUID REFERENCES rwa_contracts(id) ON DELETE CASCADE,
  
  -- Agent information
  from_agent_wallet_id TEXT NOT NULL, -- Payer's wallet ID
  to_agent_wallet_address TEXT NOT NULL, -- Payee's wallet address
  
  -- Payment details
  amount DECIMAL(20, 6) NOT NULL, -- Amount in USDC
  network TEXT NOT NULL, -- 'ARC-TESTNET', 'BASE-SEPOLIA', etc.
  description TEXT,
  
  -- x402 protocol details
  payment_requirements JSONB, -- Full x402 payment requirements object
  payment_signature TEXT, -- Signed payment authorization
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected', 'failed'
  
  -- Transaction details
  transaction_id TEXT, -- Circle transaction ID
  transaction_hash TEXT, -- Blockchain transaction hash
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  paid_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_a2a_requests_contract_id ON a2a_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_a2a_requests_from_wallet ON a2a_requests(from_agent_wallet_id);
CREATE INDEX IF NOT EXISTS idx_a2a_requests_to_wallet ON a2a_requests(to_agent_wallet_address);
CREATE INDEX IF NOT EXISTS idx_a2a_requests_status ON a2a_requests(status);
CREATE INDEX IF NOT EXISTS idx_a2a_requests_created_at ON a2a_requests(created_at DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_a2a_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_a2a_requests_updated_at
  BEFORE UPDATE ON a2a_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_a2a_requests_updated_at();

-- Comments for documentation
COMMENT ON TABLE a2a_requests IS 'Tracks Agent-to-Agent (A2A) payment requests using x402 protocol';
COMMENT ON COLUMN a2a_requests.payment_requirements IS 'Full x402 payment requirements object from merchant agent';
COMMENT ON COLUMN a2a_requests.payment_signature IS 'Signed payment authorization from client agent';
COMMENT ON COLUMN a2a_requests.status IS 'Payment status: pending, approved, paid, rejected, failed';

