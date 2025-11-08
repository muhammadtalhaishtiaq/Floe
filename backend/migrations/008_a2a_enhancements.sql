-- Migration 008: A2A Enhancements
-- Add A2A fields to contracts and a2a_requests tables

-- Add A2A columns to contracts table
ALTER TABLE rwa_contracts 
  ADD COLUMN IF NOT EXISTS a2a_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS a2a_approval_mode TEXT DEFAULT 'manual' CHECK (a2a_approval_mode IN ('manual', 'auto'));

-- Add agent decision log to a2a_requests table
ALTER TABLE a2a_requests 
  ADD COLUMN IF NOT EXISTS agent_decision_log JSONB,
  ADD COLUMN IF NOT EXISTS contract_title TEXT;

-- Create index for faster A2A contract lookups
CREATE INDEX IF NOT EXISTS idx_contracts_a2a_enabled ON rwa_contracts(a2a_enabled) WHERE a2a_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_a2a_requests_status ON a2a_requests(status);
CREATE INDEX IF NOT EXISTS idx_a2a_requests_contract ON a2a_requests(contract_id);

-- Add comment explaining A2A fields
COMMENT ON COLUMN rwa_contracts.a2a_enabled IS 'Whether autonomous agent-to-agent payments are enabled for this contract';
COMMENT ON COLUMN rwa_contracts.a2a_approval_mode IS 'Approval mode: manual (requires user approval) or auto (AI agent decides)';
COMMENT ON COLUMN a2a_requests.agent_decision_log IS 'JSON log of AI agent decision-making process including reasoning';
COMMENT ON COLUMN a2a_requests.contract_title IS 'Cached contract title for faster display';


