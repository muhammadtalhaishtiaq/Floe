/**
 * Circle SDK Integration Test
 * 
 * Run this to verify your Circle API credentials and Arc testnet access
 * 
 * Usage: npm run test:circle
 */

// ⚠️ Load environment variables FIRST before ANY other imports!
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const testCircleIntegration = async () => {
  console.log('\n🧪 Testing Circle SDK Integration...\n');

  // Step 1: Check environment variables
  console.log('Step 1: Checking environment variables...');
  
  if (!process.env.CIRCLE_API_KEY) {
    console.error('❌ CIRCLE_API_KEY not found in .env file');
    process.exit(1);
  }
  
  if (!process.env.CIRCLE_ENTITY_SECRET) {
    console.error('❌ CIRCLE_ENTITY_SECRET not found in .env file');
    process.exit(1);
  }
  
  console.log('✅ Environment variables found');

  // Step 2: Initialize Circle client
  console.log('\nStep 2: Initializing Circle SDK client...');
  
  let client;
  try {
    client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    });
    console.log('✅ Circle SDK client initialized');
  } catch (error: any) {
    console.error('❌ Failed to initialize Circle client:', error.message);
    process.exit(1);
  }

  // Step 3: Create a test wallet
  console.log('\nStep 3: Creating test wallet on Arc testnet...');
  
  try {
    const walletResponse = await client.createWallet({
      idempotencyKey: `test-wallet-${Date.now()}`,
      entityId: `test-entity-${Date.now()}`,
      blockchains: ['ARC-TESTNET'],
    });

    const wallet = walletResponse.data?.wallet;

    if (!wallet) {
      console.error('❌ No wallet data returned');
      process.exit(1);
    }

    console.log('✅ Test wallet created successfully!');
    console.log('\n📋 Wallet Details:');
    console.log(`   Wallet ID: ${wallet.id}`);
    console.log(`   Address: ${wallet.address || 'N/A'}`);
    console.log(`   Blockchain: ${wallet.blockchain || 'ARC-TESTNET'}`);
    console.log(`   State: ${wallet.state || 'N/A'}`);
    console.log(`   Created: ${wallet.createDate || 'N/A'}`);

    // Step 4: Get wallet balance
    console.log('\nStep 4: Checking wallet balance...');
    
    try {
      const balanceResponse = await client.getWallet({ id: wallet.id });
      const balances = balanceResponse.data?.wallet?.balances || [];
      
      console.log('✅ Balance check successful!');
      console.log('\n💰 Balances:');
      
      if (balances.length === 0) {
        console.log('   No balances (wallet is empty - this is expected for new wallet)');
      } else {
        balances.forEach((balance: any) => {
          console.log(`   ${balance.currency}: ${balance.amount}`);
        });
      }
    } catch (error: any) {
      console.warn('⚠️  Could not fetch balance:', error.message);
    }

    // Step 5: List all wallets
    console.log('\nStep 5: Listing all wallets...');
    
    try {
      const listResponse = await client.listWallets({});
      const wallets = listResponse.data?.wallets || [];
      
      console.log(`✅ Found ${wallets.length} wallet(s) in your account`);
    } catch (error: any) {
      console.warn('⚠️  Could not list wallets:', error.message);
    }

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCCESS! Circle SDK integration is working!');
    console.log('='.repeat(60));
    console.log('\n✅ Next Steps:');
    console.log('   1. Copy the Wallet ID above');
    console.log('   2. Use it in your application to test payments');
    console.log('   3. Get testnet USDC from Circle (check docs)');
    console.log('   4. Start building your payment flows!');
    console.log('\n💡 Tip: Save this Wallet ID for testing\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('API Response:', {
        status: error.response.status,
        data: error.response.data,
      });
    }
    
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Verify your API keys at https://console.circle.com/');
    console.error('   2. Ensure Developer-Controlled Wallets are enabled');
    console.error('   3. Check that Arc testnet access is granted');
    console.error('   4. Regenerate keys if needed\n');
    
    process.exit(1);
  }
};

// Run the test
testCircleIntegration()
  .then(() => {
    console.log('✅ Test completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });

