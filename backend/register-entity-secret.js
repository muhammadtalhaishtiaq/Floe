/**
 * Simple Circle API Test & Entity Secret Registration
 * 
 * This script will:
 * 1. Test your Circle API key
 * 2. Automatically register entity secret (SDK handles it)
 * 3. Create a test wallet set
 */

require('dotenv').config({ path: '../.env' });
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');

const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = 'd1798f3df81e2de27cbed2fc222e0fdefddb6949593bf594f0952d2f87208643';

if (!API_KEY || API_KEY === 'YOUR_CIRCLE_API_KEY_HERE') {
  console.error('❌ ERROR: Add your Circle API key to .env file!');
  console.error('\nAdd these lines to .env file:');
  console.error('CIRCLE_API_KEY=your_actual_api_key');
  console.error('CIRCLE_ENTITY_SECRET=' + ENTITY_SECRET);
  process.exit(1);
}

console.log('🔐 Testing Circle API...\n');

// Initialize client (SDK auto-registers entity secret on first use)
const client = initiateDeveloperControlledWalletsClient({
  apiKey: API_KEY,
  entitySecret: ENTITY_SECRET
});

async function test() {
  try {
    console.log('📡 Creating test wallet set...');
    
    // Create a test wallet set (this will auto-register entity secret if needed)
    const response = await client.createWalletSet({
      name: 'Test Wallet Set - ' + Date.now()
    });
    
    console.log('\n✅✅✅ SUCCESS! Circle API is working! ✅✅✅');
    console.log('\n📊 Wallet Set Created:');
    console.log('   ID:', response.data?.walletSet?.id);
    console.log('   Custody:', response.data?.walletSet?.custodyType);
    console.log('\n🎉 Entity Secret automatically registered by SDK!');
    console.log('\n🎯 Next Steps:');
    console.log('1. ✅ Circle API connected');
    console.log('2. ✅ Entity Secret registered');
    console.log('3. Run SQL migration in Supabase');
    console.log('4. Restart backend: npm run dev');
    console.log('5. Test wallet creation!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message && error.message.includes('401')) {
      console.error('\n💡 SOLUTION: Invalid API key!');
      console.error('   Get your API key from: https://console.circle.com/');
      console.error('   Then add to .env:');
      console.error('   CIRCLE_API_KEY=your_actual_key_here');
    } else if (error.message && error.message.includes('Entity Secret')) {
      console.error('\n💡 SOLUTION: Register entity secret manually:');
      console.error('   1. Go to: https://console.circle.com/');
      console.error('   2. Navigate to "Configurator"');
      console.error('   3. Register entity secret: ' + ENTITY_SECRET);
    } else {
      console.error('\n💡 Check:');
      console.error('   - Internet connection');
      console.error('   - API key is valid');
      console.error('   - SDK version is correct');
    }
    
    console.error('\nFull error:', error);
  }
}

test();
