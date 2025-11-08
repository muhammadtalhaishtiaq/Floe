import { Router } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/encryption.util';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * POST /api/api-keys/save
 * Save or update an API key for a service
 */
router.post('/save', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { service_name, api_key, additional_config } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!service_name || !api_key) {
    return res.status(400).json({ 
      success: false, 
      error: 'service_name and api_key are required' 
    });
  }

  // Validate service name
  const validServices = ['elevenlabs', 'cloudflare', 'openai'];
  if (!validServices.includes(service_name)) {
    return res.status(400).json({
      success: false,
      error: `Invalid service_name. Must be one of: ${validServices.join(', ')}`
    });
  }

  try {
    // Encrypt the API key
    const encryptedKey = encrypt(api_key);

    // Check if key already exists for this service
    const existing = await query(`
      SELECT id FROM user_api_keys 
      WHERE user_id = $1 AND service_name = $2
    `, [userId, service_name]);

    if (existing.rows.length > 0) {
      // Update existing key
      const result = await query(`
        UPDATE user_api_keys
        SET api_key_encrypted = $1, additional_config = $2, updated_at = NOW()
        WHERE user_id = $3 AND service_name = $4
        RETURNING id, service_name, is_active, created_at, updated_at
      `, [encryptedKey, additional_config ? JSON.stringify(additional_config) : null, userId, service_name]);

      logger.info(`✅ API key updated for ${service_name} by user ${userId}`);

      res.json({
        success: true,
        message: 'API key updated successfully',
        apiKey: result.rows[0]
      });
    } else {
      // Insert new key
      const result = await query(`
        INSERT INTO user_api_keys (user_id, service_name, api_key_encrypted, additional_config)
        VALUES ($1, $2, $3, $4)
        RETURNING id, service_name, is_active, created_at, updated_at
      `, [userId, service_name, encryptedKey, additional_config ? JSON.stringify(additional_config) : null]);

      logger.info(`✅ API key saved for ${service_name} by user ${userId}`);

      res.json({
        success: true,
        message: 'API key saved successfully',
        apiKey: result.rows[0]
      });
    }
  } catch (error: any) {
    logger.error('Failed to save API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save API key'
    });
  }
}));

/**
 * GET /api/api-keys/list
 * Get all API keys for current user (without decrypted values)
 */
router.get('/list', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await query(`
      SELECT id, service_name, is_active, additional_config, created_at, updated_at
      FROM user_api_keys
      WHERE user_id = $1
      ORDER BY service_name ASC
    `, [userId]);

    res.json({
      success: true,
      apiKeys: result.rows
    });
  } catch (error: any) {
    logger.error('Failed to fetch API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API keys'
    });
  }
}));

/**
 * GET /api/api-keys/:service_name
 * Get API key for a specific service (INTERNAL USE - returns decrypted key)
 */
router.get('/:service_name/decrypt', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { service_name } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await query(`
      SELECT api_key_encrypted, additional_config
      FROM user_api_keys
      WHERE user_id = $1 AND service_name = $2 AND is_active = true
    `, [userId, service_name]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No API key found for ${service_name}`
      });
    }

    const decryptedKey = decrypt(result.rows[0].api_key_encrypted);

    res.json({
      success: true,
      api_key: decryptedKey,
      additional_config: result.rows[0].additional_config
    });
  } catch (error: any) {
    logger.error('Failed to decrypt API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decrypt API key'
    });
  }
}));

/**
 * DELETE /api/api-keys/:service_name
 * Delete API key for a service
 */
router.delete('/:service_name', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { service_name } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await query(`
      DELETE FROM user_api_keys
      WHERE user_id = $1 AND service_name = $2
      RETURNING id
    `, [userId, service_name]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    logger.info(`✅ API key deleted for ${service_name} by user ${userId}`);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key'
    });
  }
}));

/**
 * PATCH /api/api-keys/:service_name/toggle
 * Toggle API key active status
 */
router.patch('/:service_name/toggle', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { service_name } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await query(`
      UPDATE user_api_keys
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE user_id = $1 AND service_name = $2
      RETURNING is_active
    `, [userId, service_name]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    res.json({
      success: true,
      is_active: result.rows[0].is_active
    });
  } catch (error: any) {
    logger.error('Failed to toggle API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle API key'
    });
  }
}));

export default router;

