import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get all municipalities
router.get('/api/municipalities', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, description, province, lat, lng, image_url, osm_relation_id as osm_id
       FROM municipalities
       ORDER BY name`
    );
    res.json(rows);
  } catch (e) {
    console.error('Error fetching municipalities:', e);
    res.status(500).json({ error: 'Failed to fetch municipalities', detail: String(e?.message || e) });
  }
});

// Get municipality by ID (supports both internal ID and OSM ID)
router.get('/api/municipalities/:id', async (req, res) => {
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
        id,
        name,
        address,
        rating,
        image_url,
        featured
       FROM restaurants 
       WHERE municipality_id = ?
       ORDER BY rating DESC, name ASC
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
router.get('/api/municipalities/:id/dishes-summary', async (req, res) => {
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

    // Get top-rated dish (with minimum number of ratings)
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

// GET /api/municipalities/:id/top-restaurants
router.get('/api/municipalities/:id/top-restaurants', async (req, res) => {
  try {
    console.log('[top-restaurants] Processing request for municipality top restaurants');
    const { id } = req.params;
    
    // First verify municipality exists
    const [[municipality]] = await pool.query(
      'SELECT id, name FROM municipalities WHERE id = ? OR osm_relation_id = ? LIMIT 1',
      [id, id]
    );

    if (!municipality) {
      console.log(`[top-restaurants] Municipality with ID ${id} not found`);
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Get top restaurants
    const [restaurants] = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.slug,
        r.description,
        r.address,
        r.image_url,
        r.price_range,
        r.featured,
        r.featured_rank,
        COALESCE(r.avg_rating, 0) as avg_rating,
        COALESCE(r.total_ratings, 0) as total_ratings
      FROM restaurants r
      WHERE r.municipality_id = ?
      ORDER BY 
        COALESCE(r.featured_rank, 999),
        r.featured DESC,
        r.avg_rating DESC,
        r.total_ratings DESC,
        r.name ASC
      LIMIT 5
    `, [municipality.id]);

    console.log(`[top-restaurants] Found ${restaurants.length} top restaurants for municipality ${municipality.name}`);
    
    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching top restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch top restaurants', details: error.message });
  }
});

export default router;
