import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { query } from '../config/database';

const router = Router();

/**
 * POST /api/assets/register
 * Register a new tokenized asset
 */
router.post('/register', asyncHandler(async (req, res) => {
  const {
    assetType,
    assetName,
    tokenId,
    ownerId,
    valuation,
    metadata
  } = req.body;

  const result = await query(`
    INSERT INTO tokenized_assets (
      asset_type, asset_name, token_id, owner_id,
      valuation_usdc, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    assetType,
    assetName,
    tokenId,
    ownerId,
    valuation,
    metadata ? JSON.stringify(metadata) : null
  ]);

  res.status(201).json({
    success: true,
    asset: result.rows[0]
  });
}));

/**
 * GET /api/assets/:id
 * Get asset details and payment history
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const assetResult = await query(`
    SELECT * FROM tokenized_assets WHERE id = $1
  `, [id]);

  if (assetResult.rows.length === 0) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  // Get related contracts
  const contractsResult = await query(`
    SELECT * FROM rwa_contracts WHERE asset_id = $1
  `, [id]);

  res.json({
    success: true,
    asset: assetResult.rows[0],
    contracts: contractsResult.rows
  });
}));

/**
 * GET /api/assets
 * List assets
 */
router.get('/', asyncHandler(async (req, res) => {
  const { ownerId, assetType } = req.query;

  let queryText = 'SELECT * FROM tokenized_assets WHERE 1=1';
  const params: any[] = [];

  if (ownerId) {
    queryText += ` AND owner_id = $${params.length + 1}`;
    params.push(ownerId);
  }

  if (assetType) {
    queryText += ` AND asset_type = $${params.length + 1}`;
    params.push(assetType);
  }

  queryText += ' ORDER BY created_at DESC';

  const result = await query(queryText, params);

  res.json({
    success: true,
    count: result.rows.length,
    assets: result.rows
  });
}));

export default router;

