// src/api/routes/dishes-summary.js
const express = require('express');
const router = express.Router();

function init(pool) {
  // Get dish summary for a municipality (recommended and top rated dishes)
  router.get('/api/municipalities/:id/dishes-summary', async (req, res) => {
    try {
      const municipalityId = Number(req.params.id);
      if (!Number.isFinite(municipalityId)) {
        return res.status(400).json({ error: 'Invalid municipality ID' });
      }

      // Get recommended dish - prioritize featured dishes first, then by rating and views
      const [recommendedDish] = await pool.query(`
        SELECT 
          d.id,
          d.name,
          d.description,
          d.image_url,
          d.category,
          d.signature,
          d.avg_rating,
          d.total_ratings,
          d.view_count,
          d.popularity,
          d.featured,
          d.featured_rank,
          d.slug
        FROM dishes d
        WHERE d.municipality_id = ? 
          AND d.avg_rating IS NOT NULL
          AND d.avg_rating > 0
          AND d.total_ratings > 0
        ORDER BY
          COALESCE(d.featured, 0) DESC, -- Featured first  
          COALESCE(d.featured_rank, 999), -- Then by featured rank
          COALESCE(d.signature, 0) DESC, -- Then signature dishes
          COALESCE(d.avg_rating, 0) DESC, -- Then by rating
          COALESCE(d.total_ratings, 0) DESC, -- Then by number of ratings
          COALESCE(d.popularity, 0) DESC -- Finally by popularity
        LIMIT 1
      `, [municipalityId]);

      // Get top 3 rated dishes
      const [topRatedDishes] = await pool.query(`
        SELECT 
          d.id,
          d.name,
          d.description,
          d.image_url,
          d.category,
          d.signature,
          d.avg_rating,
          d.total_ratings,
          d.view_count,
          d.popularity,
          d.featured,
          d.featured_rank,
          d.slug
        FROM dishes d  
        WHERE d.municipality_id = ?
          AND d.avg_rating IS NOT NULL
          AND d.avg_rating > 0
          AND d.total_ratings > 0
        ORDER BY
          COALESCE(d.avg_rating, 0) DESC, -- By rating
          COALESCE(d.total_ratings, 0) DESC, -- Then by number of ratings  
          COALESCE(d.popularity, 0) DESC -- Then by popularity
        LIMIT 3
      `, [municipalityId]);

      res.json({
        recommendedDish: recommendedDish[0] || null,
        topRatedDishes: topRatedDishes || []
      });

    } catch (error) {
      console.error('Error fetching dishes summary:', error);
      res.status(500).json({ error: 'Failed to fetch dishes summary' });
    }
  });

  return router;
}

module.exports = init;