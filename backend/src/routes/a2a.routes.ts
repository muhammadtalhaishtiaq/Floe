import { Router, Request, Response } from 'express';
import A2AService from '../services/a2a.service';
import AgentDecisionService from '../services/agent-decision.service';
import CircleService from '../services/circle.service';
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
    const userId = (req as any).user?.userId || (req as any).user?.id; // FIX: Check both userId and id

    logger.info(`🤖 Enabling A2A for contract ${contractId}`, { 
      approvalMode, 
      userId,
      userObject: (req as any).user
    });

    // First, check if contract exists at all
    const contractExistsCheck = await query(
      'SELECT id, payer_id, payee_id, asset_description FROM rwa_contracts WHERE id = $1',
      [contractId]
    );

    logger.info('📋 Contract lookup result:', {
      contractId,
      found: contractExistsCheck.rows?.length || 0,
      contractData: contractExistsCheck.rows?.[0] || null
    });

    if (!contractExistsCheck.rows || contractExistsCheck.rows.length === 0) {
      logger.error(`❌ Contract ${contractId} not found in database`);
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }

    const contract = contractExistsCheck.rows[0];

    logger.info('🔍 Ownership check:', {
      userId,
      contractPayerId: contract.payer_id,
      contractPayeeId: contract.payee_id,
      isUserPayer: contract.payer_id === userId,
      isUserPayee: contract.payee_id === userId
    });

    // Verify user owns this contract (user must be either payer or payee)
    if (contract.payer_id !== userId && contract.payee_id !== userId) {
      logger.error(`❌ User ${userId} does not own contract ${contractId}`, {
        contractPayerId: contract.payer_id,
        contractPayeeId: contract.payee_id,
        requestingUserId: userId
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied - you do not own this contract'
      });
    }

    logger.info(`✅ Contract ownership verified for user ${userId}`);

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
    const userId = (req as any).user?.userId || (req as any).user?.id;

    logger.info(`🚫 Disabling A2A for contract ${contractId}`);

    // First, check if contract exists at all
    const contractExistsCheck = await query(
      'SELECT id, payer_id, payee_id, asset_description FROM rwa_contracts WHERE id = $1',
      [contractId]
    );

    if (!contractExistsCheck.rows || contractExistsCheck.rows.length === 0) {
      logger.error(`❌ Contract ${contractId} not found in database`);
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }

    const contract = contractExistsCheck.rows[0];

    // Verify user owns this contract (user must be either payer or payee)
    if (contract.payer_id !== userId && contract.payee_id !== userId) {
      logger.error(`❌ User ${userId} does not own contract ${contractId}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied - you do not own this contract'
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
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { status, limit = 50 } = req.query;

    logger.info(`📋 Fetching A2A requests for user ${userId}`);

    let queryText = `
      SELECT 
        a.*,
        c.asset_description as contract_title,
        c.payer_id,
        c.payee_id
      FROM a2a_requests a
      LEFT JOIN rwa_contracts c ON a.contract_id = c.id
      WHERE (c.payer_id = $1 OR c.payee_id = $1)
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
    const userId = (req as any).user?.userId || (req as any).user?.id;

    logger.info(`🤖 Agent deciding on payment for contract ${contractId}`);

    // Get contract details
    const contractResult = await query(
      `SELECT * FROM rwa_contracts WHERE id = $1`,
      [contractId]
    );

    if (!contractResult.rows || contractResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }

    const contract = contractResult.rows[0];

    // Verify user owns this contract (must be payer or payee)
    if (contract.payer_id !== userId && contract.payee_id !== userId) {
      logger.error(`❌ User ${userId} does not own contract ${contractId}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied - you do not own this contract'
      });
    }

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
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { contractId, limit = 50 } = req.query;

    logger.info(`📜 Fetching A2A activity log for user ${userId}`);

    let queryText = `
      SELECT 
        a.*,
        c.asset_description as contract_title,
        c.payer_id,
        c.payee_id
      FROM a2a_requests a
      LEFT JOIN rwa_contracts c ON a.contract_id = c.id
      WHERE (c.payer_id = $1 OR c.payee_id = $1)
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
    const userId = (req as any).user?.userId || (req as any).user?.id;

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

    // Create payment request in database
    const insertQuery = `
      INSERT INTO a2a_requests (
        contract_id,
        from_agent_wallet_id,
        to_agent_wallet_address,
        amount,
        network,
        description,
        status,
        payment_requirements,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      contractId,
      fromWalletId || 'unknown',
      toWalletAddress,
      amount,
      network,
      description || 'Payment request',
      'pending',
      JSON.stringify({})
    ]);

    const paymentRequest = result.rows![0];

    logger.info(`✅ A2A Payment Request Created with ID: ${paymentRequest.id}`);

    // 🤖 AUTO-TRIGGER AGENT EVALUATION (THE MAGIC!)
    logger.info(`🤖 Triggering automatic agent evaluation...`);
    
    try {
      // Get contract details
      const contractResult = await query(
        `SELECT * FROM rwa_contracts WHERE id = $1`,
        [contractId]
      );

      if (contractResult.rows && contractResult.rows.length > 0) {
        const contract = contractResult.rows[0];

        // Check if A2A is enabled
        if (contract.a2a_enabled) {
          logger.info(`✅ A2A enabled for contract ${contractId} - evaluating...`);

          // Parse contract terms
          const contractTerms = typeof contract.terms === 'string' 
            ? JSON.parse(contract.terms) 
            : contract.terms;

          // Call agent decision service
          const decision = await AgentDecisionService.shouldApprovePayment(
            {
              amount: amount.toString(),
              fromAddress: fromWalletId || 'unknown',
              toAddress: toWalletAddress,
              network,
              description: description || 'Payment request',
              requestedAt: new Date()
            },
            {
              amount: contract.amount.toString(),
              paymentType: contract.payment_type,
              frequency: contract.frequency,
              counterpartyAddress: contractTerms.counterpartyAddress || contractTerms.recipientAddress || toWalletAddress,
              startDate: contract.start_date,
              endDate: contract.end_date
            },
            contract.a2a_approval_mode || 'manual'
          );

          logger.info(`🤖 Agent Decision: ${decision.approved ? 'APPROVED ✅' : 'REJECTED ❌'}`);
          logger.info(`📝 Reasoning: ${decision.reasoning}`);

          // Update request with agent decision
          const newStatus = decision.approved ? 'approved' : 'rejected';
          await query(
            `UPDATE a2a_requests 
             SET status = $1, 
                 agent_decision_log = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
              newStatus,
              JSON.stringify({
                approved: decision.approved,
                reasoning: decision.reasoning,
                timestamp: new Date(),
                mode: contract.a2a_approval_mode || 'manual'
              }),
              paymentRequest.id
            ]
          );

          // If approved and auto-mode, execute payment
          if (decision.approved && contract.a2a_approval_mode === 'auto') {
            logger.info(`💸 Auto-mode enabled - executing payment automatically...`);
            
            try {
              // Find payer's wallet by address
              const walletResult = await query(
                `SELECT * FROM user_wallets WHERE address = $1`,
                [toWalletAddress]
              );

              if (walletResult.rows && walletResult.rows.length > 0) {
                const payerWallet = walletResult.rows[0];
                logger.info(`✅ Found payer wallet: ${payerWallet.wallet_id}`);

                // Get recipient wallet (your wallet - the payee)
                const myWalletResult = await query(
                  `SELECT * FROM user_wallets WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
                  [userId]
                );

                if (myWalletResult.rows && myWalletResult.rows.length > 0) {
                  const recipientWallet = myWalletResult.rows[0];
                  logger.info(`✅ Found recipient wallet: ${recipientWallet.address}`);

                  // Execute payment via Circle SDK
                  logger.info(`🔄 Executing payment: ${amount} USDC from ${payerWallet.wallet_id} to ${recipientWallet.address}`);
                  
                  const paymentResult = await CircleService.transferUSDC(
                    payerWallet.wallet_id,
                    recipientWallet.address,
                    amount,
                    network,
                    {
                      contractId: contractId,
                      requestId: paymentRequest.id,
                      description: description || 'A2A automated payment'
                    }
                  );

                  if (paymentResult.success) {
                    // Update request status to 'paid'
                    await query(
                      `UPDATE a2a_requests 
                       SET status = 'paid',
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = $1`,
                      [paymentRequest.id]
                    );

                    logger.info(`✅ Payment executed successfully! Transaction: ${paymentResult.transactionId}`);

                    res.json({
                      success: true,
                      paymentRequest: {
                        ...paymentRequest,
                        status: 'paid',
                        agent_decision: decision
                      },
                      agentDecision: decision,
                      payment: paymentResult,
                      message: '✅ Agent approved and payment executed automatically!'
                    });
                    return; // Exit early since payment is complete
                  } else {
                    logger.error(`❌ Payment execution failed: ${paymentResult.error}`);
                    // Keep status as 'approved' so it can be retried manually
                  }
                } else {
                  logger.error(`❌ Recipient wallet not found for user ${userId}`);
                }
              } else {
                logger.error(`❌ Payer wallet not found for address ${toWalletAddress}`);
              }
            } catch (paymentError: any) {
              logger.error(`❌ Payment execution error:`, paymentError);
              // Continue with approval response even if payment fails
            }
          }

          res.json({
            success: true,
            paymentRequest: {
              ...paymentRequest,
              status: newStatus,
              agent_decision: decision
            },
            agentDecision: decision,
            message: decision.approved 
              ? '✅ Agent approved! Payment ready to execute.'
              : '❌ Agent rejected. See reasoning for details.'
          });
        } else {
          logger.info(`⚠️ A2A not enabled for contract ${contractId}`);
          res.json({
            success: true,
            paymentRequest,
            message: 'Payment request created. A2A not enabled - requires manual approval.'
          });
        }
      } else {
        res.json({
          success: true,
          paymentRequest,
          message: 'Payment request created. Contract not found for agent evaluation.'
        });
      }
    } catch (agentError: any) {
      logger.error(`❌ Agent evaluation failed:`, agentError);
      // Still return success for request creation, but without agent decision
      res.json({
        success: true,
        paymentRequest,
        message: 'Payment request created. Agent evaluation failed.',
        error: agentError.message
      });
    }

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

/**
 * POST /api/a2a/execute-payment/:requestId
 * Manually execute payment for an approved request
 */
router.post('/execute-payment/:requestId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    logger.info(`💸 Manual payment execution requested for request ${requestId}`);

    // Get request details
    const requestResult = await query(
      `SELECT r.*, c.* FROM a2a_requests r
       LEFT JOIN rwa_contracts c ON r.contract_id = c.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (!requestResult.rows || requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    const request = requestResult.rows[0];

    // Check if request is approved
    if (request.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot execute payment - request status is ${request.status}`
      });
    }

    // Find payer's wallet by address
    const walletResult = await query(
      `SELECT * FROM user_wallets WHERE address = $1`,
      [request.to_agent_wallet_address]
    );

    if (!walletResult.rows || walletResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payer wallet not found'
      });
    }

    const payerWallet = walletResult.rows[0];

    // Get recipient wallet (payee)
    const recipientResult = await query(
      `SELECT * FROM user_wallets WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [request.from_agent_wallet_id]
    );

    if (!recipientResult.rows || recipientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipient wallet not found'
      });
    }

    const recipientWallet = recipientResult.rows[0];

    logger.info(`🔄 Executing payment: ${request.amount} USDC`);
    logger.info(`   From: ${payerWallet.wallet_id} (${payerWallet.address})`);
    logger.info(`   To: ${recipientWallet.address}`);

    // Execute payment via Circle SDK
    const paymentResult = await CircleService.transferUSDC(
      payerWallet.wallet_id,
      recipientWallet.address,
      request.amount,
      request.network,
      {
        contractId: request.contract_id,
        requestId: request.id,
        description: request.description || 'A2A manual payment'
      }
    );

    if (paymentResult.success) {
      // Update request status to 'paid'
      await query(
        `UPDATE a2a_requests 
         SET status = 'paid',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [requestId]
      );

      logger.info(`✅ Payment executed successfully!`);

      res.json({
        success: true,
        message: 'Payment executed successfully!',
        payment: paymentResult,
        request: {
          ...request,
          status: 'paid'
        }
      });
    } else {
      throw new Error(paymentResult.error || 'Payment execution failed');
    }

  } catch (error: any) {
    logger.error('❌ Execute Payment Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

