-- ============================================
-- FLOE - TEST DATA SEED
-- ============================================
-- This creates mock data for testing the UI
-- No Circle API keys needed!
-- ============================================

-- Clean existing data (in order due to foreign keys)
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE evidence CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE payment_schedules CASCADE;
TRUNCATE TABLE rwa_contracts CASCADE;
TRUNCATE TABLE tokenized_assets CASCADE;
TRUNCATE TABLE users CASCADE;

-- Reset sequences
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE tokenized_assets_id_seq RESTART WITH 1;
ALTER SEQUENCE rwa_contracts_id_seq RESTART WITH 1;
ALTER SEQUENCE payment_schedules_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE evidence_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE audit_logs_id_seq RESTART WITH 1;

-- ============================================
-- USERS (Test Users for Login)
-- ============================================
INSERT INTO users (email, password_hash, full_name, role, circle_wallet_id, circle_entity_id) VALUES
('demo@floe.io', '$2a$10$XYZ...', 'Demo User', 'user', 'wallet_demo_123', 'entity_demo_123'),
('maria@example.com', '$2a$10$ABC...', 'Maria Rodriguez', 'user', 'wallet_maria_456', 'entity_maria_456'),
('john@supplier.com', '$2a$10$DEF...', 'John Supply Co', 'business', 'wallet_john_789', 'entity_john_789'),
('alice@landlord.com', '$2a$10$GHI...', 'Alice Thompson', 'landlord', 'wallet_alice_101', 'entity_alice_101'),
('bob@contractor.com', '$2a$10$JKL...', 'Bob Construction', 'business', 'wallet_bob_202', 'entity_bob_202');

-- ============================================
-- TOKENIZED ASSETS
-- ============================================
INSERT INTO tokenized_assets (asset_type, name, description, token_id, owner_id, valuation_usdc, metadata) VALUES
('real_estate', 'Apartment #405', 'Modern 2BR apartment at 123 Main Street, Downtown', 'TOKEN_APT_405', 4, 250000.00, '{"bedrooms": 2, "bathrooms": 2, "sqft": 1200, "floor": 4}'),
('real_estate', 'Penthouse Suite', 'Luxury 3BR penthouse with city views', 'TOKEN_PENT_801', 4, 850000.00, '{"bedrooms": 3, "bathrooms": 3, "sqft": 2500, "floor": 8}'),
('supply_chain', 'Colombian Coffee Beans Batch #2401', '500kg premium arabica coffee beans', 'TOKEN_COFFEE_2401', 3, 5000.00, '{"weight_kg": 500, "origin": "Colombia", "grade": "Premium"}'),
('treasury', 'US Treasury Bond CUSIP 912828YK0', 'Tokenized 10-year US Treasury Bond', 'TOKEN_BOND_YK0', 1, 100000.00, '{"maturity": "2035-01-15", "coupon_rate": 4.5, "yield": 4.7}'),
('equipment', 'Industrial Generator Model XG-5000', 'Heavy-duty backup generator for data center', 'TOKEN_GEN_5000', 5, 75000.00, '{"capacity_kw": 5000, "hours": 1250, "condition": "Excellent"}');

-- ============================================
-- RWA CONTRACTS
-- ============================================

-- 1. Monthly Rent (Active, Recurring)
INSERT INTO rwa_contracts (
    contract_type, payer_id, payee_id, asset_id, asset_description,
    total_amount_usdc, payment_type, payment_frequency, start_date, end_date,
    status, raw_contract_text, parsed_terms
) VALUES (
    'lease', 2, 4, 1, 'Apartment #405, 123 Main St',
    14400.00, 'recurring', 'monthly', '2024-01-01', '2024-12-31',
    'active',
    'Lease Agreement: Apartment #405. Monthly rent: $1200 USD payable on the 1st of each month. Term: 12 months starting January 1, 2024.',
    '{"amount": 1200, "frequency": "monthly", "day_of_month": 1, "auto_pay": true}'
);

-- 2. Supply Chain Invoice (Pending, Conditional)
INSERT INTO rwa_contracts (
    contract_type, payer_id, payee_id, asset_id, asset_description,
    total_amount_usdc, payment_type, conditions, start_date,
    status, raw_contract_text, parsed_terms
) VALUES (
    'invoice', 1, 3, 3, 'Colombian Coffee Beans Batch #2401',
    5000.00, 'conditional', 'Payment upon delivery confirmation at warehouse', '2024-10-15',
    'pending',
    'Invoice #2401: 500kg coffee beans. Total: $5000. Payment terms: 30% upfront ($1500), 70% on delivery ($3500).',
    '{"upfront_amount": 1500, "on_delivery": 3500, "delivery_location": "San Francisco Warehouse", "tracking_required": true}'
);

-- 3. Treasury Bond Yield (Active, Scheduled)
INSERT INTO rwa_contracts (
    contract_type, payer_id, payee_id, asset_id, asset_description,
    total_amount_usdc, payment_type, payment_frequency, start_date, end_date,
    status, raw_contract_text, parsed_terms
) VALUES (
    'bond', 1, 1, 4, 'US Treasury Bond CUSIP 912828YK0',
    5000.00, 'recurring', 'quarterly', '2024-01-01', '2034-12-31',
    'active',
    'Quarterly interest payment for tokenized Treasury Bond. Annual yield: 4.5%. Quarterly payment: $1125.',
    '{"annual_yield_pct": 4.5, "quarterly_amount": 1125, "payment_months": [1, 4, 7, 10]}'
);

-- 4. Construction Milestone (Active, Milestone)
INSERT INTO rwa_contracts (
    contract_type, payer_id, payee_id, asset_description,
    total_amount_usdc, payment_type, start_date, end_date,
    status, raw_contract_text, parsed_terms
) VALUES (
    'milestone', 1, 5, 'Downtown Office Building - Phase 1',
    500000.00, 'milestone', '2024-06-01', '2025-12-31',
    'active',
    'Construction contract: $500k total. Milestones: Foundation (20%, $100k), Structure (30%, $150k), Interior (30%, $150k), Completion (20%, $100k).',
    '{"milestones": [
        {"name": "Foundation Complete", "percentage": 20, "amount": 100000, "status": "completed"},
        {"name": "Structure Complete", "percentage": 30, "amount": 150000, "status": "in_progress"},
        {"name": "Interior Complete", "percentage": 30, "amount": 150000, "status": "pending"},
        {"name": "Project Completion", "percentage": 20, "amount": 100000, "status": "pending"}
    ]}'
);

-- 5. Equipment Lease with SLA (Active, Conditional)
INSERT INTO rwa_contracts (
    contract_type, payer_id, payee_id, asset_id, asset_description,
    total_amount_usdc, payment_type, payment_frequency, conditions, start_date, end_date,
    status, raw_contract_text, parsed_terms
) VALUES (
    'sla', 1, 5, 5, 'Industrial Generator Model XG-5000',
    30000.00, 'conditional', 'monthly', 'Full payment if uptime >= 95%, prorated if below', '2024-01-01', '2024-12-31',
    'active',
    'Equipment lease: $2500/month. SLA: 95% uptime required. If uptime < 95%, payment prorated. If uptime < 90%, no payment due.',
    '{"base_amount": 2500, "uptime_threshold": 95, "min_uptime": 90, "prorate_formula": "base * (uptime / 100)"}'
);

-- 6. Completed Rent (Historical)
INSERT INTO rwa_contracts (
    contract_type, payer_id, payee_id, asset_id, asset_description,
    total_amount_usdc, payment_type, payment_frequency, start_date, end_date,
    status, raw_contract_text, parsed_terms
) VALUES (
    'lease', 2, 4, 2, 'Penthouse Suite 801',
    36000.00, 'recurring', 'monthly', '2023-01-01', '2023-12-31',
    'completed',
    'Lease Agreement: Penthouse #801. Monthly rent: $3000 USD. Term: 12 months (2023).',
    '{"amount": 3000, "frequency": "monthly", "day_of_month": 1}'
);

-- ============================================
-- PAYMENT SCHEDULES
-- ============================================

-- Schedule for Apartment rent (monthly)
INSERT INTO payment_schedules (
    contract_id, payer_wallet_id, payee_wallet_id, amount_usdc,
    frequency, next_payment_date, last_payment_date, total_paid_usdc,
    payment_count, status
) VALUES (
    1, 'wallet_maria_456', 'wallet_alice_101', 1200.00,
    'monthly', '2024-11-01', '2024-10-01', 12000.00,
    10, 'active'
);

-- Schedule for Treasury Bond (quarterly)
INSERT INTO payment_schedules (
    contract_id, payer_wallet_id, payee_wallet_id, amount_usdc,
    frequency, next_payment_date, last_payment_date, total_paid_usdc,
    payment_count, status
) VALUES (
    3, 'wallet_demo_123', 'wallet_demo_123', 1125.00,
    'quarterly', '2025-01-01', '2024-10-01', 4500.00,
    4, 'active'
);

-- Schedule for Generator lease (monthly with SLA)
INSERT INTO payment_schedules (
    contract_id, payer_wallet_id, payee_wallet_id, amount_usdc,
    frequency, next_payment_date, last_payment_date, total_paid_usdc,
    payment_count, status
) VALUES (
    5, 'wallet_demo_123', 'wallet_bob_202', 2500.00,
    'monthly', '2024-11-01', '2024-10-01', 25000.00,
    10, 'active'
);

-- ============================================
-- TRANSACTIONS (Historical Payments)
-- ============================================

-- Recent rent payments
INSERT INTO transactions (
    contract_id, schedule_id, tx_hash, from_wallet, to_wallet,
    amount_usdc, type, status, circle_payment_id, metadata
) VALUES
(1, 1, '0xabcd1234...', 'wallet_maria_456', 'wallet_alice_101', 1200.00, 'recurring', 'completed', 'pay_oct_rent', '{"month": "October", "on_time": true}'),
(1, 1, '0xef567890...', 'wallet_maria_456', 'wallet_alice_101', 1200.00, 'recurring', 'completed', 'pay_sep_rent', '{"month": "September", "on_time": true}'),
(1, 1, '0x12345678...', 'wallet_maria_456', 'wallet_alice_101', 1200.00, 'recurring', 'completed', 'pay_aug_rent', '{"month": "August", "on_time": true}');

-- Treasury bond payments
INSERT INTO transactions (
    contract_id, schedule_id, tx_hash, from_wallet, to_wallet,
    amount_usdc, type, status, circle_payment_id, metadata
) VALUES
(3, 2, '0x98765432...', 'wallet_demo_123', 'wallet_demo_123', 1125.00, 'recurring', 'completed', 'pay_bond_q4', '{"quarter": "Q4 2024"}'),
(3, 2, '0x45678901...', 'wallet_demo_123', 'wallet_demo_123', 1125.00, 'recurring', 'completed', 'pay_bond_q3', '{"quarter": "Q3 2024"}');

-- Construction milestone payment
INSERT INTO transactions (
    contract_id, tx_hash, from_wallet, to_wallet,
    amount_usdc, type, status, circle_payment_id, metadata
) VALUES
(4, '0xaabbccdd...', 'wallet_demo_123', 'wallet_bob_202', 100000.00, 'milestone', 'completed', 'pay_foundation', '{"milestone": "Foundation Complete", "inspection_date": "2024-08-15"}');

-- Pending/scheduled transactions
INSERT INTO transactions (
    contract_id, schedule_id, from_wallet, to_wallet,
    amount_usdc, type, status, metadata
) VALUES
(1, 1, 'wallet_maria_456', 'wallet_alice_101', 1200.00, 'recurring', 'scheduled', '{"scheduled_for": "2024-11-01"}'),
(2, NULL, 'wallet_demo_123', 'wallet_john_789', 1500.00, 'conditional', 'pending', '{"condition": "upfront_payment"}');

-- ============================================
-- EVIDENCE (For Conditional Payments)
-- ============================================
INSERT INTO evidence (contract_id, transaction_id, evidence_type, uploaded_by, file_url, description, verification_status, metadata) VALUES
(4, 7, 'inspection_report', 5, 'https://storage.paymind.io/evidence/foundation_inspection.pdf', 'Foundation inspection report - Passed', 'verified', '{"inspector": "John Smith PE", "date": "2024-08-15", "pass": true}'),
(2, NULL, 'delivery_tracking', 3, 'https://tracking.fedex.com/12345', 'Shipment in transit to SF warehouse', 'pending', '{"carrier": "FedEx", "tracking": "12345", "eta": "2024-10-25"}');

-- ============================================
-- NOTIFICATIONS
-- ============================================
INSERT INTO notifications (user_id, type, title, message, read) VALUES
(2, 'payment_reminder', 'Rent Due Tomorrow', 'Your rent payment of $1,200 USDC is due tomorrow (Nov 1).', false),
(2, 'payment_success', 'Payment Completed', 'Rent payment of $1,200 USDC was successfully sent.', true),
(1, 'low_balance', 'Low Wallet Balance', 'Your wallet balance is below $5,000 USDC. Please add funds.', false),
(5, 'milestone_completed', 'Milestone Payment Received', 'You received $100,000 USDC for Foundation milestone.', true),
(1, 'contract_created', 'New Contract Created', 'Contract for Coffee Beans Batch #2401 was created.', true);

-- ============================================
-- AUDIT LOGS
-- ============================================
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES
(2, 'login', 'user', 2, '{"ip": "192.168.1.100", "device": "Chrome on Windows"}'),
(1, 'contract_created', 'contract', 2, '{"type": "invoice", "amount": 5000}'),
(2, 'payment_executed', 'transaction', 1, '{"amount": 1200, "status": "completed"}'),
(4, 'wallet_created', 'wallet', 4, '{"wallet_id": "wallet_alice_101"}'),
(5, 'evidence_uploaded', 'evidence', 1, '{"type": "inspection_report"}');

-- ============================================
-- SUMMARY
-- ============================================
-- Test Users Created: 5
-- Tokenized Assets: 5
-- Contracts: 6 (4 active, 1 pending, 1 completed)
-- Payment Schedules: 3
-- Transactions: 9 (7 completed, 1 scheduled, 1 pending)
-- Evidence: 2
-- Notifications: 5
-- Audit Logs: 5
--
-- Login Credentials (use these for testing):
-- Email: demo@paymind.io | Password: demo123
-- Email: maria@example.com | Password: maria123
-- ============================================

SELECT 'Seed data created successfully!' AS status,
       (SELECT COUNT(*) FROM users) AS users_count,
       (SELECT COUNT(*) FROM rwa_contracts) AS contracts_count,
       (SELECT COUNT(*) FROM transactions) AS transactions_count,
       (SELECT COUNT(*) FROM tokenized_assets) AS assets_count;

