const forge = require('node-forge');
const axios = require('axios');

// Your Circle API Key
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;

// Your entity secret from .env
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || 'd4548c4ffb444d00ec532c7ff91810dd5f393f3bd702503649c35f705b916e2b';

async function generateCiphertext() {
  try {
    console.log('🔐 Generating 684-character ciphertext...\n');
    
    // Step 1: Get Circle's public key
    console.log('📡 Step 1: Fetching Circle\'s public key...');
    const response = await axios.get('https://api.circle.com/v1/w3s/config/entity/publicKey', {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${CIRCLE_API_KEY}`
      }
    });
    
    const publicKeyPem = response.data.data.publicKey;
    console.log('✅ Public key received!\n');
    
    // Step 2: Convert entity secret from hex to bytes
    console.log('🔑 Step 2: Converting entity secret to bytes...');
    console.log('   Entity Secret:', ENTITY_SECRET);
    console.log('   Length:', ENTITY_SECRET.length, 'characters\n');
    
    const entitySecretBytes = forge.util.hexToBytes(ENTITY_SECRET);
    
    // Step 3: Load the public key
    console.log('🔓 Step 3: Loading public key...');
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    console.log('✅ Public key loaded!\n');
    
    // Step 4: Encrypt using RSA-OAEP with SHA-256
    console.log('🔒 Step 4: Encrypting entity secret...');
    const encryptedData = publicKey.encrypt(entitySecretBytes, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    });
    
    // Step 5: Base64 encode
    console.log('📝 Step 5: Encoding to base64...');
    const entitySecretCiphertext = forge.util.encode64(encryptedData);
    
    console.log('\n✅ SUCCESS! Ciphertext generated:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(entitySecretCiphertext);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nLength:', entitySecretCiphertext.length, 'characters');
    console.log('\n📋 COPY THE TEXT ABOVE (should be ~684 characters)');
    console.log('📋 PASTE IT into the "New entity secret ciphertext" field in Circle Console');
    console.log('\n✅ Then click "Reset" to complete the registration!');
    
    return entitySecretCiphertext;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run it
generateCiphertext();

