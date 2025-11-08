/**
 * Generate Circle Entity Secret
 * Run: node generate-entity-secret.js
 */

const { generateEntitySecret } = require('@circle-fin/developer-controlled-wallets');

console.log('🔐 Generating Entity Secret...\n');

// This generates a random 32-byte hex string
generateEntitySecret();

console.log('\n✅ Save this Entity Secret to your .env file!');
console.log('⚠️  Keep it secret and secure!');

