import { query } from '../config/database';
import logger from '../utils/logger';
import AgentDecisionService from './agent-decision.service';
import CircleService from './circle.service';

/**
 * Payment Scheduler Service
 * Automatically processes recurring payments for A2A-enabled contracts
 */
class PaymentSchedulerService {
  private isRunning: boolean = false;

  /**
   * Check for due payments and process them
   */
  async processDuePayments(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Payment scheduler already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('🔄 Running automated payment processor...');

      // Find active contracts with A2A enabled and recurring payments
      const dueContractsQuery = `
        SELECT 
          c.*
        FROM rwa_contracts c
        WHERE 
          c.status = 'active'
          AND c.a2a_enabled = TRUE
          AND c.payment_type IN ('recurring', 'monthly', 'quarterly', 'annual')
          AND (
            c.last_payment_date IS NULL
            OR c.next_payment_date <= NOW()
          )
        ORDER BY c.next_payment_date ASC NULLS FIRST
        LIMIT 50
      `;

      const result = await query(dueContractsQuery);
      const dueContracts = result.rows || [];

      if (dueContracts.length === 0) {
        logger.info('✓ No due payments found');
        return;
      }

      logger.info(`📋 Found ${dueContracts.length} due payment(s)`);

      // Process each due contract
      for (const contract of dueContracts) {
        try {
          await this.processContractPayment(contract);
        } catch (error: any) {
          logger.error(`❌ Failed to process payment for contract ${contract.id}:`, error);
          // Continue with other contracts even if one fails
        }
      }

      logger.info('✅ Payment processing complete');
    } catch (error: any) {
      logger.error('❌ Payment scheduler error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process payment for a specific contract
   */
  private async processContractPayment(contract: any): Promise<void> {
    logger.info(`💳 Processing payment for contract: ${contract.asset_description} (${contract.id})`);

    try {
      // Parse contract terms
      const contractTerms = typeof contract.raw_contract_text === 'string' 
        ? JSON.parse(contract.raw_contract_text) 
        : contract.raw_contract_text || {};

      // Determine payer and payee based on contract type
      const isRequestContract = contract.payer_id === null && contract.payee_id !== null;
      
      let fromUserId, toWalletAddress;
      
      if (isRequestContract) {
        // Request contract: payee (landlord) requests from payer (tenant)
        fromUserId = contract.payee_id; // Landlord user ID
        toWalletAddress = contractTerms.counterparty_address; // Tenant wallet
      } else {
        // Regular contract: payer pays to payee
        fromUserId = contract.payer_id;
        toWalletAddress = contractTerms.counterparty_address || contractTerms.recipientAddress || '';
      }

      // Create payment request
      const paymentRequest = {
        amount: contract.total_amount_usdc.toString(),
        fromAddress: fromUserId, // User ID (will be resolved to wallet)
        toAddress: toWalletAddress, // Wallet address
        network: contractTerms.network || 'ARC-TESTNET',
        description: `Automated ${contract.payment_type} payment for ${contract.asset_description}`,
        requestedAt: new Date()
      };

      logger.debug('Payment Request:', paymentRequest);

      // Check A2A approval mode
      const approvalMode = contract.a2a_approval_mode || 'manual';
      
      if (approvalMode === 'manual') {
        // Manual mode: Create A2A request for user approval
        logger.info(`📝 Creating A2A request for manual approval (contract ${contract.id})`);
        
        await this.createA2ARequest(contract, paymentRequest);
        
        logger.info(`✅ A2A request created for contract ${contract.id} - awaiting user approval`);
        return;
      }

      // Auto mode: Let agent decide
      logger.info(`🤖 Auto mode enabled - agent will evaluate payment (contract ${contract.id})`);

      const decision = await AgentDecisionService.shouldApprovePayment(
        paymentRequest,
        {
          amount: contract.amount.toString(),
          paymentType: contract.payment_type,
          frequency: contract.frequency,
          counterpartyAddress: contractTerms.counterpartyAddress || contractTerms.recipientAddress || '',
          startDate: contract.start_date,
          endDate: contract.end_date
        },
        approvalMode
      );

      logger.info(`Agent Decision: ${decision.approved ? 'APPROVED' : 'REJECTED'}`);
      logger.debug('Agent Reasoning:', decision.reasoning);

      // Create A2A request record with agent decision
      const a2aRequestId = await this.createA2ARequest(contract, paymentRequest, {
        approved: decision.approved,
        reasoning: decision.reasoning,
        timestamp: new Date()
      });

      if (!decision.approved) {
        logger.warn(`❌ Payment rejected by agent for contract ${contract.id}: ${decision.reasoning}`);
        return;
      }

      // Agent approved - execute payment
      logger.info(`✅ Agent approved - executing payment for contract ${contract.id}`);

      try {
        // Execute payment via Circle SDK
        const paymentResult = await CircleService.transferUSDC(
          contract.wallet_id,
          paymentRequest.toAddress,
          parseFloat(paymentRequest.amount),
          paymentRequest.network as any,
          paymentRequest.description
        );

        logger.info(`💸 Payment executed successfully for contract ${contract.id}`);
        logger.debug('Payment Result:', paymentResult);

        // Update A2A request with payment result
        await query(
          `UPDATE a2a_requests 
           SET status = 'paid', 
               transaction_hash = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [paymentResult.transactionId || paymentResult.id, a2aRequestId]
        );

        // Update contract's last payment date and calculate next payment
        await this.updateContractPaymentSchedule(contract);

        logger.info(`✅ Contract ${contract.id} payment completed and scheduled`);
      } catch (paymentError: any) {
        logger.error(`❌ Payment execution failed for contract ${contract.id}:`, paymentError);
        
        // Update A2A request with failed status
        await query(
          `UPDATE a2a_requests 
           SET status = 'failed', 
               agent_decision_log = jsonb_set(
                 COALESCE(agent_decision_log, '{}'::jsonb),
                 '{error}',
                 to_jsonb($1::text)
               ),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [paymentError.message, a2aRequestId]
        );

        throw paymentError;
      }
    } catch (error: any) {
      logger.error(`❌ Error processing contract ${contract.id}:`, error);
      throw error;
    }
  }

  /**
   * Create A2A request record
   */
  private async createA2ARequest(
    contract: any, 
    paymentRequest: any,
    agentDecision?: { approved: boolean; reasoning: string; timestamp: Date }
  ): Promise<string> {
    try {
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
          agent_decision_log,
          contract_title,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;

      const values = [
        contract.id,
        paymentRequest.fromAddress, // User ID
        paymentRequest.toAddress, // Wallet address
        paymentRequest.amount,
        paymentRequest.network,
        paymentRequest.description,
        agentDecision ? (agentDecision.approved ? 'approved' : 'rejected') : 'pending',
        JSON.stringify({}), // payment_requirements
        agentDecision ? JSON.stringify(agentDecision) : null,
        contract.asset_description || contract.title
      ];

      const result = await query(insertQuery, values);
      return result.rows![0].id;
    } catch (error: any) {
      logger.error('❌ Failed to create A2A request:', error);
      throw error;
    }
  }

  /**
   * Update contract payment schedule
   */
  private async updateContractPaymentSchedule(contract: any): Promise<void> {
    try {
      const now = new Date();
      let nextPaymentDate: Date;

      // Calculate next payment date based on frequency
      switch (contract.frequency?.toLowerCase()) {
        case 'daily':
          nextPaymentDate = new Date(now);
          nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
          break;
        case 'weekly':
          nextPaymentDate = new Date(now);
          nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
          break;
        case 'biweekly':
          nextPaymentDate = new Date(now);
          nextPaymentDate.setDate(nextPaymentDate.getDate() + 14);
          break;
        case 'monthly':
          nextPaymentDate = new Date(now);
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextPaymentDate = new Date(now);
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
          break;
        case 'yearly':
          nextPaymentDate = new Date(now);
          nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
          break;
        default:
          logger.warn(`Unknown frequency: ${contract.frequency} for contract ${contract.id}`);
          return;
      }

      // Update contract
      await query(
        `UPDATE rwa_contracts 
         SET last_payment_date = $1,
             next_payment_date = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [now, nextPaymentDate, contract.id]
      );

      logger.info(`📅 Contract ${contract.id} next payment scheduled for ${nextPaymentDate.toISOString()}`);
    } catch (error: any) {
      logger.error(`❌ Failed to update payment schedule for contract ${contract.id}:`, error);
      throw error;
    }
  }

  /**
   * Start automated scheduler (called on server startup)
   */
  start(intervalMinutes: number = 5): void {
    logger.info(`🚀 Starting payment scheduler (every ${intervalMinutes} minutes)...`);

    // Run immediately on start
    this.processDuePayments();

    // Then run on interval
    setInterval(() => {
      this.processDuePayments();
    }, intervalMinutes * 60 * 1000);
  }
}

export default new PaymentSchedulerService();

