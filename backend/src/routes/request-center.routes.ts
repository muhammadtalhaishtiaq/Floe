import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware as authenticateToken } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

/**
 * REQUEST CENTER ROUTES
 * For users acting as REQUESTERS (landlords, vendors, etc.)
 * They create contracts and send payment requests to payers
 */

/**
 * GET /api/request-center/contracts
 * Get all contracts where user is the PAYEE (receiving money)
 */
router.get('/contracts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    logger.info(`📋 Fetching request contracts for user ${userId}`);

    // Get contracts where user is PAYEE (the one requesting payment)
    const result = await query(
      `SELECT c.* FROM rwa_contracts c
       WHERE c.payee_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    const contracts = result.rows || [];

    logger.info(`✅ Found ${contracts.length} request contracts`);

    res.json({
      success: true,
      contracts
    });

  } catch (error: any) {
    logger.error('❌ Get Request Contracts Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/request-center/contracts/:id
 * Get single request contract details
 */
router.get('/contracts/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    logger.info(`📋 Fetching request contract ${id} for user ${userId}`);

    const result = await query(
      `SELECT * FROM rwa_contracts WHERE id = $1 AND payee_id = $2`,
      [id, userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found or access denied'
      });
    }

    const contract = result.rows[0];

    logger.info(`✅ Request contract found: ${contract.asset_description}`);

    res.json({
      success: true,
      contract
    });

  } catch (error: any) {
    logger.error('❌ Get Request Contract Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/request-center/send-request/:contractId
 * Send a payment request to the payer for this contract
 */
router.post('/send-request/:contractId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { amount, description } = req.body;

    logger.info(`📤 Sending payment request for contract ${contractId}`);

    // Verify contract exists and user is payee
    const contractResult = await query(
      `SELECT * FROM rwa_contracts WHERE id = $1 AND payee_id = $2`,
      [contractId, userId]
    );

    if (!contractResult.rows || contractResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found or access denied'
      });
    }

    const contract = contractResult.rows[0];

    // Parse contract to get payer details
    let rawContractData: any = {};
    try {
      rawContractData = typeof contract.raw_contract_text === 'string'
        ? JSON.parse(contract.raw_contract_text)
        : contract.raw_contract_text || {};
    } catch (e) {
      logger.error('Failed to parse contract data');
    }

    const payerAddress = rawContractData.counterparty_address || rawContractData.payer_address;
    
    if (!payerAddress || payerAddress === 'N/A') {
      return res.status(400).json({
        success: false,
        error: 'No payer address found in contract'
      });
    }

    const requestAmount = amount || contract.total_amount_usdc;
    const requestDescription = description || `Payment request for ${contract.asset_description}`;

    logger.info(`Creating A2A request:`);
    logger.info(`  From: ${userId} (Payee/Requester)`);
    logger.info(`  To: ${payerAddress} (Payer)`);
    logger.info(`  Amount: ${requestAmount} USDC`);

    // Create A2A payment request
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

    const requestResult = await query(insertQuery, [
      contractId,
      userId, // from_agent_wallet_id = requester user ID
      payerAddress, // to_agent_wallet_address = payer's wallet
      requestAmount,
      'ARC-TESTNET',
      requestDescription,
      'pending',
      JSON.stringify({})
    ]);

    const paymentRequest = requestResult.rows![0];

    logger.info(`✅ Payment request created: ${paymentRequest.id}`);

    // 🤖 AUTO-TRIGGER AGENT EVALUATION (if A2A enabled)
    if (contract.a2a_enabled) {
      logger.info(`🤖 A2A enabled - triggering agent evaluation...`);

      try {
        // Import agent decision service
        const AgentDecisionService = require('../services/agent-decision.service').default;

        // Parse contract terms
        let contractTerms: any = {};
        try {
          contractTerms = typeof contract.terms === 'string' 
            ? JSON.parse(contract.terms) 
            : contract.terms || {};
        } catch (e) {
          logger.warn('Failed to parse contract terms, using defaults');
        }

        // Call agent decision
        const decision = await AgentDecisionService.shouldApprovePayment(
          {
            amount: requestAmount.toString(),
            fromAddress: userId,
            toAddress: payerAddress,
            network: 'ARC-TESTNET',
            description: requestDescription,
            requestedAt: new Date()
          },
          {
            amount: contract.total_amount_usdc.toString(),
            paymentType: contract.payment_type,
            frequency: contract.payment_type,
            counterpartyAddress: payerAddress,
            startDate: contract.start_date,
            endDate: contract.end_date
          },
          contract.a2a_approval_mode || 'manual'
        );

        logger.info(`🤖 Agent Decision: ${decision.approved ? 'APPROVED ✅' : 'REJECTED ❌'}`);
        logger.info(`📝 Reasoning: ${decision.reasoning}`);

        // Update request with decision
        // For MANUAL mode: Keep as 'pending' even if checks pass (needs human execution)
        // For AUTO mode: Set to 'approved' or 'rejected' based on decision
        let newStatus;
        if (contract.a2a_approval_mode === 'manual') {
          newStatus = decision.approved ? 'pending' : 'rejected'; // 'pending' means waiting for human execution
        } else {
          newStatus = decision.approved ? 'approved' : 'rejected';
        }
        
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
              mode: contract.a2a_approval_mode || 'manual',
              awaiting_human_execution: contract.a2a_approval_mode === 'manual' && decision.approved
            }),
            paymentRequest.id
          ]
        );

        // 💸 IF APPROVED AND AUTO MODE, EXECUTE PAYMENT IMMEDIATELY
        if (decision.approved && contract.a2a_approval_mode === 'auto') {
          logger.info(`💸 AUTO mode - executing payment immediately...`);

          try {
            // Import CircleService
            const CircleService = require('../services/circle.service').default;

            // Find payer's wallet by address
            const payerWalletResult = await query(
              `SELECT * FROM user_wallets WHERE circle_wallet_address = $1`,
              [payerAddress]
            );

            if (!payerWalletResult.rows || payerWalletResult.rows.length === 0) {
              logger.error(`❌ Payer wallet not found for address: ${payerAddress}`);
              throw new Error('Payer wallet not found');
            }

            const payerWallet = payerWalletResult.rows[0];

            // Find landlord's wallet by user_id
            const landlordWalletResult = await query(
              `SELECT * FROM user_wallets WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
              [userId]
            );

            if (!landlordWalletResult.rows || landlordWalletResult.rows.length === 0) {
              logger.error(`❌ Landlord wallet not found for user: ${userId}`);
              throw new Error('Landlord wallet not found');
            }

            const landlordWallet = landlordWalletResult.rows[0];

            logger.info(`💸 Executing payment:`);
            logger.info(`   FROM: ${payerWallet.circle_wallet_id} (${payerWallet.circle_wallet_address})`);
            logger.info(`   TO: ${landlordWallet.circle_wallet_address}`);
            logger.info(`   AMOUNT: ${requestAmount} USDC`);

            // Execute payment via Circle SDK
            const paymentResult = await CircleService.transferUSDC({
              sourceWalletId: payerWallet.circle_wallet_id,
              sourceChain: 'ARC-TESTNET',
              destWalletAddress: landlordWallet.circle_wallet_address,
              destChain: 'ARC-TESTNET',
              amount: requestAmount.toString(),
              metadata: {
                contractId: contractId,
                requestId: paymentRequest.id,
                description: requestDescription
              }
            });

            if (paymentResult.success) {
              // Update request status to 'paid'
              await query(
                `UPDATE a2a_requests 
                 SET status = 'paid',
                     transaction_id = $1,
                     transaction_hash = $2,
                     paid_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [
                  paymentResult.transactionId || null,
                  paymentResult.transactionHash || null,
                  paymentRequest.id
                ]
              );

              logger.info(`✅ Payment executed successfully! TX: ${paymentResult.transactionId}`);

              res.json({
                success: true,
                request: {
                  ...paymentRequest,
                  status: 'paid',
                  agent_decision: decision,
                  transaction_id: paymentResult.transactionId
                },
                agentDecision: decision,
                payment: paymentResult,
                message: '✅ Request approved and payment executed automatically!'
              });
              return; // Exit early
            } else {
              logger.error(`❌ Payment execution failed: ${paymentResult.error}`);
              // Keep status as 'approved' so it can be retried manually
            }

          } catch (paymentError: any) {
            logger.error(`❌ Payment execution error:`, paymentError);
            // Continue with approval response even if payment fails
          }
        }

        res.json({
          success: true,
          request: {
            ...paymentRequest,
            status: newStatus,
            agent_decision: decision
          },
          agentDecision: decision,
          message: decision.approved 
            ? (contract.a2a_approval_mode === 'auto' 
                ? '✅ Request approved! Payment execution in progress...'
                : '✅ Request sent and approved by payer\'s agent!')
            : '⚠️ Request sent but rejected by payer\'s agent.'
        });

      } catch (agentError: any) {
        logger.error('❌ Agent evaluation failed:', agentError);
        res.json({
          success: true,
          request: paymentRequest,
          message: 'Request sent successfully (agent evaluation pending)'
        });
      }
    } else {
      logger.info('⚠️ A2A not enabled for this contract');
      res.json({
        success: true,
        request: paymentRequest,
        message: 'Request sent successfully'
      });
    }

  } catch (error: any) {
    logger.error('❌ Send Request Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/request-center/sent-requests
 * Get all payment requests user has sent (as payee/requester)
 */
router.get('/sent-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { limit = 50 } = req.query;

    logger.info(`📤 Fetching sent requests for user ${userId}`);

    // Get requests where user is the requester (from_agent_wallet_id)
    const result = await query(
      `SELECT 
        r.*,
        c.asset_description as contract_title,
        c.a2a_enabled,
        c.a2a_approval_mode
       FROM a2a_requests r
       LEFT JOIN rwa_contracts c ON r.contract_id = c.id
       WHERE r.from_agent_wallet_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const requests = result.rows || [];

    logger.info(`✅ Found ${requests.length} sent requests`);

    res.json({
      success: true,
      requests
    });

  } catch (error: any) {
    logger.error('❌ Get Sent Requests Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/request-center/sent-requests/:id
 * Get single sent request with full details
 */
router.get('/sent-requests/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    logger.info(`📤 Fetching sent request ${id} for user ${userId}`);

    const result = await query(
      `SELECT 
        r.*,
        c.asset_description as contract_title,
        c.a2a_enabled,
        c.a2a_approval_mode
       FROM a2a_requests r
       LEFT JOIN rwa_contracts c ON r.contract_id = c.id
       WHERE r.id = $1 AND r.from_agent_wallet_id = $2`,
      [id, userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found or access denied'
      });
    }

    const request = result.rows[0];

    logger.info(`✅ Sent request found: ${request.description}`);

    res.json({
      success: true,
      request
    });

  } catch (error: any) {
    logger.error('❌ Get Sent Request Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

