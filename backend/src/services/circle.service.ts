import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';
import { randomUUID } from 'crypto';

// Debug: Log env variables at module load time
console.log('🔍 Circle Service Loading...');
console.log('CIRCLE_API_KEY present:', !!process.env.CIRCLE_API_KEY);
console.log('CIRCLE_API_KEY (first 20 chars):', process.env.CIRCLE_API_KEY?.substring(0, 20) + '...');
console.log('CIRCLE_ENTITY_SECRET present:', !!process.env.CIRCLE_ENTITY_SECRET);
console.log('CIRCLE_ENTITY_SECRET length:', process.env.CIRCLE_ENTITY_SECRET?.length);
console.log('CIRCLE_ENTITY_SECRET (first 16 chars):', process.env.CIRCLE_ENTITY_SECRET?.substring(0, 16) + '...');
console.log('USDC_TOKEN_ID:', process.env.USDC_TOKEN_ID);
console.log('BLOCKCHAIN_NETWORK:', process.env.BLOCKCHAIN_NETWORK);

// Initialize Circle SDK client
export const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!
});

console.log('✅ Circle SDK client initialized');

// Supported blockchains for multi-chain wallet creation
export const SUPPORTED_BLOCKCHAINS = {
  ARC: 'ARC-TESTNET',
  BASE: 'BASE-SEPOLIA',
  ETHEREUM: 'ETH-SEPOLIA',
  POLYGON: 'MATIC-AMOY'
} as const;

export type BlockchainNetwork = typeof SUPPORTED_BLOCKCHAINS[keyof typeof SUPPORTED_BLOCKCHAINS];

export class CircleService {
  /**
   * Create a wallet set (required first step)
   * A wallet set is a container for multiple wallets with shared management
   */
  static async createWalletSet(name: string) {
    try {
      // Truncate name to max 50 characters (Circle requirement)
      const truncatedName = name.length > 50 ? name.substring(0, 47) + '...' : name;
      
      logger.info(`Creating wallet set: ${truncatedName}`);
      
      // Generate UUID for idempotency key (Circle requires UUID format)
      const idempotencyKey = randomUUID();
      
      console.log('📤 Sending to Circle API:');
      console.log('  - name:', truncatedName);
      console.log('  - idempotencyKey:', idempotencyKey);
      
      const response = await circleClient.createWalletSet({
        name: truncatedName,
        idempotencyKey: idempotencyKey
      });

      console.log('📥 Circle API Response:', response.data);
      logger.info(`✅ Wallet set created: ${response.data?.walletSet?.id}`);
      return response.data?.walletSet;
    } catch (error: any) {
      console.log('❌ Circle wallet set creation error:');
      console.log('  - Status:', error.response?.status);
      console.log('  - Message:', error.response?.data?.message);
      console.log('  - Errors:', error.response?.data?.errors);
      console.log('  - Code:', error.response?.data?.code);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create wallet set';
      throw new AppError(errorMessage, error.response?.status || 500);
    }
  }

  /**
   * Create wallets on Arc testnet (or fallback network)
   * Blockchain is configured via BLOCKCHAIN_NETWORK env variable
   * Options: ARC-TESTNET, MATIC-AMOY, ETH-SEPOLIA
   */
  static async createWallet(walletSetId: string, blockchain?: string, walletName?: string) {
    // Use env variable or fallback to MATIC-AMOY
    const targetBlockchain = blockchain || process.env.BLOCKCHAIN_NETWORK || 'MATIC-AMOY';
    
    try {
      logger.info(`Creating wallet in set ${walletSetId} on blockchain: ${targetBlockchain}`);
      
      // Generate UUID for idempotency key (Circle requires UUID format)
      const idempotencyKey = randomUUID();
      
      console.log('📤 Sending to Circle API (createWallets):');
      console.log('  - walletSetId:', walletSetId);
      console.log('  - blockchains:', [targetBlockchain]);
      console.log('  - accountType:', 'SCA');
      console.log('  - count:', 1);
      console.log('  - metadata:', walletName ? [{ name: walletName }] : undefined);
      console.log('  - idempotencyKey:', idempotencyKey);
      
      // Create wallet with SCA (Smart Contract Account) for Arc
      const response = await circleClient.createWallets({
        accountType: 'SCA', // Smart Contract Account for Arc
        blockchains: [targetBlockchain],
        count: 1,
        walletSetId: walletSetId,
        metadata: walletName ? [{ name: walletName }] : undefined, // Send name to Circle!
        idempotencyKey: idempotencyKey
      });

      console.log('📥 Circle API Response (createWallets):', response.data);
      
      const wallet = response.data?.wallets?.[0];
      logger.info(`✅ Wallet created: ${wallet?.id} at address: ${wallet?.address} on ${targetBlockchain}`);
      
      return wallet;
    } catch (error: any) {
      console.log('❌ Circle wallet creation error:');
      console.log('  - Status:', error.response?.status);
      console.log('  - Message:', error.response?.data?.message);
      console.log('  - Errors:', error.response?.data?.errors);
      console.log('  - Code:', error.response?.data?.code);
      console.log('  - Blockchain attempted:', targetBlockchain);
      
      // If Arc not supported yet, try fallback to MATIC-AMOY
      if (targetBlockchain === 'ARC-TESTNET' && !blockchain) {
        logger.warn('⚠️ Arc not supported yet by Circle SDK, falling back to MATIC-AMOY');
        logger.warn('📝 This is expected - Circle hasn\'t enabled Arc in their SDK yet');
        return this.createWallet(walletSetId, 'MATIC-AMOY');
      }
      
      // Return a clean error message
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create wallet';
      throw new AppError(errorMessage, error.response?.status || 500);
    }
  }

  /**
   * Get wallet balance
   */
  static async getWalletBalance(walletId: string) {
    try {
      const response = await circleClient.getWallet({ id: walletId });
      const balances = response.data?.wallet?.balances || [];
      
      console.log(`🔍 Balance check for ${walletId}:`);
      console.log('Balances:', JSON.stringify(balances, null, 2));
      
      // Find USDC balance - check token name for testnet tokens
      const usdcBalance = balances.find((b: any) => {
        const tokenName = b.token?.name || b.currency || '';
        const matches = tokenName.includes('USDC') || tokenName === 'USD';
        console.log(`  Token: ${tokenName}, Matches: ${matches}, Amount: ${b.amount}`);
        return matches;
      });
      
      const amount = parseFloat(usdcBalance?.amount || '0');
      console.log(`✅ Final balance: ${amount}`);
      
      return amount;
    } catch (error: any) {
      const safeError = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      };
      logger.error('Error calculating wallet balance:', safeError);
      return 0; // Return 0 instead of throwing
    }
  }

  /**
   * Get wallet transactions from Circle API
   */
  static async getWalletTransactions(walletId: string, limit: number = 10) {
    try {
      const response = await circleClient.listTransactions({
        walletIds: [walletId],
        // pageSize: limit
      });
      
      return response.data?.transactions || [];
    } catch (error: any) {
      const safeError = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      };
      logger.error('Error fetching wallet transactions:', safeError);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Create a payment (USDC transfer)
   */
  static async createPayment(params: {
    sourceWalletId: string;
    destinationWalletId: string;
    amount: string;
    blockchain?: string; // ✅ ADD blockchain parameter
    metadata?: any;
  }) {
    try {
      const { sourceWalletId, destinationWalletId, amount, blockchain, metadata } = params;
      const { randomUUID } = require('crypto');
      
      // ✅ Use provided blockchain or fall back to env
      const blockchainNetwork = blockchain || process.env.BLOCKCHAIN_NETWORK || 'ARC-TESTNET';
      
      logger.info(`💸 Creating payment: ${amount} USDC`);
      logger.info(`   From wallet: ${sourceWalletId}`);
      logger.info(`   To address: ${destinationWalletId}`);
      logger.info(`   Blockchain: ${blockchainNetwork}`);
      
      // Build payment parameters
      const paymentParams: any = {
        idempotencyKey: randomUUID(),
        walletId: sourceWalletId,
        blockchain: blockchainNetwork,
        destinationAddress: destinationWalletId,
        amounts: [amount],
        fee: {
          type: 'level',
          config: {
            feeLevel: 'MEDIUM'
          }
        }
      };
      
      // ⚠️ CRITICAL: Arc Testnet uses USDC as native gas - no tokenId
      // For other testnets with developer-controlled wallets, we also don't use tokenId
      // Circle handles USDC transfers automatically on testnet
      logger.info(`   ${blockchainNetwork} - Using native USDC transfer (testnet)`);
      
      const response = await circleClient.createTransaction(paymentParams);

      logger.info(`✅ Payment created: ${response.data?.id}`);
      return response.data;
    } catch (error: any) {
      const safeError = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      };
      logger.error('❌ Circle payment error:', safeError);
      throw new AppError(error.response?.data?.message || error.message || 'Failed to create payment', 500);
    }
  }

  /**
   * Get transaction status
   */
  static async getTransaction(transactionId: string) {
    try {
      logger.info(`🔍 Fetching transaction from Circle API: ${transactionId}`);
      const response = await circleClient.getTransaction({ id: transactionId });
      
      // DEBUG: Log the full response structure
      logger.info(`📦 Full response structure:`, {
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        dataType: typeof response.data
      });
      
      // The response might be nested differently
      const transaction = response.data?.data || response.data;
      
      logger.info(`✅ Transaction found:`, {
        id: transaction?.id,
        state: transaction?.state,
        txHash: transaction?.transaction?.txHash || transaction?.txHash,
        fullTransaction: JSON.stringify(transaction).substring(0, 500)
      });
      
      return transaction;
    } catch (error: any) {
      const safeError = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      };
      
      // 404 is expected when transaction is not indexed yet - don't log as error
      if (error.response?.status === 404) {
        logger.info(`⏳ Transaction ${transactionId} not indexed yet (404)`);
        throw error; // Re-throw so caller can handle
      }
      
      logger.error('❌ Error fetching transaction:', safeError);
      throw new AppError('Failed to fetch transaction', 500);
    }
  }

  /**
   * List all wallets for an entity
   */
  static async listWallets(entityId?: string) {
    try {
      const params: any = {};
      if (entityId) params.entityId = entityId;
      
      const response = await circleClient.listWallets(params);
      return response.data?.wallets || [];
    } catch (error: any) {
      const safeError = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      };
      logger.error('Error listing wallets:', safeError);
      throw new AppError('Failed to list wallets', 500);
    }
  }

  /**
   * Execute smart contract function
   * Based on Circle's CCTP tutorial: https://developers.circle.com/interactive-quickstarts/cctp
   */
  static async createContractExecution(params: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: any[];
    fee: {
      type: string;
      config: {
        feeLevel: string;
      };
    };
  }) {
    try {
      const { walletId, contractAddress, abiFunctionSignature, abiParameters, fee } = params;
      const { randomUUID } = require('crypto');
      
      logger.info(`📝 Contract Execution:`);
      logger.info(`   Wallet: ${walletId}`);
      logger.info(`   Contract: ${contractAddress}`);
      logger.info(`   Function: ${abiFunctionSignature}`);
      
      const response = await circleClient.createContractExecutionTransaction({
        walletId: walletId,
        contractAddress: contractAddress,
        abiFunctionSignature: abiFunctionSignature,
        abiParameters: abiParameters,
        fee: fee,
        idempotencyKey: randomUUID()
      });

      logger.info(`✅ Contract execution created: ${response.data?.id}`);
      return response.data;
    } catch (error: any) {
      const safeError = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      };
      logger.error('❌ Contract execution error:', safeError);
      throw new AppError(error.response?.data?.message || error.message || 'Failed to execute contract', 500);
    }
  }

  /**
   * 🚀 UNIFIED TRANSFER FUNCTION
   * Automatically detects same-chain vs cross-chain and uses appropriate method
   * 
   * USE THIS EVERYWHERE:
   * - Wallet-to-wallet transfers
   * - Contract payments
   * - A2A payments
   * - Any USDC transfer!
   * 
   * @param params Transfer parameters
   * @returns Transaction result
   */
  static async transferUSDC(params: {
    sourceWalletId: string;
    sourceChain: string;
    destWalletAddress: string;
    destChain: string;
    amount: string;
    metadata?: any;
  }) {
    const { sourceWalletId, sourceChain, destWalletAddress, destChain, amount, metadata } = params;

    logger.info(`🔄 Transfer Request: ${amount} USDC`);
    logger.info(`   From: ${sourceWalletId} (${sourceChain})`);
    logger.info(`   To: ${destWalletAddress} (${destChain})`);

    try {
      // Import CCTP service dynamically to avoid circular dependency
      const CCTPService = require('./cctp.service').default;

      // Check if cross-chain transfer is needed
      if (CCTPService.requiresCCTP(sourceChain, destChain)) {
        logger.info('🌉 Cross-chain detected → Using CCTP');
        
        // Use CCTP for cross-chain transfer
        return await CCTPService.transferCrossChain({
          sourceWalletId,
          sourceChain,
          destWalletAddress,
          destChain,
          amount,
          metadata
        });
      } else {
        logger.info('⚡ Same-chain detected → Direct transfer');
        
        // Use direct transfer for same-chain
        const paymentData = await this.createPayment({
          sourceWalletId,
          destinationWalletId: destWalletAddress,
          amount,
          blockchain: sourceChain, // ✅ Pass the source blockchain
          metadata
        });

        // Return in consistent format
        return {
          success: true,
          transactionId: paymentData.id,
          status: paymentData.state,
          data: paymentData
        };
      }
    } catch (error: any) {
      logger.error('❌ Transfer failed:', error);
      return {
        success: false,
        error: error.message || 'Transfer failed'
      };
    }
  }
}

export default CircleService;

