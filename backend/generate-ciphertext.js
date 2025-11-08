/**
 * Generate Entity Secret Ciphertext for Circle Console
 * This creates the 684-character encrypted string needed for registration
 */

require('dotenv').config({ path: '../.env' });

const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || 'd4548c4ffb444d00ec532c7ff91810dd5f393f3bd702503649c35f705b916e2b';

if (!API_KEY) {
  console.error('❌ Add CIRCLE_API_KEY to .env file first!');
  process.exit(1);
}

if (!ENTITY_SECRET || ENTITY_SECRET.length !== 64) {
  console.error('❌ CIRCLE_ENTITY_SECRET must be exactly 64 characters (32 bytes in hex)');
  process.exit(1);
}

console.log('🔑 Using entity secret from .env:', ENTITY_SECRET.substring(0, 16) + '...');

async function generateCiphertext() {
  try {
    // Import node-forge for encryption
    const forge = require('node-forge');
    
    console.log('📡 Step 1: Fetching Circle public key...\n');
    
    // Get public key from Circle
    const response = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const publicKeyPem = data.data.publicKey;

    console.log('✅ Got public key!');
    console.log('🔐 Step 2: Encrypting entity secret...\n');

    // Convert hex to bytes
    const entitySecretBytes = forge.util.hexToBytes(ENTITY_SECRET);
    
    // Load public key
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    
    // Encrypt with RSA-OAEP
    const encryptedData = publicKey.encrypt(entitySecretBytes, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() }
    });

    // Base64 encode
    const ciphertext = forge.util.encode64(encryptedData);

    console.log('✅ Ciphertext generated! Length:', ciphertext.length, 'characters\n');
    console.log('═'.repeat(80));
    console.log('📋 COPY THIS CIPHERTEXT AND PASTE IN CIRCLE CONSOLE:');
    console.log('═'.repeat(80));
    console.log(ciphertext);
    console.log('═'.repeat(80));
    console.log('\n🎯 Steps:');
    console.log('1. Copy the ciphertext above');
    console.log('2. Go to Circle Console → DEV CONTROLLED → Configurator → Entity Secret');
    console.log('3. Paste in the "Entity Secret Ciphertext" field');
    console.log('4. Click "Register"');
    console.log('5. Come back and run: node register-entity-secret.js');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check dependencies
try {
  require('node-forge');
  generateCiphertext();
} catch (e) {
  console.error('❌ Missing dependency!');
  console.error('   Run: npm install node-forge');
  console.error('   Then run this script again');
}

