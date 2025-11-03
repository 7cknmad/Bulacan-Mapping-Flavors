import express from 'express';
import { authRequired } from '../middleware/auth.js';
import pool from '../db.js';

const router = express.Router();

// Get all dishes (with filters)
router.get('/admin/dishes', authRequired, async (req, res) => {
  try {
    const { q, municipality_id, category } = req.query;
    let query = `
      SELECT d.*, m.name as municipality_name, m.osm_id 
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      query += ` AND (d.name ILIKE ? OR d.description ILIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    if (municipality_id) {
      query += ` AND (d.municipality_id = ? OR m.osm_id = ?)`;
      params.push(municipality_id, municipality_id);
    }

    if (category) {
      query += ` AND d.category = ?`;
      params.push(category);
    }

    query += ` ORDER BY d.name ASC`;
    
    const [dishes] = await pool.query(query, params);
    res.json(dishes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create dish
router.post('/admin/dishes', authRequired, async (req, res) => {
  try {
    const { name, description, category, municipality_id, flavor_profile, ingredients, is_signature } = req.body;
    
    if (!name || !municipality_id) {
      return res.status(400).json({ error: 'Name and municipality_id are required' });
    }

    const [result] = await pool.query(`
      INSERT INTO dishes (name, description, category, municipality_id, flavor_profile, ingredients, is_signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, description, category, municipality_id, flavor_profile, ingredients, is_signature]);

    const [[dish]] = await pool.query(`
      SELECT d.*, m.name as municipality_name 
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      WHERE d.id = ?
    `, [result.insertId]);

    res.json(dish);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dish
router.put('/admin/dishes/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, municipality_id, flavor_profile, ingredients, is_signature } = req.body;

    if (!name || !municipality_id) {
      return res.status(400).json({ error: 'Name and municipality_id are required' });
    }

    const [result] = await pool.query(`
      UPDATE dishes 
      SET name = ?, description = ?, category = ?, municipality_id = ?, 
          flavor_profile = ?, ingredients = ?, is_signature = ?
      WHERE id = ?
    `, [name, description, category, municipality_id, flavor_profile, ingredients, is_signature, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    const [[dish]] = await pool.query(`
      SELECT d.*, m.name as municipality_name 
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      WHERE d.id = ?
    `, [id]);

    res.json(dish);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete dish
router.delete('/admin/dishes/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM dishes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dishes for a restaurant
router.get('/admin/restaurants/:restaurantId/dishes', authRequired, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const [dishes] = await pool.query(`
      SELECT d.*, rd.featured_rank, rd.is_featured,
             rd.restaurant_specific_description, rd.restaurant_specific_price,
             rd.availability
      FROM dishes d
      INNER JOIN restaurant_dishes rd ON d.id = rd.dish_id
      WHERE rd.restaurant_id = ?
      ORDER BY d.name ASC
    `, [restaurantId]);

    res.json(dishes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add dish to restaurant with additional details
router.post('/admin/restaurants/:restaurantId/dishes', authRequired, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { dish_id, is_featured, featured_rank, restaurant_specific_description,
            restaurant_specific_price, availability } = req.body;

    const [result] = await pool.query(`
      INSERT INTO restaurant_dishes 
        (restaurant_id, dish_id, is_featured, featured_rank, 
         restaurant_specific_description, restaurant_specific_price, availability)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [restaurantId, dish_id, is_featured, featured_rank,
        restaurant_specific_description, restaurant_specific_price, availability]);

    const [[dish]] = await pool.query(`
      SELECT d.*, rd.featured_rank, rd.is_featured,
             rd.restaurant_specific_description, rd.restaurant_specific_price,
             rd.availability
      FROM dishes d
      INNER JOIN restaurant_dishes rd ON d.id = rd.dish_id
      WHERE rd.restaurant_id = ? AND rd.dish_id = ?
    `, [restaurantId, dish_id]);

    res.json(dish);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dish curation settings
router.patch('/admin/curation/dishes/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_signature, panel_rank } = req.body;

    let query = 'UPDATE dishes SET ';
    const params = [];

    if (is_signature !== undefined) {
      query += 'is_signature = ?, ';
      params.push(is_signature);
    }

    if (panel_rank !== undefined) {
      // First, remove this panel_rank from other dishes in the same municipality
      if (panel_rank) {
        await pool.query(`
          UPDATE dishes d1
          SET panel_rank = NULL
          WHERE panel_rank = ?
          AND municipality_id = (
            SELECT municipality_id 
            FROM dishes d2 
            WHERE d2.id = ?
          )
          AND d1.id != ?
        `, [panel_rank, id, id]);
      }
      query += 'panel_rank = ?, ';
      params.push(panel_rank);
    }

    // Remove trailing comma and space
    query = query.slice(0, -2);
    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    const [[dish]] = await pool.query(`
      SELECT d.*, m.name as municipality_name 
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      WHERE d.id = ?
    `, [id]);

    res.json(dish);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics endpoints
router.get('/admin/analytics/summary', authRequired, async (req, res) => {
  try {
    const [[counts]] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM dishes) as dishes,
        (SELECT COUNT(*) FROM restaurants) as restaurants,
        (SELECT COUNT(*) FROM municipalities) as municipalities
    `);

    const [municipalityCounts] = await pool.query(`
      SELECT 
        m.id as municipality_id,
        m.name as municipality_name,
        m.osm_id,
        COUNT(DISTINCT d.id) as dishes,
        COUNT(DISTINCT r.id) as restaurants
      FROM municipalities m
      LEFT JOIN dishes d ON m.id = d.municipality_id
      LEFT JOIN restaurants r ON m.id = r.municipality_id
      GROUP BY m.id, m.name, m.osm_id
      ORDER BY m.name
    `);

    res.json({
      counts,
      perMunicipality: municipalityCounts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics per municipality
router.get('/admin/analytics/per-municipality', authRequired, async (req, res) => {
  try {
    const [municipalityCounts] = await pool.query(`
      SELECT 
        m.id as municipality_id,
        m.name as municipality_name,
        m.osm_id,
        COUNT(DISTINCT d.id) as dishes,
        COUNT(DISTINCT r.id) as restaurants
      FROM municipalities m
      LEFT JOIN dishes d ON m.id = d.municipality_id
      LEFT JOIN restaurants r ON m.id = r.municipality_id
      GROUP BY m.id, m.name, m.osm_id
      ORDER BY m.name
    `);

    res.json(municipalityCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;