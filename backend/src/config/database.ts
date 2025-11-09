import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') 
    ? { rejectUnauthorized: false } 
    : undefined, // Enable SSL for Supabase
  max: 5, // Reduced for Supabase free tier (max 60 connections total)
  min: 0, // Don't keep idle connections
  idleTimeoutMillis: 10000, // Close idle connections after 10s (faster)
  connectionTimeoutMillis: 20000, // Wait up to 20s for new connections
  keepAlive: true, // Enable TCP keep-alive
  keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10s
});

// Test database connection
pool.on('connect', (client) => {
  logger.info('✅ Database client connected');
  // Set statement timeout to prevent long-running queries
  client.query('SET statement_timeout = 30000'); // 30 seconds
});

pool.on('error', (err: Error, client) => {
  // Don't crash the server on connection errors - just log them
  // Supabase pooler may close idle connections, this is normal
  if (err.message.includes('termination') || err.message.includes('shutdown')) {
    logger.warn('⚠️ Database connection closed by pooler (idle timeout) - will reconnect on next query');
  } else {
    logger.error('❌ Unexpected database error:', err);
  }
  // Don't exit - let the pool handle reconnection
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', { text, error });
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    logger.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Override release method
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release();
  };

  return client;
};

// Export pool as named export for direct import
export { pool };

export default { query, getClient, pool };

