import { Router, Request, Response } from 'express';
import A2AService from '../services/a2a.service';
import AgentDecisionService from '../services/agent-decision.service';
import logger from '../utils/logger';
import { authMiddleware as authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';

const router = Router();

/**
 * A2A (Agent-to-Agent) Payment Routes
 * Enables autonomous payment requests and settlements
 */

/**
 * POST /api/contracts/:id/enable-a2a
 * Enable A2A for a specific contract
 */
router.post('/contracts/:id/enable-a2a', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id: contractId } = req.params;
    const { approvalMode = 'manual' } = req.body; // 'manual' or 'auto'
    const userId = (req as any).user?.id;

    logger.info(`🤖 Enabling A2A for contract ${contractId}`, { approvalMode, userId });

    // Verify user owns this contract (user must be the payer)
    const contractCheck = await query(
      'SELECT * FROM rwa_contracts WHERE id = $1 AND payer_id = $2',
      [contractId, userId]
    );

    if (!contractCheck.rows || contractCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found or access denied'
      });
    }

    // Enable A2A
    await query(
      'UPDATE rwa_contracts SET a2a_enabled = TRUE, a2a_approval_mode = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [approvalMode, contractId]
    );

    logger.info(`✅ A2A enabled for contract ${contractId}`);

    res.json({
      success: true,
      message: `A2A ${approvalMode} mode enabled successfully`,
      contract: {
        id: contractId,
        a2a_enabled: true,
        a2a_approval_mode: approvalMode
      }
    });
  } catch (error: any) {
    logger.error('❌ Enable A2A Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/contracts/:id/disable-a2a
 * Disable A2A for a specific contract
 */
router.post('/contracts/:id/disable-a2a', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id: contractId } = req.params;
    const userId = (req as any).user?.id;

    logger.info(`🚫 Disabling A2A for contract ${contractId}`);

    // Verify user owns this contract (user must be the payer)
    const contractCheck = await query(
      'SELECT * FROM rwa_contracts WHERE id = $1 AND payer_id = $2',
      [contractId, userId]
    );

    if (!contractCheck.rows || contractCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found or access denied'
      });
    }

    // Disable A2A
    await query(
      'UPDATE rwa_contracts SET a2a_enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [contractId]
    );

    logger.info(`✅ A2A disabled for contract ${contractId}`);

    res.json({
      success: true,
      message: 'A2A disabled successfully',
      contract: {
        id: contractId,
        a2a_enabled: false
      }
    });
  } catch (error: any) {
    logger.error('❌ Disable A2A Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/a2a/requests
 * Get all A2A payment requests for the authenticated user
 */
router.get('/requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { status, limit = 50 } = req.query;

    logger.info(`📋 Fetching A2A requests for user ${userId}`);

    let queryText = `
      SELECT 
        a.*,
        c.asset_description as contract_title
      FROM a2a_requests a
      LEFT JOIN rwa_contracts c ON a.contract_id = c.id
      WHERE c.user_id = $1
    `;
    const queryParams: any[] = [userId];

    if (status) {
      queryText += ` AND a.status = $2`;
      queryParams.push(status);
    }

    queryText += ` ORDER BY a.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      requests: result.rows || [],
      count: result.rows?.length || 0
    });
  } catch (error: any) {
    logger.error('❌ Get Requests Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/a2a/decide
 * AI Agent makes a decision on a payment request
 */
router.post('/decide', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contractId, paymentRequest } = req.body;
    const userId = (req as any).user?.id;

    logger.info(`🤖 Agent deciding on payment for contract ${contractId}`);

    // Get contract details
    const contractResult = await query(
      `SELECT * FROM rwa_contracts WHERE id = $1 AND user_id = $2`,
      [contractId, userId]
    );

    if (!contractResult.rows || contractResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }

    const contract = contractResult.rows[0];

    // Check if A2A is enabled
    if (!contract.a2a_enabled) {
      return res.status(400).json({
        success: false,
        error: 'A2A is not enabled for this contract'
      });
    }

    // Parse contract terms
    let rawContractData: any = {};
    try {
      rawContractData = typeof contract.raw_contract_text === 'string'
        ? JSON.parse(contract.raw_contract_text)
        : contract.raw_contract_text || {};
    } catch (e) {
      logger.error('Failed to parse contract data');
    }

    const contractTerms = {
      amount: contract.total_amount_usdc || rawContractData.amount || '0',
      paymentType: contract.payment_type || 'one_time',
      frequency: contract.payment_type || 'monthly',
      counterpartyAddress: rawContractData.counterparty_address || '',
      startDate: contract.start_date || new Date().toISOString(),
      endDate: contract.end_date
    };

    // Get AI agent decision
    const decision = await AgentDecisionService.shouldApprovePayment(
      {
        amount: paymentRequest.amount,
        fromAddress: paymentRequest.fromAddress,
        toAddress: paymentRequest.toAddress,
        network: paymentRequest.network,
        description: paymentRequest.description || 'Payment request',
        requestedAt: new Date()
      },
      contractTerms,
      contract.a2a_approval_mode
    );

    logger.info(`🤖 Agent Decision: ${decision.approved ? 'APPROVED' : 'REJECTED'}`);

    res.json({
      success: true,
      decision,
      message: decision.approved ? 'Payment approved by AI agent' : 'Payment rejected by AI agent'
    });
  } catch (error: any) {
    logger.error('❌ Agent Decision Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/a2a/activity-log
 * Get activity log for A2A operations
 */
router.get('/activity-log', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { contractId, limit = 50 } = req.query;

    logger.info(`📜 Fetching A2A activity log for user ${userId}`);

    let queryText = `
      SELECT 
        a.*,
        c.asset_description as contract_title
      FROM a2a_requests a
      LEFT JOIN rwa_contracts c ON a.contract_id = c.id
      WHERE c.user_id = $1
    `;
    const queryParams: any[] = [userId];

    if (contractId) {
      queryText += ` AND a.contract_id = $2`;
      queryParams.push(contractId);
    }

    queryText += ` ORDER BY a.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      activities: result.rows || [],
      count: result.rows?.length || 0
    });
  } catch (error: any) {
    logger.error('❌ Activity Log Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/a2a/request
 * Create a payment request (Merchant/Payee side)
 */
router.post('/request', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contractId, amount, description, fromWalletId, toWalletAddress, network } = req.body;

    logger.info(`🤖 A2A Payment Request Received`);
    logger.info(`   Contract: ${contractId}`);
    logger.info(`   Amount: ${amount} USDC`);

    // Validate inputs
    if (!contractId || !amount || !toWalletAddress || !network) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contractId, amount, toWalletAddress, network'
      });
    }

    // Create payment request
    const paymentRequest = A2AService.createPaymentRequest({
      contractId,
      amount,
      description: description || 'Payment request',
      fromWalletId,
      toWalletAddress,
      network
    });

    logger.info(`✅ A2A Payment Request Created`);

    res.json({
      success: true,
      paymentRequest,
      message: 'Payment request created. Client agent should process this.'
    });
  } catch (error: any) {
    logger.error(`❌ A2A Request Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/a2a/process
 * Process a payment request (Client/Payer side)
 * 
 * Body:
 * {
 *   "paymentRequest": { ...x402 requirements },
 *   "walletId": "payer-wallet-id",
 *   "autoApprove": true
 * }
 */
router.post('/process', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paymentRequest, walletId, autoApprove } = req.body;

    logger.info(`🤖 A2A Payment Processing Request`);
    logger.info(`   Wallet: ${walletId}`);
    logger.info(`   Amount: ${paymentRequest.maxAmountRequired} atomic units`);
    logger.info(`   Auto-approve: ${autoApprove}`);

    // Validate inputs
    if (!paymentRequest || !walletId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: paymentRequest, walletId'
      });
    }

    // Extract contract ID from resource URL
    const contractId = paymentRequest.resource?.split('/').pop();

    // Verify payment request matches contract terms
    const isValid = await A2AService.verifyPaymentRequest(paymentRequest, contractId);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Payment request does not match contract terms'
      });
    }

    // If not auto-approve, return for user confirmation
    if (!autoApprove) {
      return res.json({
        success: true,
        requiresConfirmation: true,
        paymentRequest,
        message: 'Payment requires user confirmation'
      });
    }

    // Process payment
    const result = await A2AService.processPaymentRequest(paymentRequest, walletId);

    logger.info(`✅ A2A Payment Processed Successfully`);

    res.json({
      success: true,
      payment: result,
      message: 'Payment completed successfully'
    });
  } catch (error: any) {
    logger.error(`❌ A2A Process Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/a2a/verify
 * Verify a payment request against contract terms
 * 
 * Body:
 * {
 *   "paymentRequest": { ...x402 requirements },
 *   "contractId": "uuid"
 * }
 */
router.post('/verify', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paymentRequest, contractId } = req.body;

    logger.info(`🔍 A2A Payment Verification Request`);
    logger.info(`   Contract: ${contractId}`);

    if (!paymentRequest || !contractId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: paymentRequest, contractId'
      });
    }

    const isValid = await A2AService.verifyPaymentRequest(paymentRequest, contractId);

    res.json({
      success: true,
      isValid,
      message: isValid ? 'Payment request is valid' : 'Payment request is invalid'
    });
  } catch (error: any) {
    logger.error(`❌ A2A Verify Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/a2a/status/:paymentId
 * Get status of an A2A payment
 */
router.get('/status/:paymentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    logger.info(`📊 A2A Payment Status Request: ${paymentId}`);

    // TODO: Implement payment status tracking in database
    // For now, return a placeholder

    res.json({
      success: true,
      paymentId,
      status: 'completed',
      message: 'Payment status retrieved (placeholder)'
    });
  } catch (error: any) {
    logger.error(`❌ A2A Status Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

