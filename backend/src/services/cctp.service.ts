/**
 * CCTP Service - Cross-Chain Transfer Protocol
 * Handles USDC bridging between different blockchains using Circle's CCTP
 * Based on Circle's official example: https://developers.circle.com/cctp/transfer-usdc-on-testnet-from-ethereum-to-avalanche
 */

import axios from 'axios';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';
import CircleService from './circle.service';

const CIRCLE_API_BASE = process.env.CIRCLE_API_BASE || 'https://api-sandbox.circle.com';
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;

/**
 * CCTP Contract Addresses (Circle's official smart contracts)
 * These are NOT user wallets - they are Circle's infrastructure contracts!
 * 
 * Source: https://developers.circle.com/cctp/evm-smart-contracts
 * Updated: November 7, 2025 with official Arc Testnet addresses
 */

// TokenMessenger: Handles burning USDC on source chain
const TOKEN_MESSENGER_ADDRESSES: Record<string, string> = {
  'ETH-SEPOLIA': '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  'BASE-SEPOLIA': '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  'MATIC-AMOY': '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  'ARC-TESTNET': '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d'  // ✅ Official Arc Testnet
};

// MessageTransmitter: Handles minting USDC on destination chain
const MESSAGE_TRANSMITTER_ADDRESSES: Record<string, string> = {
  'ETH-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'BASE-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'MATIC-AMOY': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'ARC-TESTNET': '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64'  // ✅ Official Arc Testnet
};

// USDC Token addresses on each chain
const USDC_TOKEN_ADDRESSES: Record<string, string> = {
  'ETH-SEPOLIA': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'BASE-SEPOLIA': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'MATIC-AMOY': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',  // ✅ Official Polygon Amoy
  'ARC-TESTNET': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'  // ✅ Official Arc Testnet
};

// Domain IDs for CCTP (Circle's chain identifiers for routing)
const DOMAIN_IDS: Record<string, number> = {
  'ETH-SEPOLIA': 0,
  'BASE-SEPOLIA': 6,  // ✅ Corrected from 10 to 6 (official Base Sepolia domain)
  'MATIC-AMOY': 7,
  'ARC-TESTNET': 23  // ✅ Official Arc Testnet domain ID
};

// RPC URLs for each chain
const RPC_URLS: Record<string, string> = {
  'ETH-SEPOLIA': 'https://ethereum-sepolia-rpc.publicnode.com',
  'BASE-SEPOLIA': 'https://sepolia.base.org',
  'MATIC-AMOY': 'https://rpc-amoy.polygon.technology',
  'ARC-TESTNET': process.env.ARC_RPC_URL || 'https://rpc.arc.testnet.circle.com'
};

// Minimal ABIs for CCTP contracts
const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) returns (uint64)'
];

const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation)'
];

const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

class CCTPService {
  /**
   * Transfer USDC cross-chain using CCTP
   * This is the main function that handles burn → attest → mint
   */
  static async transferCrossChain(params: {
    sourceWalletId: string;
    sourceChain: string;
    destWalletAddress: string;
    destChain: string;
    amount: string;
    metadata?: any;
  }) {
    const { sourceWalletId, sourceChain, destWalletAddress, destChain, amount, metadata } = params;

    try {
      logger.info(`🌉 CCTP Transfer: ${amount} USDC from ${sourceChain} → ${destChain}`);

      // Step 0: Approve USDC for TokenMessenger
      logger.info('✅ Step 0: Approving USDC...');
      const approveTx = await this.approveUSDC(sourceWalletId, sourceChain, amount);
      logger.info(`✅ Approval initiated. TX: ${approveTx?.id}`);
      
      // ⚡ OPTIMIZATION: Don't wait for approval - Circle handles this asynchronously
      // Based on: https://developers.circle.com/cctp/transfer-usdc-on-testnet-from-ethereum-to-avalanche
      logger.info('⚡ Skipping approval wait - proceeding to burn...');

      // Step 1: Burn USDC on source chain
      logger.info('🔥 Step 1: Burning USDC on source chain...');
      const burnTx = await this.burnUSDC(sourceWalletId, sourceChain, destChain, amount, destWalletAddress);
      logger.info(`✅ Burn initiated. TX: ${burnTx?.id}`);

      // Step 2: Wait for burn transaction to be indexed
      // Arc Testnet can take 90-120s to process transactions
      logger.info('⏳ Step 2: Waiting for burn transaction to be indexed...');
      await this.waitForTransactionIndexed(burnTx?.id, 60); // 120s wait for Arc Testnet

      // Step 3: Get attestation from Circle
      logger.info('📜 Step 3: Fetching attestation from Circle...');
      const attestationData = await this.getAttestation(burnTx?.id, sourceChain);
      logger.info('✅ Attestation received');

      // Step 4: Mint USDC on destination chain (need a wallet on dest chain)
      logger.info('✨ Step 4: Minting USDC on destination chain...');
      // Note: For now, we'll need the user to have a wallet on the destination chain
      // In production, you might create a temporary wallet or use a relay service
      const mintTx = await this.mintUSDC(sourceWalletId, destChain, attestationData);
      logger.info(`✅ Mint complete. TX: ${mintTx?.txHash || mintTx?.id}`);

      return {
        success: true,
        burnTx: burnTx.txHash,
        mintTx: mintTx.txHash,
        attestation,
        amount,
        sourceChain,
        destChain
      };
    } catch (error: any) {
      logger.error('❌ CCTP transfer failed:', error);
      throw new AppError(error.message || 'Cross-chain transfer failed', 500);
    }
  }

  /**
   * Step 0: Approve USDC for TokenMessenger
   * Based on Circle's tutorial: https://developers.circle.com/interactive-quickstarts/cctp
   */
  private static async approveUSDC(
    walletId: string,
    sourceChain: string,
    amount: string
  ) {
    try {
      logger.info(`✅ Step 0: Approving USDC on ${sourceChain}`);
      
      // Convert amount to smallest unit (USDC has 6 decimals)
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000);
      
      // Approve TokenMessenger to spend USDC
      const approveTx = await CircleService.createContractExecution({
        walletId: walletId,
        contractAddress: USDC_TOKEN_ADDRESSES[sourceChain],
        abiFunctionSignature: 'approve(address,uint256)',
        abiParameters: [
          TOKEN_MESSENGER_ADDRESSES[sourceChain],
          amountInSmallestUnit.toString()
        ],
        fee: {
          type: 'level',
          config: { feeLevel: 'HIGH' }
        }
      });

      logger.info(`✅ Approval transaction created: ${approveTx?.id}`);
      return approveTx;
    } catch (error: any) {
      logger.error('❌ Approval failed:', error);
      throw error;
    }
  }

  /**
   * Step 1: Burn USDC on source chain
   * Based on Circle's tutorial: https://developers.circle.com/interactive-quickstarts/cctp
   */
  private static async burnUSDC(
    walletId: string,
    sourceChain: string,
    destChain: string,
    amount: string,
    destAddress: string
  ) {
    try {
      const destDomain = DOMAIN_IDS[destChain];
      
      if (destDomain === undefined) {
        throw new Error(`Unsupported destination chain: ${destChain}`);
      }

      logger.info(`🔥 Step 1: Burning ${amount} USDC on ${sourceChain}`);
      logger.info(`   Destination: ${destChain} (domain ${destDomain})`);
      
      // Convert destination address to bytes32 format (Solidity address encoding)
      const destAddressBytes32 = `0x000000000000000000000000${destAddress.slice(2).toLowerCase()}`;
      
      // Convert amount to smallest unit (USDC has 6 decimals)
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000);

      // Call TokenMessenger.depositForBurn via Circle SDK
      // Using CCTP V2 signature (7 parameters) - CRITICAL!
      // Based on: https://developers.circle.com/cctp/transfer-usdc-on-testnet-from-ethereum-to-avalanche
      const destinationCaller = '0x0000000000000000000000000000000000000000000000000000000000000000'; // Any address can call receiveMessage
      const maxFee = '500'; // 0.0005 USDC max fee for fast transfer
      const minFinalityThreshold = '1000'; // Fast transfer (1000 or less)
      
      const burnTx = await CircleService.createContractExecution({
        walletId: walletId,
        contractAddress: TOKEN_MESSENGER_ADDRESSES[sourceChain],
        abiFunctionSignature: 'depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)',
        abiParameters: [
          amountInSmallestUnit.toString(),      // amount
          destDomain.toString(),                 // destinationDomain
          destAddressBytes32,                    // mintRecipient
          USDC_TOKEN_ADDRESSES[sourceChain],    // burnToken
          destinationCaller,                     // destinationCaller (bytes32)
          maxFee,                                // maxFee
          minFinalityThreshold                   // minFinalityThreshold (1000 = fast)
        ],
        fee: {
          type: 'level',
          config: { feeLevel: 'HIGH' }
        }
      });

      logger.info(`✅ Burn transaction created: ${burnTx?.id}`);
      return burnTx;
    } catch (error: any) {
      logger.error('❌ Burn failed:', error);
      throw error;
    }
  }

  /**
   * Step 2: Wait for transaction to be confirmed
   */
  /**
   * Optimized wait - just checks if transaction is indexed (not necessarily COMPLETE)
   * Based on Circle's CCTP V2 tutorial approach
   */
  private static async waitForTransactionIndexed(transactionId: string, maxAttempts = 30) {
    logger.info(`⏳ Waiting for transaction ${transactionId} to be indexed (max ${maxAttempts * 2}s)...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        logger.info(`🔍 [Attempt ${i + 1}/${maxAttempts}] Calling CircleService.getTransaction(${transactionId})...`);
        const tx = await CircleService.getTransaction(transactionId);
        
        logger.info(`📊 Response received:`, JSON.stringify(tx, null, 2));
        logger.info(`📊 Transaction state: ${tx?.state || 'NULL/UNDEFINED'}`);
        
        // ⚡ OPTIMIZATION: Accept PENDING_RISK_REVIEW, CONFIRMED, or COMPLETE
        // We just need it to be indexed, not necessarily finalized
        if (tx?.state && ['PENDING_RISK_REVIEW', 'CONFIRMED', 'COMPLETE'].includes(tx.state)) {
          logger.info(`✅ Transaction indexed after ${(i + 1) * 2}s (state: ${tx.state})`);
          return tx;
        }
        
        if (tx?.state === 'FAILED') {
          logger.error(`❌ Transaction FAILED!`);
          throw new Error('Transaction failed on blockchain');
        }

        // Log progress every 5 attempts (10 seconds)
        if (i > 0 && i % 5 === 0) {
          logger.info(`⏳ Still waiting... ${i * 2}s elapsed (state: ${tx?.state || 'unknown'})`);
        }

        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        logger.error(`❌ Error in attempt ${i + 1}/${maxAttempts}:`, {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          data: error.response?.data
        });
        
        if (i % 5 === 0) {
          logger.warn(`⚠️ Attempt ${i + 1}/${maxAttempts} - Transaction not indexed yet (this is normal for first ~10s)`);
        }
        
        // Don't throw on early attempts - transaction might not be indexed yet
        if (i === maxAttempts - 1) {
          logger.error(`❌ Transaction never became available after ${maxAttempts} attempts`);
          throw new Error(`Transaction not indexed after ${maxAttempts * 2}s - Circle API might be slow or transaction failed`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Transaction confirmation timeout');
  }

  /**
   * Step 3: Get attestation from Circle's attestation service
   * Based on Circle's tutorial: https://developers.circle.com/interactive-quickstarts/cctp
   */
  private static async getAttestation(transactionId: string, sourceChain: string, maxAttempts = 60) {
    try {
      logger.info(`📜 Step 3: Fetching attestation for transaction: ${transactionId}`);

      // Step 3a: Get transaction hash from Circle (wait if needed)
      let txHash: string | undefined;
      for (let attempt = 0; attempt < 10; attempt++) {
        const transaction = await CircleService.getTransaction(transactionId);
        txHash = transaction?.transaction?.txHash;
        
        if (txHash) {
          logger.info(`   TX Hash: ${txHash}`);
          break;
        }
        
        logger.info(`⏳ Waiting for transaction hash... (${attempt + 1}/10)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      if (!txHash) {
        throw new Error('Transaction hash not available after 30s');
      }

      // Step 3b: Poll Circle's CCTP V2 API directly (skip blockchain receipt check)
      // Based on: https://developers.circle.com/cctp/transfer-usdc-on-testnet-from-ethereum-to-avalanche
      const domainId = DOMAIN_IDS[sourceChain];
      const attestationUrl = `https://iris-api-sandbox.circle.com/v2/messages/${domainId}?transactionHash=${txHash}`;
      logger.info(`⏳ Polling CCTP V2 attestation API (max ${maxAttempts * 5}s)...`);
      logger.info(`   Domain: ${domainId}, Chain: ${sourceChain}`);
      
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const response = await axios.get(attestationUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000
          });

          // CCTP V2 returns messages array
          const message = response.data?.messages?.[0];
          
          if (message?.status === 'complete') {
            logger.info(`✅ Attestation received after ${(i + 1) * 5}s!`);
            return {
              messageBytes: message.message,
              attestation: message.attestation
            };
          }

          // Log progress every 6 attempts (30 seconds)
          if (i % 6 === 0) {
            logger.info(`⏳ Attempt ${i + 1}/${maxAttempts} - Status: ${message?.status || 'pending'}, waiting...`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5s intervals for CCTP V2
        } catch (error: any) {
          if (error.response?.status === 404) {
            // Transaction not indexed yet
            if (i % 6 === 0) {
              logger.info(`⏳ Attempt ${i + 1}/${maxAttempts} - Transaction not indexed yet, waiting...`);
            }
          } else if (i === maxAttempts - 1) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      throw new Error('Attestation timeout');
    } catch (error: any) {
      logger.error('❌ Attestation failed:', error);
      throw error;
    }
  }

  /**
   * Step 4: Mint USDC on destination chain
   * Based on Circle's tutorial: https://developers.circle.com/interactive-quickstarts/cctp
   */
  private static async mintUSDC(
    walletId: string,
    destChain: string,
    attestationData: any
  ) {
    try {
      logger.info(`✨ Step 4: Minting USDC on ${destChain}`);

      // Extract messageBytes and attestation
      const messageBytes = attestationData.messageBytes;
      const attestation = attestationData.attestation;

      // Call MessageTransmitter.receiveMessage via Circle SDK
      const mintTx = await CircleService.createContractExecution({
        walletId: walletId,
        contractAddress: MESSAGE_TRANSMITTER_ADDRESSES[destChain],
        abiFunctionSignature: 'receiveMessage(bytes,bytes)',
        abiParameters: [messageBytes, attestation],
        fee: {
          type: 'level',
          config: { feeLevel: 'HIGH' }
        }
      });

      logger.info(`✅ Mint transaction created: ${mintTx?.id}`);
      return mintTx;
    } catch (error: any) {
      logger.error('❌ Mint failed:', error);
      throw error;
    }
  }

  /**
   * Check if two chains are different (requires CCTP)
   */
  static requiresCCTP(sourceChain: string, destChain: string): boolean {
    return sourceChain !== destChain;
  }

  /**
   * Get estimated time for cross-chain transfer
   */
  static getEstimatedTime(sourceChain: string, destChain: string): number {
    // Typical CCTP transfer takes 30-60 seconds
    return 45; // seconds
  }
}

export default CCTPService;

