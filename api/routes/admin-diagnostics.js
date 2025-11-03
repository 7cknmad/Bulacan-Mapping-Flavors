import { Router } from 'express';
const router = Router();

router.get('/dish-recommendation-check', async (req, res) => {
  try {
    const db = req.app.locals.pool;
    
    // Get dishes with panel_rank = 1 and their municipality info
    const [rankedDishes] = await db.query(`
      SELECT 
        d.id as dish_id, 
        d.name as dish_name,
        d.municipality_id,
        d.panel_rank,
        m.id as muni_id,
        m.name as municipality_name,
        m.recommended_dish_id
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      WHERE d.panel_rank = 1
      ORDER BY d.municipality_id
    `);

    // Get municipalities with recommended dishes
    const [recommendedDishes] = await db.query(`
      SELECT 
        m.id as municipality_id,
        m.name as municipality_name,
        m.recommended_dish_id,
        d.name as recommended_dish_name,
        d.panel_rank
      FROM municipalities m
      LEFT JOIN dishes d ON m.recommended_dish_id = d.id
      WHERE m.recommended_dish_id IS NOT NULL
    `);

    // Check for mismatches
    const [mismatches] = await db.query(`
      SELECT 
        d.id as dish_id,
        d.name as dish_name,
        d.municipality_id,
        d.panel_rank,
        m.id as muni_id,
        m.name as municipality_name,
        m.recommended_dish_id
      FROM dishes d
      JOIN municipalities m ON d.municipality_id = m.id
      WHERE (d.panel_rank = 1 AND m.recommended_dish_id != d.id)
         OR (m.recommended_dish_id = d.id AND d.panel_rank != 1)
    `);

    res.json({
      rankedDishes,
      recommendedDishes,
      mismatches,
      summary: {
        totalRankedDishes: rankedDishes.length,
        totalRecommendedDishes: recommendedDishes.length,
        totalMismatches: mismatches.length
      }
    });
  } catch (error) {
    console.error('Error checking dish recommendations:', error);
    res.status(500).json({ error: 'Failed to check recommendations' });
  }
});

export default router;