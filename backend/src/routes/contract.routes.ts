import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { query } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/contracts/register
 * Register a new RWA contract
 */
router.post('/register', asyncHandler(async (req, res) => {
  const {
    contract_type,
    contract_name,
    description,
    counterparty_name,
    counterparty_address,
    amount_usdc,
    payment_frequency,
    payment_day_of_month,
    start_date,
    end_date
  } = req.body;

  // Get user ID from JWT token (from auth middleware)
  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  logger.info(`💰 POST /api/contracts/register - Creating contract for userId: ${userId}`);
  logger.info(`📅 Received dates:`, {
    start_date,
    end_date,
    payment_day_of_month
  });

  // Validate required fields
  if (!contract_type || !contract_name || !counterparty_address || !amount_usdc || !payment_frequency || !start_date) {
    logger.error(`❌ Missing required fields:`, {
      contract_type: !!contract_type,
      contract_name: !!contract_name,
      counterparty_address: !!counterparty_address,
      amount_usdc: !!amount_usdc,
      payment_frequency: !!payment_frequency,
      start_date: !!start_date
    });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Calculate next payment date based on frequency
  const calculateNextPayment = (startDate: string, frequency: string, dayOfMonth?: string) => {
    const start = new Date(startDate);
    const today = new Date();
    
    if (frequency === 'one_time') {
      return startDate;
    }
    
    if (frequency === 'monthly' && dayOfMonth) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, parseInt(dayOfMonth));
      return nextMonth.toISOString().split('T')[0];
    }
    
    // For other frequencies, return start_date + frequency interval
    return startDate;
  };

  const nextPaymentDate = calculateNextPayment(start_date, payment_frequency, payment_day_of_month);

  const result = await query(`
    INSERT INTO rwa_contracts (
      contract_type, payer_id, asset_description,
      total_amount_usdc, payment_type, 
      raw_contract_text, status, start_date, end_date, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING *
  `, [
    contract_type,
    userId, // This is the payer (person creating the contract)
    `${contract_name} - ${counterparty_name} - ${description || 'No description'}`,
    amount_usdc,
    payment_frequency, // one_time, monthly, etc.
    JSON.stringify({
      contract_name,
      counterparty_name,
      counterparty_address,
      payment_day_of_month: payment_day_of_month || null,
      start_date,
      end_date: end_date || null
    }),
    'active',
    start_date,
    end_date || null
  ]);

  logger.info(`✅ Contract created successfully!`);
  logger.info(`📋 Contract ID: ${result.rows[0].id}`);
  logger.info(`👤 Payer ID: ${result.rows[0].payer_id}`);
  logger.info(`💰 Amount: ${result.rows[0].total_amount_usdc} USDC`);
  logger.info(`📅 Type: ${result.rows[0].contract_type}`);

  const createdContract = result.rows[0];

  // Create payment schedule for recurring contracts
  if (payment_frequency !== 'one_time') {
    try {
      // Get user's primary wallet
      const userWallet = await query(`
        SELECT circle_wallet_id FROM users WHERE id = $1
      `, [userId]);

      if (userWallet.rows[0]?.circle_wallet_id) {
        const scheduleResult = await query(`
          INSERT INTO payment_schedules (
            contract_id, payer_wallet_id, payee_wallet_id,
            amount_usdc, frequency, next_payment_date,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          createdContract.id,
          userWallet.rows[0].circle_wallet_id,
          counterparty_address,
          amount_usdc,
          payment_frequency,
          nextPaymentDate,
          'active'
        ]);

        logger.info(`📅 Payment schedule created: ${scheduleResult.rows[0].id}`);
        logger.info(`📆 Next payment date: ${nextPaymentDate}`);
      } else {
        logger.warn(`⚠️ No wallet found for user ${userId}, payment schedule not created`);
      }
    } catch (error) {
      logger.error('Failed to create payment schedule:', error);
      // Don't fail contract creation if schedule creation fails
    }
  }

  res.status(201).json({
    success: true,
    message: 'Contract created successfully',
    contract: createdContract
  });
}));

/**
 * GET /api/contracts/:id
 * Get contract by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = (req as any).user?.userId;

  logger.info(`🔍 GET /api/contracts/${id} - Requested by userId: ${userId}`);

  const result = await query(`
    SELECT c.*, 
           u1.email as payer_email,
           u2.email as payee_email
    FROM rwa_contracts c
    LEFT JOIN users u1 ON c.payer_id = u1.id
    LEFT JOIN users u2 ON c.payee_id = u2.id
    WHERE c.id = $1
  `, [id]);

  logger.info(`📊 Query result: Found ${result.rows.length} contracts`);
  
  if (result.rows.length > 0) {
    logger.info(`📋 Contract found:`, {
      id: result.rows[0].id,
      payer_id: result.rows[0].payer_id,
      contract_type: result.rows[0].contract_type
    });
  }

  if (result.rows.length === 0) {
    logger.warn(`❌ Contract not found with id: ${id}`);
    return res.status(404).json({ error: 'Contract not found' });
  }

  res.json({
    success: true,
    contract: result.rows[0]
  });
}));

/**
 * GET /api/contracts
 * List all contracts for the authenticated user
 */
router.get('/', asyncHandler(async (req, res) => {
  // Get user ID from JWT token
  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  logger.info(`🔍 GET /api/contracts - Fetching for userId: ${userId}`);

  const { status, contract_type } = req.query;

  let queryText = `
    SELECT *
    FROM rwa_contracts
    WHERE payer_id = $1
  `;
  const params: any[] = [userId];

  if (status) {
    queryText += ` AND status = $${params.length + 1}`;
    params.push(status);
  }

  if (contract_type) {
    queryText += ` AND contract_type = $${params.length + 1}`;
    params.push(contract_type);
  }

  queryText += ` ORDER BY created_at DESC`;

  logger.info(`📝 SQL: ${queryText.replace(/\s+/g, ' ').trim()}`);
  logger.info(`📊 Params: ${JSON.stringify(params)}`);

  const result = await query(queryText, params);

  logger.info(`✅ Found ${result.rows.length} contracts`);
  if (result.rows.length > 0) {
    logger.info(`📋 First contract payer_id: ${result.rows[0].payer_id}, contract_type: ${result.rows[0].contract_type}`);
  }

  res.json({
    success: true,
    count: result.rows.length,
    contracts: result.rows
  });
}));

/**
 * POST /api/contracts/:id/parse
 * Parse contract with AI
 */
router.post('/:id/parse', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // TODO: Implement AI parsing logic
  // This will call Cloudflare Workers AI to extract payment terms

  res.json({
    success: true,
    message: 'AI parsing not yet implemented',
    contractId: id
  });
}));

/**
 * PATCH /api/contracts/:id/status
 * Update contract status (pause, cancel, etc.)
 */
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = (req as any).user.userId;

  logger.info(`Updating contract ${id} status to: ${status}`);

  // Validate status
  const validStatuses = ['active', 'paused', 'completed', 'cancelled', 'disputed'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid status value', 400);
  }

  // Verify user owns the contract
  const checkResult = await query(`
    SELECT id FROM rwa_contracts
    WHERE id = $1 AND payer_id = $2
  `, [id, userId]);

  if (checkResult.rows.length === 0) {
    throw new AppError('Contract not found or unauthorized', 404);
  }

  // Update status
  const result = await query(`
    UPDATE rwa_contracts
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [status, id]);

  logger.info(`✅ Contract ${id} status updated to: ${status}`);

  res.json({
    success: true,
    contract: result.rows[0]
  });
}));

export default router;

