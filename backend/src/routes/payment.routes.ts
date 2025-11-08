import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import CircleService from '../services/circle.service';
import { query } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/payments/schedule
 * Create a recurring payment schedule
 */
router.post('/schedule', asyncHandler(async (req, res) => {
  const {
    contractId,
    payerWalletId,
    payeeWalletId,
    amount,
    frequency,
    startDate,
    conditions
  } = req.body;

  const result = await query(`
    INSERT INTO payment_schedules (
      contract_id, payer_wallet_id, payee_wallet_id,
      amount_usdc, frequency, next_payment_date,
      status, conditions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    contractId,
    payerWalletId,
    payeeWalletId,
    amount,
    frequency,
    startDate || new Date(),
    'active',
    conditions ? JSON.stringify(conditions) : null
  ]);

  logger.info(`Payment schedule created: ${result.rows[0].id}`);

  res.status(201).json({
    success: true,
    schedule: result.rows[0]
  });
}));

/**
 * POST /api/payments/execute
 * Manually execute a payment (conditional or one-time)
 */
router.post('/execute', asyncHandler(async (req, res) => {
  const {
    sourceWalletId,
    destinationWalletId,
    amount,
    contractId,
    metadata
  } = req.body;

  // Execute payment via Circle
  const payment = await CircleService.createPayment({
    sourceWalletId,
    destinationWalletId,
    amount: amount.toString(),
    metadata
  });

  // Log transaction
  await query(`
    INSERT INTO transactions (
      contract_id, tx_hash, from_wallet, to_wallet,
      amount_usdc, type, status, circle_payment_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    contractId,
    payment.txHash || '',
    sourceWalletId,
    destinationWalletId,
    amount,
    'manual',
    'pending',
    payment.id,
    metadata ? JSON.stringify(metadata) : null
  ]);

  res.json({
    success: true,
    payment: {
      id: payment.id,
      txHash: payment.txHash,
      status: payment.state
    }
  });
}));

/**
 * GET /api/payments/upcoming
 * Get upcoming scheduled payments
 */
router.get('/upcoming', asyncHandler(async (req, res) => {
  const { userId, days = 30 } = req.query;

  let queryText = `
    SELECT ps.*, c.asset_description, c.contract_type
    FROM payment_schedules ps
    JOIN rwa_contracts c ON ps.contract_id = c.id
    WHERE ps.status = 'active'
      AND ps.next_payment_date <= NOW() + INTERVAL '${days} days'
  `;
  const params: any[] = [];

  if (userId) {
    queryText += ` AND (c.payer_id = $1 OR c.payee_id = $1)`;
    params.push(userId);
  }

  queryText += ` ORDER BY ps.next_payment_date ASC`;

  const result = await query(queryText, params);

  res.json({
    success: true,
    count: result.rows.length,
    payments: result.rows
  });
}));

/**
 * POST /api/payments/:id/cancel
 * Cancel a scheduled payment
 */
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await query(`
    UPDATE payment_schedules
    SET status = 'cancelled'
    WHERE id = $1
  `, [id]);

  logger.info(`Payment schedule cancelled: ${id}`);

  res.json({
    success: true,
    message: 'Payment schedule cancelled'
  });
}));

/**
 * GET /api/payments/all-transactions
 * Get ALL transactions from Circle (including received funds from faucet, etc.)
 */
router.get('/all-transactions', asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    // Get all user's wallets
    const walletsResult = await query(`
      SELECT circle_wallet_id, circle_wallet_address, wallet_name
      FROM user_wallets
      WHERE user_id = $1
    `, [userId]);

    const wallets = walletsResult.rows;
    
    if (wallets.length === 0) {
      return res.json({ success: true, transactions: [] });
    }

    // Fetch transactions from Circle for ALL wallets
    const allTransactions: any[] = [];
    
    logger.info(`🔍 Fetching transactions for ${wallets.length} wallets`);
    
    for (const wallet of wallets) {
      try {
        logger.info(`📡 Fetching Circle transactions for wallet: ${wallet.circle_wallet_id}`);
        const circleTransactions = await CircleService.getWalletTransactions(wallet.circle_wallet_id, 100);
        
        logger.info(`✅ Got ${circleTransactions.length} transactions from Circle for wallet ${wallet.wallet_name}`);
        
        // Log first transaction for debugging
        if (circleTransactions.length > 0) {
          logger.info(`📝 Sample transaction:`, {
            id: circleTransactions[0].id,
            type: circleTransactions[0].transactionType,
            amount: circleTransactions[0].amounts?.[0],
            state: circleTransactions[0].state
          });
        }
        
        // Map Circle transactions to our format
        circleTransactions.forEach((tx: any) => {
          allTransactions.push({
            id: tx.id,
            type: tx.transactionType, // 'INBOUND' or 'OUTBOUND'
            amount_usdc: tx.amounts?.[0] || '0',
            tx_hash: tx.txHash,
            status: tx.state?.toLowerCase() || 'pending',
            from_wallet: tx.sourceAddress,
            to_wallet: tx.destinationAddress,
            executed_at: tx.createDate,
            wallet_name: wallet.wallet_name
          });
        });
      } catch (error) {
        logger.warn(`Failed to fetch Circle transactions for wallet ${wallet.circle_wallet_id}:`, error);
      }
    }
    
    logger.info(`💰 Total Circle transactions: ${allTransactions.length}`);

    // Also get transactions from our database
    const dbTransactionsResult = await query(`
      SELECT 
        t.*,
        c.asset_description,
        c.contract_type
      FROM transactions t
      LEFT JOIN rwa_contracts c ON t.contract_id = c.id
      WHERE c.payer_id = $1 OR c.payee_id = $1
    `, [userId]);

    // Combine both - DB transactions already have correct format
    const combinedTransactions = [
      ...allTransactions,
      ...dbTransactionsResult.rows
    ].sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());

    logger.info(`📊 Fetched ${combinedTransactions.length} total transactions`);

    res.json({
      success: true,
      count: combinedTransactions.length,
      transactions: combinedTransactions
    });
  } catch (error: any) {
    logger.error('Failed to fetch all transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions'
    });
  }
}));

/**
 * GET /api/payments/history
 * Get payment transaction history
 */
router.get('/history', asyncHandler(async (req, res) => {
  const { userId, contractId, limit = 50, offset = 0 } = req.query;

  let queryText = `
    SELECT t.*, c.asset_description, c.contract_type
    FROM transactions t
    JOIN rwa_contracts c ON t.contract_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (userId) {
    queryText += ` AND (c.payer_id = $${params.length + 1} OR c.payee_id = $${params.length + 1})`;
    params.push(userId);
  }

  if (contractId) {
    queryText += ` AND t.contract_id = $${params.length + 1}`;
    params.push(contractId);
  }

  queryText += ` ORDER BY t.executed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(queryText, params);

  // Fetch real-time status from Circle for each transaction with circle_payment_id
  const transactionsWithRealStatus = await Promise.all(
    result.rows.map(async (tx) => {
      // if (tx.circle_payment_id && tx.status === 'pending') {
        try {
          // Get real-time status from Circle
          const circleStatus = await CircleService.getTransaction(tx.circle_payment_id);
          const circleTransaction = circleStatus.transaction || circleStatus;
          const realStatus = circleTransaction.state?.toLowerCase() || tx.status;
          
          logger.info(`Transaction ${tx.id}: Circle status = ${realStatus}, DB status = ${tx.status}`);
          
          // Update database with real status
          if (realStatus === 'complete' || realStatus === 'failed') {
            const newStatus = realStatus === 'complete' ? 'confirmed' : 'failed';
            await query(`
              UPDATE transactions 
              SET status = $1, tx_hash = $2
              WHERE id = $3
            `, [newStatus, circleTransaction.txHash || tx.tx_hash, tx.id]);
            
            return { ...tx, status: realStatus === 'complete' ? 'confirmed' : 'failed', tx_hash: circleTransaction.txHash || tx.tx_hash };
          }
          
          return { ...tx, status: realStatus };
        } catch (error) {
          logger.warn(`Failed to fetch Circle status for tx ${tx.id}:`, error);
          return tx;
        }
      // }
      return tx;
    })
  );

  res.json({
    success: true,
    count: transactionsWithRealStatus.length,
    transactions: transactionsWithRealStatus
  });
}));

/**
 * GET /api/payments/status/:transactionId
 * Get real-time transaction status from Circle
 */
router.get('/status/:transactionId', asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  logger.info(`📡 Fetching status for transaction: ${transactionId}`);
  
  try {
    // Get transaction from Circle
    const circleTransaction = await CircleService.getTransaction(transactionId);
    
    if (!circleTransaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    logger.info(`✅ Circle transaction state: ${circleTransaction.transaction?.state}`);

    // Update our database if status changed
    const txState = circleTransaction.transaction?.state?.toLowerCase();
    const dbStatus = txState === 'complete' ? 'confirmed' : 
                     txState === 'failed' ? 'failed' : 'pending';

    await query(`
      UPDATE transactions
      SET status = $1, tx_hash = $2
      WHERE circle_payment_id = $3
    `, [
      dbStatus,
      circleTransaction.transaction?.txHash || '',
      transactionId
    ]);

    res.json({
      success: true,
      transaction: {
        id: circleTransaction.transaction?.id,
        state: circleTransaction.transaction?.state,
        txHash: circleTransaction.transaction?.txHash,
        blockchain: circleTransaction.transaction?.blockchain
      }
    });
  } catch (error: any) {
    logger.error('❌ Failed to get transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction status'
    });
  }
}));

export default router;

