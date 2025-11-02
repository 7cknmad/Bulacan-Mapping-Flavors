import express from 'express';
import { authRequired } from '../middleware/auth.js';
import pool from '../db.js';

const router = express.Router();

// Get restaurants with pagination, search, and filters
router.get('/admin/restaurants', authRequired, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const municipality = req.query.municipality;
    const sortBy = req.query.sort || 'name';

    // Get restaurants query
    const [restaurants] = await pool.query(`
      SELECT r.*, COUNT(rv.id) as review_count, COALESCE(AVG(rv.rating), 0) as avg_rating
      FROM restaurants r
      LEFT JOIN restaurant_reviews rv ON r.id = rv.restaurant_id
      GROUP BY r.id
      ORDER BY 
        CASE WHEN ? = 'rating' THEN avg_rating END DESC,
        CASE WHEN ? = 'newest' THEN r.created_at END DESC,
        r.name ASC
      LIMIT ? OFFSET ?
    `, [sortBy, sortBy, limit, offset]);

    // Get total count
    const [[{ count }]] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM restaurants
    `);

    res.json({
      restaurants,
      pagination: {
        current: page,
        total: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add restaurant
router.post('/admin/restaurants', authRequired, async (req, res) => {
  try {
    const { name, description, address } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }

    const [result] = await pool.query(`
      INSERT INTO restaurants (name, description, address)
      VALUES (?, ?, ?)
    `, [name, description, address]);

    const [[restaurant]] = await pool.query(`
      SELECT * FROM restaurants WHERE id = ?
    `, [result.insertId]);

    res.json(restaurant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update restaurant
router.put('/admin/restaurants/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }

    const [result] = await pool.query(`
      UPDATE restaurants 
      SET name = ?, description = ?, address = ?
      WHERE id = ?
    `, [name, description, address, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const [[restaurant]] = await pool.query(`
      SELECT * FROM restaurants WHERE id = ?
    `, [id]);

    res.json(restaurant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete restaurant
router.delete('/admin/restaurants/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM restaurants WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
