import express from 'express';
import { authRequired } from '../middleware/auth.js';

export default function createFavoritesRouter(pool) {
  const router = express.Router();
  
  // Get user's favorites
  router.get('/user/favorites', authRequired, async (req, res) => {
    try {
      const userId = req.user.uid;
      if (!userId) return res.status(401).json({ error: 'User ID required' });

      const [rows] = await pool.query(
          `SELECT f.id, f.item_id, f.item_type, f.created_at, f.metadata,
                  CASE 
                    WHEN f.item_type = 'dish' THEN COALESCE(d.name, 'Unnamed Dish')
                    WHEN f.item_type = 'restaurant' THEN COALESCE(r.name, 'Unnamed Restaurant')
                  END as item_name,
                  CASE 
                    WHEN f.item_type = 'dish' THEN COALESCE(d.image_url, '')
                    WHEN f.item_type = 'restaurant' THEN COALESCE(r.image_url, '')
                  END as item_image_url
           FROM user_favorites f
           LEFT JOIN dishes d ON f.item_type = 'dish' AND f.item_id = d.id
           LEFT JOIN restaurants r ON f.item_type = 'restaurant' AND f.item_id = r.id
           WHERE f.user_id = ?
           ORDER BY f.created_at DESC`,
          [userId]
        );

        // Parse metadata JSON for each row
        const result = rows.map(row => ({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        }));

        res.json(result);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });

  // Add favorite
  router.post('/user/favorites', authRequired, async (req, res) => {
    try {
      const userId = req.user.uid;
      const { itemId, itemType } = req.body;

      if (!userId || !itemId || !itemType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!['dish', 'restaurant'].includes(itemType)) {
        return res.status(400).json({ error: 'Invalid item type' });
      }

      // Check if favorite already exists
      const [existing] = await pool.query(
        'SELECT id FROM user_favorites WHERE user_id = ? AND item_id = ? AND item_type = ?',
        [userId, itemId, itemType]
      );

      if (existing.length > 0) {
        return res.status(409).json({ error: 'Item already favorited' });
      }

      // Add new favorite
      await pool.query(
        'INSERT INTO user_favorites (user_id, item_id, item_type) VALUES (?, ?, ?)',
        [userId, itemId, itemType]
      );

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  });

  // Remove favorite
  router.delete('/user/favorites/:itemType/:itemId', authRequired, async (req, res) => {
    try {
      const userId = req.user.uid;
      const { itemType, itemId } = req.params;

      if (!['dish', 'restaurant'].includes(itemType)) {
        return res.status(400).json({ error: 'Invalid item type' });
      }

      await pool.query(
        'DELETE FROM user_favorites WHERE user_id = ? AND item_id = ? AND item_type = ?',
        [userId, itemId, itemType]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });

  // Get favorites status for multiple items
  router.post('/user/favorites/status', authRequired, async (req, res) => {
    try {
      const userId = req.user.uid;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array required' });
      }

      // Build query for multiple items
      const placeholders = items.map(() => '(user_id = ? AND item_id = ? AND item_type = ?)').join(' OR ');
      const params = items.flatMap(item => [userId, item.itemId, item.itemType]);

      const [rows] = await pool.query(
        `SELECT item_id, item_type FROM user_favorites WHERE ${placeholders}`,
        params
      );

      // Create a map of favorites
      const favorites = rows.reduce((acc, { item_id, item_type }) => {
        acc[`${item_type}-${item_id}`] = true;
        return acc;
      }, {});

      // Return status for each requested item
      const status = items.reduce((acc, { itemId, itemType }) => {
        acc[`${itemType}-${itemId}`] = !!favorites[`${itemType}-${itemId}`];
        return acc;
      }, {});

      res.json(status);
    } catch (error) {
      console.error('Error checking favorites status:', error);
      res.status(500).json({ error: 'Failed to check favorites status' });
    }
  });

  return router;
}