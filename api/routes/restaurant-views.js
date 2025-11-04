// src/api/routes/restaurant-views.js
import express from 'express';
const router = express.Router();

export default function initRestaurantViewsRoutes(pool) {
  // Get top viewed and rated restaurants by municipality
  router.get('/api/municipalities/:id/top-restaurants', async (req, res) => {
    try {
      console.log('🔄 Fetching top restaurants for municipality:', req.params.id);
      
      const municipalityId = Number(req.params.id);
      if (!Number.isFinite(municipalityId)) {
        console.log('❌ Invalid municipality ID:', req.params.id);
        return res.status(400).json({ error: 'Invalid municipality ID' });
      }

      // First verify the municipality exists using OSM relation ID
      const [[municipality]] = await pool.query(
        'SELECT id, name FROM municipalities WHERE osm_relation_id = ?',
        [municipalityId]
      );

      if (!municipality) {
        console.log('❌ Municipality not found:', municipalityId);
        return res.status(404).json({ error: 'Municipality not found' });
      }

      console.log('✅ Found municipality:', municipality.name);

      // Get top 3 rated restaurants
      const [restaurants] = await pool.query(`
        SELECT 
          r.id,
          r.name,
          r.description,
          r.address,
          r.image_url,
          r.featured,
          r.featured_rank,
          r.panel_rank,
          r.price_range,
          r.slug,
          r.lat,
          r.lng,
          0 as avg_rating,
          0 as total_ratings
        FROM restaurants r
        JOIN municipalities m ON r.municipality_id = m.id
        WHERE m.osm_relation_id = ?
        ORDER BY
          COALESCE(r.featured, 0) DESC, -- Featured first
          COALESCE(r.featured_rank, 999), -- Lower rank = higher priority
          COALESCE(r.panel_rank, 999), -- Then by panel rank
          COALESCE(r.avg_rating, 0) DESC, -- Sort by rating (higher first)
          COALESCE(r.total_ratings, 0) DESC -- More reviews as tiebreaker
        LIMIT 3
      `, [municipalityId]);

      console.log(`✅ Found ${restaurants.length} top restaurants for ${municipality.name}`);
      
      // Transform the response to ensure consistent types
      const transformedRestaurants = restaurants.map(r => ({
        ...r,
        avg_rating: r.avg_rating ? Number(r.avg_rating) : null,
        total_ratings: r.total_ratings ? Number(r.total_ratings) : 0,
        featured: Boolean(r.featured),
        featured_rank: r.featured_rank ? Number(r.featured_rank) : null
      }));

      res.json(transformedRestaurants);
    } catch (error) {
      console.error('❌ Error fetching top restaurants:', error);
      res.status(500).json({ 
        error: 'Failed to fetch top restaurants',
        details: error.message 
      });
    }
  });

  return router;
}
