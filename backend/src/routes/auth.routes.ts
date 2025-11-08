import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Mock mode - no database required
const MOCK_MODE = process.env.USE_MOCK_AUTH === 'true';

// Mock users for testing without database
const MOCK_USERS = [
  {
    id: 1,
    email: 'demo@floe.io',
    password: 'demo123',
    full_name: 'Demo User',
    role: 'user'
  },
  {
    id: 2,
    email: 'maria@example.com',
    password: 'maria123',
    full_name: 'Maria Rodriguez',
    role: 'user'
  }
];

/**
 * POST /api/auth/signup
 * Register a new user
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;

    logger.info(`📝 Signup attempt - Mode: ${MOCK_MODE ? 'MOCK' : 'REAL'}, Email: ${email}`);

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    // MOCK MODE
    if (MOCK_MODE) {
      const existingUser = MOCK_USERS.find(u => u.email === email);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const newUser = {
        id: MOCK_USERS.length + 1,
        email,
        full_name,
        role: 'user'
      };

      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        process.env.JWT_SECRET || 'dev_secret',
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        message: 'User created successfully',
        user: newUser,
        token
      });
    }

    // REAL MODE with database
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [email, hashedPassword, full_name, 'user']
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );

    logger.info('User signed up', { userId: user.id, email: user.email });

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error: any) {
    logger.error('❌ Signup error:', { 
      message: error.message, 
      code: error.code,
      stack: error.stack 
    });
    
    // If database error, give user helpful message
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(500).json({ 
        error: 'Database connection failed. Please check your DATABASE_URL or use mock mode.' 
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // MOCK MODE
    if (MOCK_MODE) {
      const user = MOCK_USERS.find(u => u.email === email && u.password === password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'dev_secret',
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        },
        token
      });
    }

    // REAL MODE with database
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        circle_wallet_id: user.circle_wallet_id
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');

    // MOCK MODE
    if (MOCK_MODE) {
      const user = MOCK_USERS.find(u => u.id === decoded.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      });
    }

    // REAL MODE
    const result = await pool.query(
      'SELECT id, email, full_name, role, circle_wallet_id, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logout successful' });
  res.clearCookie('auth_token');
  res.clearCookie('user');
  res.redirect('/');
});

export default router;

