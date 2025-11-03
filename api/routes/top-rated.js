import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get top rated restaurants
router.get('/api/top-rated/restaurants', async (req, res) => {
  try {
    const municipalityId = req.query.municipality_id;
    const limit = Number(req.query.limit) || 5;

    let query = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.address,
        r.image_url,
        r.price_range,
        r.rating as avg_rating,
        r.municipality_id,
        m.name as municipality_name,
        r.lat,
        r.lng,
        r.slug
      FROM restaurants r
      LEFT JOIN municipalities m ON r.municipality_id = m.id
      WHERE r.rating IS NOT NULL AND r.rating > 0
    `;

    const params = [];

    if (municipalityId) {
      query += ` AND r.municipality_id = ?`;
      params.push(municipalityId);
    }

    query += `
      ORDER BY r.rating DESC, r.popularity DESC
      LIMIT ?
    `;
    params.push(limit);

    const [restaurants] = await pool.query(query, params);

    // Format response
    const formattedRestaurants = restaurants.map(r => ({
      ...r,
      rating: Number(r.avg_rating)
    }));

    res.json(formattedRestaurants);
  } catch (error) {
    console.error('Error fetching top rated restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch top rated restaurants' });
  }
});

// Get top rated dishes
router.get('/api/top-rated/dishes', async (req, res) => {
  try {
    const municipalityId = req.query.municipality_id;
    const limit = Number(req.query.limit) || 5;

    let query = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.image_url,
        d.rating,
        d.popularity,
        d.category_id,
        d.municipality_id,
        m.name as municipality_name,
        c.display_name as category,
        d.slug
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      LEFT JOIN dish_categories c ON d.category_id = c.id
      WHERE d.rating IS NOT NULL AND d.rating > 0
    `;

    const params = [];

    if (municipalityId) {
      query += ` AND d.municipality_id = ?`;
      params.push(municipalityId);
    }

    query += `
      ORDER BY d.rating DESC, d.popularity DESC
      LIMIT ?
    `;
    params.push(limit);

    const [dishes] = await pool.query(query, params);

    // Format response
    const formattedDishes = dishes.map(d => ({
      ...d,
      rating: Number(d.rating),
      popularity: d.popularity ? Number(d.popularity) : null
    }));

    res.json(formattedDishes);
  } catch (error) {
    console.error('Error fetching top rated dishes:', error);
    res.status(500).json({ error: 'Failed to fetch top rated dishes' });
  }
});

export default router;