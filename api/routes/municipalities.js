import express from 'express';
import pool from '../db.js';

const router = express.Router();

// GET /api/municipalities/:id/dishes-summary
router.get('/:id/dishes-summary', async (req, res) => {
  const municipalityId = req.params.id;
  try {
    // Get recommended dish
    const [[municipality]] = await pool.query(
      'SELECT recommended_dish_id FROM municipalities WHERE id = ?',
      [municipalityId]
    );
    let recommendedDish = null;
    if (municipality && municipality.recommended_dish_id) {
      const [[dish]] = await pool.query(
        'SELECT * FROM dishes WHERE id = ?',
        [municipality.recommended_dish_id]
      );
      recommendedDish = dish || null;
    }

    // Get top-rated dish for municipality
    const [[topDish]] = await pool.query(
      `SELECT d.*, COALESCE(AVG(r.rating), 0) as avg_rating
       FROM dishes d
       LEFT JOIN ratings r ON d.id = r.dish_id
       WHERE d.municipality_id = ?
       GROUP BY d.id
       ORDER BY avg_rating DESC
       LIMIT 1`,
      [municipalityId]
    );

    res.json({
      recommended_dish: recommendedDish,
      topRatedDish: topDish || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
