import { Router } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * POST /api/recipients/save
 * Save a new recipient
 */
router.post('/save', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { recipient_name, wallet_address, nickname, notes } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!recipient_name || !wallet_address) {
    return res.status(400).json({ 
      success: false, 
      error: 'recipient_name and wallet_address are required' 
    });
  }

  try {
    // Check if recipient already exists for this user
    const existing = await query(`
      SELECT id FROM saved_recipients 
      WHERE user_id = $1 AND wallet_address = $2
    `, [userId, wallet_address]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Recipient already exists' 
      });
    }

    // Insert new recipient
    const result = await query(`
      INSERT INTO saved_recipients (
        user_id, recipient_name, wallet_address, nickname, notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, recipient_name, wallet_address, nickname || null, notes || null]);

    logger.info(`✅ Recipient saved: ${recipient_name} for user ${userId}`);

    res.json({
      success: true,
      recipient: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Failed to save recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save recipient'
    });
  }
}));

/**
 * GET /api/recipients/list
 * Get all saved recipients for current user
 */
router.get('/list', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await query(`
      SELECT * FROM saved_recipients
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      recipients: result.rows
    });
  } catch (error: any) {
    logger.error('Failed to fetch recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipients'
    });
  }
}));

/**
 * GET /api/recipients/:id
 * Get a specific recipient
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await query(`
      SELECT * FROM saved_recipients
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found'
      });
    }

    res.json({
      success: true,
      recipient: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Failed to fetch recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipient'
    });
  }
}));

/**
 * PUT /api/recipients/:id
 * Update a recipient
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { id } = req.params;
  const { recipient_name, wallet_address, nickname, notes } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    // Verify ownership
    const existing = await query(`
      SELECT id FROM saved_recipients
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found'
      });
    }

    // Update recipient
    const result = await query(`
      UPDATE saved_recipients
      SET 
        recipient_name = COALESCE($1, recipient_name),
        wallet_address = COALESCE($2, wallet_address),
        nickname = COALESCE($3, nickname),
        notes = COALESCE($4, notes),
        updated_at = NOW()
      WHERE id = $5 AND user_id = $6
      RETURNING *
    `, [recipient_name, wallet_address, nickname, notes, id, userId]);

    logger.info(`✅ Recipient updated: ${id}`);

    res.json({
      success: true,
      recipient: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Failed to update recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recipient'
    });
  }
}));

/**
 * DELETE /api/recipients/:id
 * Delete a recipient
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await query(`
      DELETE FROM saved_recipients
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found'
      });
    }

    logger.info(`✅ Recipient deleted: ${id}`);

    res.json({
      success: true,
      message: 'Recipient deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipient'
    });
  }
}));

export default router;

