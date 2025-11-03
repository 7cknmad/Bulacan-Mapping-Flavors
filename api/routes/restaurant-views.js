// src/api/routes/restaurant-views.js
import express from 'express';
const router = express.Router();

export default function initRestaurantViewsRoutes(pool) {
  // Get top viewed and rated restaurants by municipality
  router.get('/api/municipalities/:id/top-restaurants', async (req, res) => {
    try {
      const municipalityId = Number(req.params.id);
      if (!Number.isFinite(municipalityId)) {
        return res.status(400).json({ error: 'Invalid municipality ID' });
      }

      // Get top 3 restaurants based on rating and views 
      const [restaurants] = await pool.query(`
        SELECT 
          r.id,
          r.name,
          r.description,
          r.address,
          r.avg_rating,
          r.total_ratings,
          r.popularity,
          r.image_url,
          r.featured,
          r.featured_rank,
          r.price_range,
          r.slug
        FROM restaurants r
        WHERE r.municipality_id = ? 
        ORDER BY
          COALESCE(r.featured, 0) DESC, -- Featured first
          COALESCE(r.featured_rank, 999), -- Lower rank = higher priority  
          COALESCE(r.avg_rating, 0) DESC, -- Then by rating
          COALESCE(r.total_ratings, 0) DESC, -- Then by number of ratings
          COALESCE(r.popularity, 0) DESC -- Then by popularity/views
        LIMIT 3
      `, [municipalityId]);

      res.json(restaurants);
    } catch (error) {
      console.error('Error fetching top restaurants:', error);
      res.status(500).json({ error: 'Failed to fetch top restaurants' });
    }
  });

  return router;
}
