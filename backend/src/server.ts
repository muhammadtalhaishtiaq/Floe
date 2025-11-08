// ⚠️ CRITICAL: Load environment variables FIRST before ANY other imports!
// This ensures DATABASE_URL and other env vars are available when modules initialize
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory (one level up from backend/)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.routes';
import contractRoutes from './routes/contract.routes';
import paymentRoutes from './routes/payment.routes';
import walletRoutes from './routes/wallet.routes';
import assetRoutes from './routes/asset.routes';
import recipientRoutes from './routes/recipient.routes';
import apiKeysRoutes from './routes/api-keys.routes';
import voiceRoutes from './routes/voice.routes';
import a2aRoutes from './routes/a2a.routes'; // 🤖 A2A Agent-to-Agent payments
import requestCenterRoutes from './routes/request-center.routes'; // 🔔 Request Center for requesters

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

// Import CRON scheduler
import { initializeScheduler } from './services/scheduler.service';

// Import payment processor
import { startPaymentProcessor } from './jobs/payment-processor';

// Import A2A payment scheduler
import PaymentSchedulerService from './services/payment-scheduler.service';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// CORS - Dynamically configured from .env
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3001']; // Default fallback

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/a2a', a2aRoutes); // 🤖 A2A Agent-to-Agent payments
app.use('/api/request-center', requestCenterRoutes); // 🔔 Request Center

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

const startServer = async () => {
  try {
    // Test database connection (if not in mock mode)
    const isMockMode = process.env.USE_MOCK_AUTH === 'true';
    if (!isMockMode && process.env.DATABASE_URL) {
      logger.info('Testing database connection...');
      try {
        const { pool } = await import('./config/database');
        await pool.query('SELECT NOW()');
        logger.info('✅ Database connection successful!');
      } catch (dbError: any) {
        logger.error('❌ Database connection failed:', {
          error: dbError.message,
          code: dbError.code,
          hint: 'Check DATABASE_URL in .env file'
        });
        logger.warn('⚠️ Server will continue, but database operations may fail');
      }
    }
    
    // Initialize CRON scheduler (if enabled)
    if (process.env.ENABLE_CRON === 'true') {
      logger.info('Initializing payment scheduler...');
      initializeScheduler();
    }

    // Start automated payment processor
    logger.info('🤖 Starting automated payment processor...');
    startPaymentProcessor();
    
    // Start A2A payment scheduler (DISABLED - table schema mismatch)
    // PaymentSchedulerService.start(5); // Check every 5 minutes
    // logger.info('🤖 A2A Payment Scheduler started');
    logger.info('⏸️ A2A Payment Scheduler disabled (manual testing mode)');
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 Floe Backend running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
      logger.info(`✅ Health check: http://localhost:${PORT}/health`);
      logger.info(`🌐 CORS: Accepting requests from: ${allowedOrigins.join(', ')}`);
      
      // Database mode status
      const isMockMode = process.env.USE_MOCK_AUTH === 'true';
      if (isMockMode) {
        logger.info(`🎭 Database Mode: MOCK (no database required)`);
        logger.info(`👤 Demo users: demo@floe.io, maria@example.com, john@example.com`);
      } else {
        logger.info(`🗄️ Database Mode: REAL (PostgreSQL connected)`);
        logger.info(`💾 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'configured'}`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;

