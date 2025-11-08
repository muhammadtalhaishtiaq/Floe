import cron from 'node-cron';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import CircleService from './circle.service';

export class SchedulerService {
  /**
   * Check and execute due payments
   */
  static async checkDuePayments() {
    try {
      logger.info('🔍 Checking for due payments...');

      // Get all active payment schedules that are due
      const result = await query(`
        SELECT 
          ps.*,
          c.payer_id,
          c.payee_id,
          u1.circle_wallet_id as payer_wallet,
          u2.circle_wallet_id as payee_wallet
        FROM payment_schedules ps
        JOIN rwa_contracts c ON ps.contract_id = c.id
        JOIN users u1 ON c.payer_id = u1.id
        JOIN users u2 ON c.payee_id = u2.id
        WHERE ps.status = 'active'
          AND ps.next_payment_date <= NOW()
      `);

      logger.info(`Found ${result.rows.length} due payments`);

      for (const schedule of result.rows) {
        await this.processPayment(schedule);
      }
    } catch (error) {
      logger.error('Error checking due payments:', error);
    }
  }

  /**
   * Process a single scheduled payment
   */
  static async processPayment(schedule: any) {
    try {
      logger.info(`Processing payment for schedule ${schedule.id}`);

      // 1. Check payer balance
      const balance = await CircleService.getWalletBalance(schedule.payer_wallet);
      
      if (balance < parseFloat(schedule.amount_usdc)) {
        logger.warn(`Insufficient funds for payment ${schedule.id}`);
        await this.handleInsufficientFunds(schedule);
        return;
      }

      // 2. Execute payment via Circle
      const payment = await CircleService.createPayment({
        sourceWalletId: schedule.payer_wallet,
        destinationWalletId: schedule.payee_wallet,
        amount: schedule.amount_usdc.toString(),
        metadata: {
          scheduleId: schedule.id,
          contractId: schedule.contract_id,
          type: 'scheduled'
        }
      });

      // 3. Calculate next payment date
      const nextDate = this.calculateNextPaymentDate(
        schedule.frequency,
        new Date(schedule.next_payment_date)
      );

      // 4. Update schedule
      await query(`
        UPDATE payment_schedules
        SET next_payment_date = $1,
            last_payment_date = NOW(),
            failure_count = 0
        WHERE id = $2
      `, [nextDate, schedule.id]);

      // 5. Log transaction
      await query(`
        INSERT INTO transactions (
          contract_id, schedule_id, tx_hash,
          from_wallet, to_wallet, amount_usdc,
          type, status, circle_payment_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        schedule.contract_id,
        schedule.id,
        payment.txHash || '',
        schedule.payer_wallet,
        schedule.payee_wallet,
        schedule.amount_usdc,
        'scheduled',
        'confirmed',
        payment.id
      ]);

      logger.info(`✅ Payment processed successfully for schedule ${schedule.id}`);
    } catch (error) {
      logger.error(`Error processing payment ${schedule.id}:`, error);
      await this.handlePaymentFailure(schedule, error);
    }
  }

  /**
   * Calculate next payment date based on frequency
   */
  static calculateNextPaymentDate(frequency: string, lastDate: Date): Date {
    const date = new Date(lastDate);

    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'bi_weekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'annually':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1); // Default to monthly
    }

    return date;
  }

  /**
   * Check balances and send warnings
   */
  static async checkBalances() {
    try {
      logger.info('💰 Checking wallet balances...');

      const warningDays = parseInt(process.env.LOW_BALANCE_WARNING_DAYS || '3');
      
      const result = await query(`
        SELECT 
          ps.*,
          c.payer_id,
          u.email,
          u.circle_wallet_id
        FROM payment_schedules ps
        JOIN rwa_contracts c ON ps.contract_id = c.id
        JOIN users u ON c.payer_id = u.id
        WHERE ps.status = 'active'
          AND ps.next_payment_date <= NOW() + INTERVAL '${warningDays} days'
          AND ps.next_payment_date > NOW()
      `);

      logger.info(`Checking balances for ${result.rows.length} upcoming payments`);

      for (const schedule of result.rows) {
        const balance = await CircleService.getWalletBalance(schedule.circle_wallet_id);
        
        if (balance < parseFloat(schedule.amount_usdc)) {
          await this.sendLowBalanceAlert(schedule);
        }
      }
    } catch (error) {
      logger.error('Error checking balances:', error);
    }
  }

  /**
   * Handle insufficient funds
   */
  static async handleInsufficientFunds(schedule: any) {
    try {
      await query(`
        UPDATE payment_schedules
        SET failure_count = failure_count + 1
        WHERE id = $1
      `, [schedule.id]);

      // Create notification
      await query(`
        INSERT INTO notifications (user_id, type, message)
        VALUES ($1, $2, $3)
      `, [
        schedule.payer_id,
        'payment_failed',
        `Insufficient funds for payment of ${schedule.amount_usdc} USDC. Please top up your wallet.`
      ]);

      logger.warn(`Low balance alert sent for schedule ${schedule.id}`);
    } catch (error) {
      logger.error('Error handling insufficient funds:', error);
    }
  }

  /**
   * Send low balance alert
   */
  static async sendLowBalanceAlert(schedule: any) {
    try {
      await query(`
        INSERT INTO notifications (user_id, type, message)
        VALUES ($1, $2, $3)
      `, [
        schedule.payer_id,
        'low_balance',
        `Your wallet balance is low. Payment of ${schedule.amount_usdc} USDC is due on ${schedule.next_payment_date}. Please top up.`
      ]);

      logger.info(`Low balance warning sent to user ${schedule.payer_id}`);
    } catch (error) {
      logger.error('Error sending low balance alert:', error);
    }
  }

  /**
   * Handle payment failure
   */
  static async handlePaymentFailure(schedule: any, error: any) {
    try {
      await query(`
        UPDATE payment_schedules
        SET failure_count = failure_count + 1,
            status = CASE WHEN failure_count >= 3 THEN 'failed' ELSE status END
        WHERE id = $1
      `, [schedule.id]);

      // Create notification
      await query(`
        INSERT INTO notifications (user_id, type, message)
        VALUES ($1, $2, $3)
      `, [
        schedule.payer_id,
        'payment_failed',
        `Payment failed: ${error.message}. Please check your wallet and try again.`
      ]);

      logger.error(`Payment failure recorded for schedule ${schedule.id}`);
    } catch (error) {
      logger.error('Error handling payment failure:', error);
    }
  }
}

/**
 * Initialize CRON jobs
 */
export const initializeScheduler = () => {
  logger.info('🚀 Initializing payment scheduler...');

  // Check for due payments every day at midnight
  const paymentCron = process.env.PAYMENT_CHECK_CRON || '0 0 * * *';
  cron.schedule(paymentCron, () => {
    logger.info('⏰ Running scheduled payment check...');
    SchedulerService.checkDuePayments();
  });

  // Check balances every day at 8 AM
  const balanceCron = process.env.BALANCE_CHECK_CRON || '0 8 * * *';
  cron.schedule(balanceCron, () => {
    logger.info('⏰ Running balance check...');
    SchedulerService.checkBalances();
  });

  logger.info(`✅ Scheduler initialized with CRON: ${paymentCron} (payments), ${balanceCron} (balances)`);
};

export default SchedulerService;

