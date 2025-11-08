import cron from 'node-cron';
import { query } from '../config/database';
import CircleService from '../services/circle.service';
import { logger } from '../utils/logger';

/**
 * Automated Payment Processor
 * 
 * Runs periodically to check for due payments and execute them automatically
 * For recurring contracts (monthly, quarterly, yearly)
 */

// Calculate next payment date based on frequency
function calculateNextPaymentDate(
  currentDate: Date,
  frequency: string,
  dayOfMonth?: number
): Date {
  const next = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    
    case 'bi_weekly':
      next.setDate(next.getDate() + 14);
      break;
    
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        next.setDate(Math.min(dayOfMonth, 28)); // Avoid invalid dates
      }
      break;
    
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    
    default:
      // Default to monthly
      next.setMonth(next.getMonth() + 1);
  }
  
  return next;
}

// Process a single due payment
async function processDuePayment(schedule: any, contract: any) {
  try {
    logger.info(`💰 Processing payment for contract ${contract.id}`);
    logger.info(`   Amount: ${schedule.amount_usdc} USDC`);
    logger.info(`   From: ${schedule.payer_wallet_id}`);
    logger.info(`   To: ${schedule.payee_wallet_id}`);

    // Execute payment via Circle
    const payment = await CircleService.createPayment({
      sourceWalletId: schedule.payer_wallet_id,
      destinationWalletId: schedule.payee_wallet_id,
      amount: schedule.amount_usdc.toString(),
      metadata: {
        contractId: contract.id,
        scheduleId: schedule.id,
        contractType: contract.contract_type,
        automated: true
      }
    });

    logger.info(`✅ Payment executed: ${payment.id}`);

    // Record transaction
    await query(`
      INSERT INTO transactions (
        contract_id, schedule_id, tx_hash, from_wallet, to_wallet,
        amount_usdc, type, status, circle_payment_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      contract.id,
      schedule.id,
      payment.txHash || '',
      schedule.payer_wallet_id,
      schedule.payee_wallet_id,
      schedule.amount_usdc,
      'scheduled',
      'pending',
      payment.id,
      JSON.stringify({
        contractType: contract.contract_type,
        frequency: schedule.frequency,
        automated: true
      })
    ]);

    // Calculate next payment date
    const nextDate = calculateNextPaymentDate(
      new Date(schedule.next_payment_date),
      schedule.frequency
    );

    // Check if contract has ended
    const contractEnded = contract.end_date && new Date(nextDate) > new Date(contract.end_date);

    if (contractEnded) {
      // Mark schedule as completed
      await query(`
        UPDATE payment_schedules
        SET status = 'completed', last_payment_date = NOW()
        WHERE id = $1
      `, [schedule.id]);

      // Mark contract as completed
      await query(`
        UPDATE rwa_contracts
        SET status = 'completed', updated_at = NOW()
        WHERE id = $1
      `, [contract.id]);

      logger.info(`🏁 Contract ${contract.id} completed - end date reached`);
    } else {
      // Update schedule with next payment date
      await query(`
        UPDATE payment_schedules
        SET next_payment_date = $1, last_payment_date = NOW(), failure_count = 0
        WHERE id = $2
      `, [nextDate, schedule.id]);

      logger.info(`📅 Next payment scheduled for: ${nextDate.toISOString()}`);
    }

    return { success: true, paymentId: payment.id };
  } catch (error: any) {
    logger.error(`❌ Payment processing failed for schedule ${schedule.id}:`, error);

    // Increment failure count
    const newFailureCount = (schedule.failure_count || 0) + 1;
    
    // Pause schedule after 3 failures
    if (newFailureCount >= 3) {
      await query(`
        UPDATE payment_schedules
        SET status = 'failed', failure_count = $1
        WHERE id = $2
      `, [newFailureCount, schedule.id]);

      logger.error(`🚫 Schedule ${schedule.id} paused after 3 failures`);
      
      // TODO: Send notification to user
    } else {
      await query(`
        UPDATE payment_schedules
        SET failure_count = $1
        WHERE id = $2
      `, [newFailureCount, schedule.id]);
    }

    return { success: false, error: error.message };
  }
}

// Main payment processor function
export async function processPayments() {
  try {
    logger.info('🔄 Running automated payment processor...');

    // Find all due payments
    const result = await query(`
      SELECT 
        ps.*,
        c.id as contract_id,
        c.contract_type,
        c.end_date,
        c.status as contract_status
      FROM payment_schedules ps
      JOIN rwa_contracts c ON ps.contract_id = c.id
      WHERE ps.status = 'active'
        AND ps.next_payment_date <= NOW()
        AND c.status = 'active'
      ORDER BY ps.next_payment_date ASC
    `);

    const duePayments = result.rows;

    if (duePayments.length === 0) {
      logger.info('✓ No due payments found');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    logger.info(`📋 Found ${duePayments.length} due payment(s)`);

    let succeeded = 0;
    let failed = 0;

    // Process each due payment
    for (const payment of duePayments) {
      const contract = {
        id: payment.contract_id,
        contract_type: payment.contract_type,
        end_date: payment.end_date,
        status: payment.contract_status
      };

      const result = await processDuePayment(payment, contract);
      
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }

      // Add small delay between payments to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`✅ Payment processing complete: ${succeeded} succeeded, ${failed} failed`);

    return { processed: duePayments.length, succeeded, failed };
  } catch (error) {
    logger.error('❌ Payment processor error:', error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }
}

// Start the cron job
export function startPaymentProcessor() {
  // Run every 5 minutes for demo/testing
  // In production, use: '0 * * * *' (every hour)
  const schedule = process.env.PAYMENT_CRON_SCHEDULE || '*/5 * * * *';
  
  logger.info(`🚀 Starting payment processor with schedule: ${schedule}`);
  
  cron.schedule(schedule, async () => {
    await processPayments();
  });

  logger.info('✅ Payment processor started');
}

// Export for manual triggering (useful for testing)
export default {
  startPaymentProcessor,
  processPayments
};

