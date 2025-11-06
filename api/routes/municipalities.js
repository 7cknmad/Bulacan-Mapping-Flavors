import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get municipality by ID (supports both internal ID and OSM ID)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'internal' } = req.query; // 'internal' or 'osm'

    // Determine which ID field to use
    const idField = type === 'osm' ? 'osm_id' : 'id';
    
    // Get municipality details
    const [[municipality]] = await pool.query(
      `SELECT 
        id,
        osm_id,
        name,
        slug,
        description,
        latitude,
        longitude,
        image_url,
        recommended_dish_id
       FROM municipalities 
       WHERE ${idField} = ?`,
      [id]
    );

    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Get additional data
    const [dishes] = await pool.query(
      `SELECT 
        d.id,
        d.name,
        d.description,
        d.image_url,
        d.signature,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as rating_count
       FROM dishes d
       LEFT JOIN ratings r ON d.id = r.dish_id
       WHERE d.municipality_id = ?
       GROUP BY d.id
       ORDER BY d.signature DESC, avg_rating DESC
       LIMIT 10`,
      [municipality.id]
    );

    const [restaurants] = await pool.query(
      `SELECT 
        r.id,
        r.name,
        r.address,
        r.image_url,
        r.featured,
        r.price_range,
        r.slug,
        r.lat,
        r.lng,
        COALESCE(AVG(rt.rating), 0) as avg_rating,
        COUNT(DISTINCT rt.id) as total_ratings
       FROM restaurants r
       LEFT JOIN ratings rt ON r.id = rt.restaurant_id
       WHERE r.municipality_id = ?
       GROUP BY r.id
       ORDER BY avg_rating DESC, r.name ASC
       LIMIT 10`,
      [municipality.id]
    );

    res.json({
      ...municipality,
      dishes,
      restaurants
    });
  } catch (err) {
    console.error('Error fetching municipality:', err);
    res.status(500).json({ error: 'Failed to fetch municipality details' });
  }
});

// GET /api/municipalities/:id/dishes-summary
router.get('/:id/dishes-summary', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'osm' } = req.query; // 'internal' or 'osm', default to OSM since that's what frontend sends

    // Determine which ID field to use for lookup
    const idField = type === 'osm' ? 'osm_id' : 'id';

    // Get municipality details including recommended dish
    const [[municipality]] = await pool.query(
      `SELECT id, recommended_dish_id 
       FROM municipalities 
       WHERE ${idField} = ?`,
      [id]
    );

    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Get recommended dish if set
    let recommendedDish = null;
    if (municipality.recommended_dish_id) {
      const [[dish]] = await pool.query(
        `SELECT 
          d.*,
          COALESCE(AVG(r.rating), 0) as avg_rating,
          COUNT(DISTINCT r.id) as rating_count 
         FROM dishes d
         LEFT JOIN ratings r ON d.id = r.dish_id
         WHERE d.id = ?
         GROUP BY d.id`,
        [municipality.recommended_dish_id]
      );
      recommendedDish = dish || null;
    }

    const [[topDish]] = await pool.query(
      `SELECT 
        d.*,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as rating_count
       FROM dishes d
       LEFT JOIN ratings r ON d.id = r.dish_id
       WHERE d.municipality_id = ?
       GROUP BY d.id
       HAVING rating_count >= 3
       ORDER BY avg_rating DESC, rating_count DESC
       LIMIT 1`,
      [municipality.id]
    );

    res.json({
      recommendedDish,
      topRatedDish: topDish || null
    });
  } catch (error) {
    console.error('Error fetching dishes summary:', error);
    res.status(500).json({ error: 'Failed to fetch dishes summary' });
  }
});

export default router;
