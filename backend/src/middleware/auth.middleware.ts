import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Middleware to verify JWT token
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as any;

    // Attach user info to request
    (req as any).user = {
      userId: decoded.userId,
      email: decoded.email
    };

    next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional auth middleware - doesn't fail if no token, just doesn't set user
 * Used for routes that work with or without authentication
 */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as any;
        (req as any).user = {
          userId: decoded.userId,
          email: decoded.email
        };
      } catch (error) {
        // Invalid token, but don't fail - just continue without user
        logger.debug('Optional auth: Invalid token, continuing without user');
      }
    }
    
    // Always continue, with or without user
    next();
  } catch (error: any) {
    // Should never happen, but just in case
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

