#!/usr/bin/env node

/**
 * Supabase Database Setup Script
 * 
 * This script automatically loads schema.sql and seed.sql into your Supabase database
 * 
 * Usage:
 *   node setup-supabase.js <connection_string>
 * 
 * Example:
 *   node setup-supabase.js "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupDatabase() {
  // Get connection string from command line or environment variable
  const connectionString = process.argv[2] || process.env.DATABASE_URL;

  if (!connectionString) {
    log('❌ Error: No connection string provided!', 'red');
    log('\nUsage:', 'yellow');
    log('  node setup-supabase.js <connection_string>', 'cyan');
    log('\nExample:', 'yellow');
    log('  node setup-supabase.js "postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres"', 'cyan');
    log('\nOr set DATABASE_URL environment variable:', 'yellow');
    log('  DATABASE_URL="postgresql://..." node setup-supabase.js', 'cyan');
    process.exit(1);
  }

  log('\n🚀 Starting Supabase Database Setup...', 'cyan');
  log('━'.repeat(60), 'blue');

  // Read SQL files
  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  if (!fs.existsSync(schemaPath)) {
    log('❌ Error: schema.sql not found!', 'red');
    log(`Expected location: ${schemaPath}`, 'yellow');
    process.exit(1);
  }

  if (!fs.existsSync(seedPath)) {
    log('❌ Error: seed.sql not found!', 'red');
    log(`Expected location: ${seedPath}`, 'yellow');
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  log('✅ SQL files loaded', 'green');

  // Create database client
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL
  });

  try {
    // Connect to database
    log('\n📡 Connecting to Supabase...', 'cyan');
    await client.connect();
    log('✅ Connected successfully!', 'green');

    // Execute schema
    log('\n📋 Loading schema.sql...', 'cyan');
    await client.query(schemaSql);
    log('✅ Schema created successfully!', 'green');

    // Execute seed data
    log('\n🌱 Loading seed.sql (test data)...', 'cyan');
    const seedResult = await client.query(seedSql);
    log('✅ Seed data loaded successfully!', 'green');

    // Show summary
    log('\n📊 Database Summary:', 'cyan');
    log('━'.repeat(60), 'blue');

    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM rwa_contracts) as contracts_count,
        (SELECT COUNT(*) FROM transactions) as transactions_count,
        (SELECT COUNT(*) FROM tokenized_assets) as assets_count,
        (SELECT COUNT(*) FROM payment_schedules) as schedules_count
    `);

    const stats = counts.rows[0];
    log(`  👥 Users:           ${stats.users_count}`, 'green');
    log(`  📝 Contracts:       ${stats.contracts_count}`, 'green');
    log(`  💰 Transactions:    ${stats.transactions_count}`, 'green');
    log(`  🏢 Assets:          ${stats.assets_count}`, 'green');
    log(`  📅 Schedules:       ${stats.schedules_count}`, 'green');

    // Show test user
    log('\n🔑 Test User Credentials:', 'cyan');
    log('━'.repeat(60), 'blue');
    log('  Email:    demo@floe.io', 'yellow');
    log('  Password: demo123', 'yellow');

    log('\n🎉 Setup Complete!', 'green');
    log('━'.repeat(60), 'blue');
    log('\nNext steps:', 'cyan');
    log('  1. Update your .env file with the connection string', 'yellow');
    log('  2. Set USE_MOCK_AUTH=false in .env', 'yellow');
    log('  3. Run: cd backend && npm run dev', 'yellow');
    log('  4. Login with demo@floe.io / demo123', 'yellow');

  } catch (error) {
    log('\n❌ Setup Failed!', 'red');
    log('━'.repeat(60), 'red');
    
    if (error.code === 'ECONNREFUSED') {
      log('Connection refused. Check your connection string and internet.', 'red');
    } else if (error.message.includes('password authentication failed')) {
      log('Password authentication failed. Check your database password.', 'red');
    } else if (error.message.includes('SSL')) {
      log('SSL connection required. Make sure SSL is enabled in your connection.', 'red');
    } else {
      log(`Error: ${error.message}`, 'red');
    }
    
    log('\nFull error:', 'yellow');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run setup
setupDatabase();

