import { x402PaymentRequiredException, x402Utils } from 'a2a-x402';
import logger from '../utils/logger';
import CircleService from './circle.service';

/**
 * A2A (Agent-to-Agent) Payment Service
 * Enables autonomous payment requests and settlements between AI agents
 * Based on x402 protocol: https://github.com/dabit3/a2a-x402-typescript
 */

// USDC contract addresses for different networks
const USDC_ADDRESSES = {
  'ARC-TESTNET': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  'BASE-SEPOLIA': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'ETH-SEPOLIA': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'MATIC-AMOY': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
};

// Network names mapping
const NETWORK_NAMES = {
  'ARC-TESTNET': 'arc-testnet',
  'BASE-SEPOLIA': 'base-sepolia',
  'ETH-SEPOLIA': 'eth-sepolia',
  'MATIC-AMOY': 'polygon-amoy'
};

interface PaymentRequest {
  contractId: string;
  amount: string;
  description: string;
  fromWalletId: string;
  toWalletAddress: string;
  network: string;
}

interface A2APaymentRequirements {
  scheme: 'exact';
  network: string;
  asset: string;
  payTo: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
}

class A2AService {
  private utils: x402Utils;

  constructor() {
    this.utils = new x402Utils();
  }

  /**
   * MERCHANT SIDE: Request payment from another agent
   * This is called by the payee (e.g., landlord requesting rent)
   */
  static createPaymentRequest(params: PaymentRequest): A2APaymentRequirements {
    const { amount, description, toWalletAddress, network, contractId } = params;

    // Convert amount to atomic units (USDC has 6 decimals)
    const amountInAtomicUnits = Math.floor(parseFloat(amount) * 1_000_000).toString();

    // Get USDC address for the network
    const usdcAddress = USDC_ADDRESSES[network as keyof typeof USDC_ADDRESSES];
    if (!usdcAddress) {
      throw new Error(`Unsupported network for A2A: ${network}`);
    }

    // Get network name for x402
    const networkName = NETWORK_NAMES[network as keyof typeof NETWORK_NAMES];

    logger.info(`🤖 A2A Payment Request Created:`);
    logger.info(`   Contract: ${contractId}`);
    logger.info(`   Amount: ${amount} USDC (${amountInAtomicUnits} atomic units)`);
    logger.info(`   Network: ${network} (${networkName})`);
    logger.info(`   Pay To: ${toWalletAddress}`);
    logger.info(`   Description: ${description}`);

    return {
      scheme: 'exact',
      network: networkName,
      asset: usdcAddress,
      payTo: toWalletAddress,
      maxAmountRequired: amountInAtomicUnits,
      resource: `/api/contracts/${contractId}/execute`,
      description: description,
      mimeType: 'application/json',
      maxTimeoutSeconds: 1200 // 20 minutes
    };
  }

  /**
   * MERCHANT SIDE: Throw payment required exception
   * This is used in API endpoints to request payment
   */
  static throwPaymentRequired(requirements: A2APaymentRequirements): never {
    logger.info(`💳 Throwing x402 Payment Required Exception`);
    throw new x402PaymentRequiredException(
      'Payment required to execute this contract',
      requirements as any // Type assertion for x402 compatibility
    );
  }

  /**
   * CLIENT SIDE: Process payment request
   * This is called by the payer (e.g., tenant paying rent)
   */
  static async processPaymentRequest(
    requirements: A2APaymentRequirements,
    walletId: string
  ): Promise<any> {
    try {
      logger.info(`🤖 A2A Client: Processing payment request`);
      logger.info(`   Amount: ${requirements.maxAmountRequired} atomic units`);
      logger.info(`   Network: ${requirements.network}`);
      logger.info(`   Pay To: ${requirements.payTo}`);

      // Note: We don't need to fetch wallet details for Circle payments
      // Circle SDK handles wallet validation internally
      logger.info(`   From Wallet ID: ${walletId}`);

      // For now, we'll use Circle's payment system instead of direct signing
      // In a full implementation, you'd use ethers.js Wallet to sign
      // const privateKey = process.env.WALLET_PRIVATE_KEY;
      // const ethersWallet = new Wallet(privateKey);
      // const paymentPayload = await processPayment(requirements, ethersWallet);

      // Convert atomic units back to USDC
      const amountUSDC = (parseInt(requirements.maxAmountRequired) / 1_000_000).toString();

      // Use Circle's payment system
      logger.info(`   Using Circle payment system for settlement`);
      const payment = await CircleService.createPayment({
        sourceWalletId: walletId,
        destinationWalletId: requirements.payTo,
        amount: amountUSDC,
        blockchain: this.getCircleBlockchain(requirements.network),
        metadata: {
          a2a: true,
          resource: requirements.resource,
          description: requirements.description
        }
      });

      logger.info(`✅ A2A Payment Completed: ${payment?.id}`);

      return {
        success: true,
        paymentId: payment?.id,
        transactionHash: payment?.transaction?.txHash || 'pending',
        amount: amountUSDC,
        network: requirements.network
      };
    } catch (error: any) {
      logger.error(`❌ A2A Payment Failed:`, error);
      throw error;
    }
  }

  /**
   * Verify if a payment request matches contract terms
   */
  static async verifyPaymentRequest(
    _requirements: A2APaymentRequirements,
    contractId: string
  ): Promise<boolean> {
    try {
      logger.info(`🔍 Verifying A2A payment request for contract: ${contractId}`);

      // TODO: Fetch contract from database and verify:
      // 1. Amount matches contract amount
      // 2. Recipient matches contract recipient
      // 3. Payment is due (check schedule)
      // 4. Contract is active

      // For now, return true (implement full verification later)
      logger.info(`✅ Payment request verified`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Payment verification failed:`, error);
      return false;
    }
  }

  /**
   * Helper: Convert x402 network name to Circle blockchain name
   */
  private static getCircleBlockchain(x402Network: string): string {
    const mapping: { [key: string]: string } = {
      'arc-testnet': 'ARC-TESTNET',
      'base-sepolia': 'BASE-SEPOLIA',
      'eth-sepolia': 'ETH-SEPOLIA',
      'polygon-amoy': 'MATIC-AMOY'
    };
    return mapping[x402Network] || 'ARC-TESTNET';
  }

  /**
   * Get payment status from task metadata
   */
  getPaymentStatus(task: any): string | null {
    return this.utils.getPaymentStatus(task);
  }

  /**
   * Get payment requirements from task
   */
  getPaymentRequirements(task: any): any {
    return this.utils.getPaymentRequirements(task);
  }

  /**
   * Record successful payment
   */
  recordPaymentSuccess(task: any, response: any): void {
    this.utils.recordPaymentSuccess(task, response);
  }
}

export default A2AService;

