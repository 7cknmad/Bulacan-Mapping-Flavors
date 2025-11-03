// api/routes/reviews.js
import express from 'express';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

export default function initReviewsRoutes(pool) {
  // Add a new review/rating
  router.post('/api/reviews/:type/:id', authRequired, async (req, res) => {
    try {
      const { type, id } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user.uid;

      // Validate input
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Invalid review data' });
      }

      if (!['dish', 'restaurant'].includes(type)) {
        return res.status(400).json({ error: 'Invalid review type' });
      }

      // Check if item exists
      const table = type === 'dish' ? 'dishes' : 'restaurants';
      const [[item]] = await pool.query(`SELECT id FROM ${table} WHERE id = ?`, [id]);
      if (!item) {
        return res.status(404).json({ error: `${type} not found` });
      }

      // Check for existing review from this user
      const [[existing]] = await pool.query(
        'SELECT id FROM ratings WHERE user_id = ? AND rateable_id = ? AND rateable_type = ?',
        [userId, id, type]
      );

      if (existing) {
        // Update existing review
        await pool.query(
          `UPDATE ratings 
           SET rating = ?, 
               comment = ?, 
               updated_at = NOW()
           WHERE id = ?`,
          [rating, comment || null, existing.id]
        );
      } else {
        // Create new review
        await pool.query(
          `INSERT INTO ratings 
           (user_id, rateable_id, rateable_type, rating, comment, weight)
           VALUES (?, ?, ?, ?, ?, 1.0)`,
          [userId, id, type, rating, comment || null]
        );
      }

      // The triggers will automatically update avg_rating and total_ratings

      // Get updated rating stats
      const [[stats]] = await pool.query(
        `SELECT avg_rating, total_ratings
         FROM ${table}
         WHERE id = ?`,
        [id]
      );

      res.json({ 
        message: existing ? 'Review updated' : 'Review added',
        stats: {
          avg_rating: stats.avg_rating,
          total_ratings: stats.total_ratings
        }
      });

    } catch (error) {
      console.error('Review creation error:', error);
      res.status(500).json({ error: 'Failed to save review' });
    }
  });

  // Get reviews for a dish/restaurant
  router.get('/api/reviews/:type/:id', async (req, res) => {
    try {
      console.log('[GET /api/reviews] Start processing request');
      console.log('[GET /api/reviews] Request params:', req.params);
      const { type, id } = req.params;

      // Basic validation
      if (!type || !id) {
        console.error('[GET /api/reviews] Missing parameters:', { type, id });
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const itemId = Number(id);
      if (!Number.isFinite(itemId)) {
        console.error('[GET /api/reviews] Invalid ID format:', id);
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      const page = Number(req.query.page) || 1;
      const perPage = Number(req.query.perPage) || 10;
      
      console.log('[GET /api/reviews] Parsed params:', { type, itemId, page, perPage });
      
      if (!['dish', 'restaurant'].includes(type)) {
        console.error('[GET /api/reviews] Invalid type:', type);
        return res.status(400).json({ error: 'Invalid type' });
      }

      // Validate that the item exists
      const dbType = type === 'dish' ? 'dishes' : 'restaurants';
      const [[item]] = await pool.query(
        `SELECT id, name FROM ${dbType} WHERE id = ?`,
        [itemId]
      );

      if (!item) {
        console.error(`[GET /api/reviews] ${type} not found:`, itemId);
        return res.status(404).json({ error: `${type} not found` });
      }

      console.log(`[GET /api/reviews] Found ${type}:`, item);

      // Get total count
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total 
         FROM ratings 
         WHERE rateable_type = ? AND rateable_id = ?`,
        [type, itemId]
      );

      console.log('[GET /api/reviews] Total reviews:', total);

      // Get paginated reviews with basic info first
      const [reviews] = await pool.query(
        `SELECT 
           r.id,
           r.rating,
           r.comment,
           r.weight,
           r.is_verified_visit,
           r.response_text,
           r.response_date,
           r.created_at,
           r.updated_at,
           u.display_name as user_name,
           ru.display_name as response_by_name,
           COALESCE(
             (SELECT COUNT(*) FROM review_votes WHERE review_id = r.id AND vote_type = 'helpful'),
             0
           ) as helpful_votes,
           COALESCE(
             (SELECT COUNT(*) FROM review_votes WHERE review_id = r.id AND vote_type = 'report'),
             0
           ) as report_votes,
           '[]' as helpful_user_ids,
           '[]' as reported_user_ids
        FROM ratings r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN users ru ON r.response_by = ru.id
        WHERE r.rateable_type = ? AND r.rateable_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?`,
        [type, itemId, perPage, (page - 1) * perPage]
      );

      res.json(reviews);

    } catch (error) {
      console.error('Error fetching reviews:', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        sqlMessage: error.sqlMessage
      });
      res.status(500).json({ 
        error: 'Failed to fetch reviews',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }
  });

  // Delete a review (only allowed for own reviews or by admin)
  router.delete('/api/reviews/:id', authRequired, async (req, res) => {
    try {
      const reviewId = req.params.id;
      const userId = req.user.uid;

      // Check if review exists and user has permission
      const [[review]] = await pool.query(
        `SELECT r.*, u.role as user_role
         FROM ratings r
         JOIN users u ON u.id = ?
         WHERE r.id = ?`,
        [userId, reviewId]
      );

      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (review.user_id !== userId && review.user_role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this review' });
      }

      // Delete the review
      await pool.query('DELETE FROM ratings WHERE id = ?', [reviewId]);

      // The triggers will automatically update avg_rating and total_ratings

      res.json({ message: 'Review deleted' });

    } catch (error) {
      console.error('Error deleting review:', error);
      res.status(500).json({ error: 'Failed to delete review' });
    }
  });

  // Get rating statistics for an item
  router.get('/api/:type/:id/rating-stats', async (req, res) => {
    try {
      const { type, id } = req.params;

      if (!['dishes', 'restaurants'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }

      const [[stats]] = await pool.query(
        `SELECT 
           AVG(rating) as average,
           COUNT(*) as total,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
         FROM ratings
         WHERE rateable_type = ? AND rateable_id = ?`,
        [type.slice(0, -1), id]
      );

      res.json({
        ...stats,
        average: Number(stats.average || 0).toFixed(1),
        distribution: {
          5: stats.five_star || 0,
          4: stats.four_star || 0,
          3: stats.three_star || 0,
          2: stats.two_star || 0,
          1: stats.one_star || 0
        }
      });

    } catch (error) {
      console.error('Error fetching rating stats:', error);
      res.status(500).json({ error: 'Failed to fetch rating statistics' });
    }
  });

  return router;
}