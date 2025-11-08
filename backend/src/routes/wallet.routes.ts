import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import CircleService, { circleClient } from '../services/circle.service';
import { query } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/wallets/test-config
 * Test Circle API configuration (for debugging)
 */
router.get('/test-config', asyncHandler(async (req, res) => {
  const hasApiKey = !!process.env.CIRCLE_API_KEY;
  const hasEntitySecret = !!process.env.CIRCLE_ENTITY_SECRET;
  const hasBlockchain = !!process.env.BLOCKCHAIN_NETWORK;
  
  logger.info('Circle config test:', {
    hasApiKey,
    hasEntitySecret,
    hasBlockchain,
    blockchain: process.env.BLOCKCHAIN_NETWORK,
    apiKeyLength: process.env.CIRCLE_API_KEY?.length,
    secretLength: process.env.CIRCLE_ENTITY_SECRET?.length
  });
  
  res.json({
    success: true,
    config: {
      hasApiKey,
      hasEntitySecret,
      hasBlockchain,
      blockchain: process.env.BLOCKCHAIN_NETWORK || 'Not set',
      apiKeyPresent: hasApiKey ? `${process.env.CIRCLE_API_KEY?.slice(0, 10)}...` : 'Missing',
      entitySecretPresent: hasEntitySecret ? `${process.env.CIRCLE_ENTITY_SECRET?.slice(0, 10)}...` : 'Missing'
    }
  });
}));

/**
 * POST /api/wallets/create
 * Create a new Circle wallet for a user (supports MULTIPLE wallets)
 * 1. Create wallet set (if user doesn't have one)
 * 2. Create wallet within that set
 * 3. Store wallet info in user_wallets table with custom name
 */
router.post('/create', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { blockchain, walletName } = req.body; // NEW: walletName from user

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Check if user has a wallet set (they can have multiple wallets in one set)
    const existing = await query(`
      SELECT circle_wallet_set_id FROM users WHERE id = $1
    `, [userId]);

    const user = existing.rows[0];
    
    // Step 1: Create or get wallet set
    let walletSetId = user?.circle_wallet_set_id;
    
    if (!walletSetId) {
      logger.info(`Creating wallet set for user ${userId}`);
      const walletSet = await CircleService.createWalletSet(`User ${userId} Wallet Set`);
      walletSetId = walletSet.id;
      
      // Store wallet set ID in users table
      await query(`
        UPDATE users SET circle_wallet_set_id = $1 WHERE id = $2
      `, [walletSetId, userId]);
      
      logger.info(`✅ Wallet set created: ${walletSetId}`);
    }

    // Step 2: Create NEW wallet in the set
    const targetBlockchain = blockchain || process.env.BLOCKCHAIN_NETWORK || 'MATIC-AMOY';
    const finalWalletName = walletName || 'Main Wallet';
    logger.info(`Creating wallet "${finalWalletName}" on ${targetBlockchain} for user ${userId}`);
    
    const wallet = await CircleService.createWallet(walletSetId, targetBlockchain, finalWalletName);

    // Step 3: Check if this is the first wallet (make it primary)
    const walletCountResult = await query(`
      SELECT COUNT(*) as count FROM user_wallets WHERE user_id = $1
    `, [userId]);
    
    const isFirstWallet = parseInt(walletCountResult.rows[0].count) === 0;

    // Step 4: Store wallet in user_wallets table with custom name AND blockchain
    const result = await query(`
      INSERT INTO user_wallets (
        id, user_id, circle_wallet_id, circle_wallet_address, 
        wallet_name, blockchain, is_primary
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      userId, 
      wallet.id, 
      wallet.address, 
      walletName || 'Main Wallet',  // Default name if not provided
      targetBlockchain,               // Store the blockchain network
      isFirstWallet                   // First wallet is primary
    ]);

    // Step 5: If first wallet, also update users table for backward compatibility
    if (isFirstWallet) {
      await query(`
        UPDATE users
        SET circle_wallet_id = $1, circle_wallet_address = $2
        WHERE id = $3
      `, [wallet.id, wallet.address, userId]);
    }

    logger.info(`✅ Wallet created successfully: ${wallet.id} at ${wallet.address}`);

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        accountType: wallet.accountType,
        state: wallet.state,
        walletSetId: walletSetId,
        name: result.rows[0].wallet_name,
        isPrimary: result.rows[0].is_primary
      }
    });
  } catch (error: any) {
    // Safely extract error info without circular references
    const errorMessage = error.message || 'Failed to create wallet';
    const errorDetails = error.response?.data || null;
    const errorCode = error.code || null;
    const statusCode = error.response?.status || 500;
    
    logger.error('Wallet creation failed:', {
      userId,
      message: errorMessage,
      code: errorCode,
      status: statusCode,
      details: errorDetails
    });
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: errorDetails
    });
  }
}));

/**
 * GET /api/wallets/me
 * Get current user's wallets (ALL wallets)
 */
router.get('/me', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const result = await query(`
    SELECT 
      id,
      circle_wallet_id, 
      circle_wallet_address, 
      wallet_name,
      is_primary,
      blockchain,
      created_at
    FROM user_wallets
    WHERE user_id = $1
    ORDER BY is_primary DESC, created_at ASC
  `, [userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No wallets found. Create a wallet first.'
    });
  }

  // Get primary wallet (or first one)
  const primaryWallet = result.rows.find(w => w.is_primary) || result.rows[0];

  // Fetch balances for ALL wallets in parallel
  const walletsWithBalances = await Promise.all(
    result.rows.map(async (w) => {
      let balance = null;
      try {
        balance = await CircleService.getWalletBalance(w.circle_wallet_id);
      } catch (error) {
        logger.warn(`Could not fetch balance for wallet ${w.circle_wallet_id}: ${error}`);
      }
      return {
        id: w.circle_wallet_id,
        address: w.circle_wallet_address,
        name: w.wallet_name,
        blockchain: w.blockchain,
        isPrimary: w.is_primary,
        createdAt: w.created_at,
        balance
      };
    })
  );

  // Get primary wallet balance
  const primaryWalletData = walletsWithBalances.find(w => w.isPrimary) || walletsWithBalances[0];

  res.json({
    success: true,
    wallets: walletsWithBalances,
    primaryWallet: primaryWalletData
  });
}));

/**
 * GET /api/wallets/:walletId/balance
 * Get USDC balance for a wallet
 */
router.get('/:walletId/balance', asyncHandler(async (req, res) => {
  const { walletId } = req.params;

  const balance = await CircleService.getWalletBalance(walletId);

  res.json({
    success: true,
    walletId,
    balance,
    currency: 'USDC'
  });
}));

/**
 * GET /api/wallets/:walletId
 * Get wallet details
 */
router.get('/:walletId', asyncHandler(async (req, res) => {
  const { walletId } = req.params;

  const walletData = await CircleService.getWalletBalance(walletId);

  res.json({
    success: true,
    wallet: walletData
  });
}));

/**
 * GET /api/wallets
 * List all wallets (optionally filter by entityId)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { entityId } = req.query;

  const wallets = await CircleService.listWallets(entityId as string);

  res.json({
    success: true,
    count: wallets.length,
    wallets
  });
}));

/**
 * GET /api/wallets/:walletId/transactions
 * Get transaction history for a specific wallet
 */
router.get('/:walletId/transactions', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { walletId } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Verify wallet belongs to user AND get address in one query
  const walletCheck = await query(`
    SELECT circle_wallet_id, circle_wallet_address 
    FROM user_wallets 
    WHERE user_id = $1 AND circle_wallet_id = $2
  `, [userId, walletId]);

  if (walletCheck.rows.length === 0) {
    return res.status(403).json({ error: 'Wallet does not belong to user' });
  }

  const walletAddress = walletCheck.rows[0].circle_wallet_address?.toLowerCase();

  // Get transactions from Circle API
  const circleTransactions = await CircleService.getWalletTransactions(walletId, limit);
  
  logger.info(`📊 Transactions for wallet ${walletId} (${walletAddress}):`);
  logger.info(`   Found ${circleTransactions.length} transactions`);
  
  // Map Circle transactions to our format
  const transactions = circleTransactions.map((tx: any) => {
    const isSent = tx.sourceAddress?.toLowerCase() === walletAddress?.toLowerCase();
    const type = isSent ? 'sent' : 'received';
    const amount = tx.amounts?.[0] ? parseFloat(tx.amounts[0]) : 0;
    
    logger.info(`   TX ${tx.id}: ${type} ${amount} USDC (${tx.state})`);
    
    return {
      id: tx.id,
      type: type,
      amount: amount,
      hash: tx.txHash,
      status: tx.state?.toLowerCase() || 'pending',
      blockchain: tx.blockchain,
      destinationAddress: tx.destinationAddress,
      sourceAddress: tx.sourceAddress,
      createdAt: tx.createDate,
      blockHeight: tx.blockHeight
    };
  });

  res.json({
    success: true,
    walletId,
    transactions
  });
}));

/**
 * POST /api/wallets/detect-blockchain
 * Detect blockchain for a wallet address using Circle API
 */
router.post('/detect-blockchain', asyncHandler(async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  try {
    logger.info(`🔍 Detecting blockchain for address: ${address}`);
    
    // Step 1: Check our database first (fastest & most reliable)
    const dbResult = await query(`
      SELECT blockchain, circle_wallet_address, wallet_name
      FROM user_wallets
      WHERE LOWER(circle_wallet_address) = LOWER($1)
      LIMIT 1
    `, [address]);

    if (dbResult.rows.length > 0) {
      const wallet = dbResult.rows[0];
      logger.info(`✅ Found in database: ${wallet.blockchain}`);
      
      return res.json({
        success: true,
        blockchain: wallet.blockchain,
        address: wallet.circle_wallet_address
      });
    }

    logger.info(`⏳ Not in database, checking Circle API...`);

    // Step 2: Check Circle API - list all wallets to find wallet ID
    const listResponse = await circleClient.listWallets({});
    const allWallets = listResponse.data?.wallets || [];
    
    const walletMatch = allWallets.find((w: any) => 
      w.address?.toLowerCase() === address.toLowerCase()
    );

    if (walletMatch && walletMatch.id) {
      logger.info(`⏳ Found wallet ID: ${walletMatch.id}, fetching details...`);
      
      // Step 3: Get wallet details by ID (this should return correct blockchain)
      const walletResponse = await circleClient.getWallet({ id: walletMatch.id });
      const walletDetails = walletResponse.data?.wallet;
      
      if (walletDetails && walletDetails.blockchain) {
        logger.info(`✅ Found in Circle: ${walletDetails.blockchain}`);
        
        return res.json({
          success: true,
          blockchain: walletDetails.blockchain,
          address: walletDetails.address
        });
      }
    }

    logger.warn(`❌ Wallet not found anywhere for address: ${address}`);
    
    // Step 4: Not found anywhere - return UNKNOWN
    return res.json({
      success: true,
      blockchain: 'UNKNOWN',
      address: address
    });
  } catch (error: any) {
    logger.error('Failed to detect blockchain:', error);
    return res.json({
      success: true,
      blockchain: 'UNKNOWN',
      address: address
    });
  }
}));

/**
 * POST /api/wallets/:walletId/send
 * Send USDC from one wallet to another (wallet-to-wallet transfer)
 * 🚀 NOW SUPPORTS CROSS-CHAIN TRANSFERS VIA CCTP!
 */
router.post('/:walletId/send', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { walletId } = req.params;
  const { to, amount, note, destChain } = req.body; // Added destChain param

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!to || !amount) {
    return res.status(400).json({ error: 'Recipient address and amount are required' });
  }

  try {
    logger.info(`🔍 Looking for wallet: ${walletId} for user: ${userId}`);
    
    // Verify wallet belongs to user and get blockchain info
    const walletCheck = await query(`
      SELECT id, circle_wallet_id, wallet_name, circle_wallet_address, blockchain
      FROM user_wallets
      WHERE circle_wallet_id = $1 AND user_id = $2
    `, [walletId, userId]);

    logger.info(`📊 Query result: ${walletCheck.rows.length} rows found`);
    
    if (walletCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Wallet not found or does not belong to you',
        debug: { walletId, userId }
      });
    }

    const sourceWallet = walletCheck.rows[0];
    const sourceChain = sourceWallet.blockchain || 'ARC-TESTNET';
    const destinationChain = destChain || sourceChain; // Default to same chain if not specified

    logger.info(`💸 Transfer initiated: ${sourceWallet.wallet_name} (${sourceChain}) → ${to.slice(0, 10)}... (${destinationChain}) ($${amount})`);

    // 🚀 USE UNIFIED TRANSFER FUNCTION - handles both same-chain and cross-chain!
    const payment = await CircleService.transferUSDC({
      sourceWalletId: sourceWallet.circle_wallet_id,
      sourceChain: sourceChain,
      destWalletAddress: to,
      destChain: destinationChain,
      amount: amount.toString(),
      metadata: {
        type: 'wallet_transfer',
        note: note || 'Wallet-to-wallet transfer',
        source_wallet_name: sourceWallet.wallet_name,
        cross_chain: sourceChain !== destinationChain
      }
    });

    logger.info(`✅ Transfer successful: ${payment?.id || payment?.burnTx}`);

    // Handle response format (different for CCTP vs direct transfer)
    const isCrossChain = sourceChain !== destinationChain;
    
    res.json({
      success: true,
      transfer: {
        id: payment?.id || payment?.burnTx || 'unknown',
        from: sourceWallet.circle_wallet_address,
        to: to,
        amount: amount,
        status: payment?.state || (isCrossChain ? 'bridging' : 'pending'),
        note: note,
        crossChain: isCrossChain,
        sourceChain: sourceChain,
        destChain: destinationChain,
        ...(isCrossChain && {
          burnTx: payment?.burnTx,
          mintTx: payment?.mintTx,
          attestation: payment?.attestation
        })
      }
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to send USDC';
    const errorDetails = error.response?.data || null;
    
    logger.error('Transfer failed:', {
      userId,
      walletId,
      to,
      amount,
      message: errorMessage,
      details: errorDetails
    });

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: errorDetails
    });
  }
}));

export default router;

