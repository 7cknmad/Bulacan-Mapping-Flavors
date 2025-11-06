import express from 'express';
import { adminAuthRequired } from '../middleware/adminAuth.js';
import pool from '../db.js';

const router = express.Router();

// Get single dish by slug
router.get('/api/dish/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const [[dish]] = await pool.query(`
      SELECT 
        d.*,
        m.name as municipality_name,
        c.display_name as category,
        c.code as category_code
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      LEFT JOIN dish_categories c ON d.category_id = c.id
      WHERE d.slug = ?
    `, [slug]);

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    // Parse JSON fields
    try {
      dish.flavor_profile = dish.flavor_profile ? JSON.parse(dish.flavor_profile) : [];
      dish.ingredients = dish.ingredients ? JSON.parse(dish.ingredients) : [];
    } catch (e) {
      console.error('Error parsing JSON fields:', e);
    }

    res.json(dish);
  } catch (error) {
    console.error('Error fetching dish:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to generate URL-friendly slugs
const slugify = (str) => {
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 180);
};

// Helper function to validate dish input
const validateDishInput = (data) => {
  const errors = {};
  
  // Required fields
  if (!data.name?.trim()) errors.name = 'Name is required';
  if (!data.municipality_id) errors.municipality_id = 'Municipality is required';
  if (!data.category_id && !data.category) errors.category = 'Category is required';

  // Field validations
  if (data.name && data.name.length > 180) errors.name = 'Name must be 180 characters or less';
  if (data.description && data.description.length > 1000) errors.description = 'Description must be 1000 characters or less';
  
  // Validate arrays
  if (data.flavor_profile) {
    try {
      if (typeof data.flavor_profile === 'string') {
        JSON.parse(data.flavor_profile);
      }
    } catch (e) {
      errors.flavor_profile = 'Flavor profile must be valid JSON array';
    }
  }

  if (data.ingredients) {
    try {
      if (typeof data.ingredients === 'string') {
        JSON.parse(data.ingredients);
      }
    } catch (e) {
      errors.ingredients = 'Ingredients must be valid JSON array';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Get all dishes (with filters)
router.get('/admin/dishes', adminAuthRequired, async (req, res) => {
  try {
    console.log('🔄 Handling /admin/dishes request:', {
      query: req.query,
      user: req.user,
      headers: req.headers
    });

    const search = req.query.q || '';
    const municipalityId = req.query.municipality_id ? Number(req.query.municipality_id) : undefined;
    const categoryId = req.query.category_id ? Number(req.query.category_id) : undefined;
    const sort = req.query.sort || 'name';

    let query = `
      SELECT d.*, 
             m.name as municipality_name,
             c.display_name as category,
             c.code as category_code
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      LEFT JOIN dish_categories c ON d.category_id = c.id
      WHERE 1=1
    `;
    
    const params = [];

    if (search) {
      query += ` AND (d.name LIKE ? OR d.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (municipalityId) {
      query += ` AND d.municipality_id = ?`;
      params.push(municipalityId);
    }

    if (categoryId) {
      query += ` AND d.category_id = ?`;
      params.push(categoryId);
    }

    // Add sorting
    if (sort === 'rating') {
      query += ` ORDER BY d.rating DESC`;
    } else if (sort === 'newest') {
      query += ` ORDER BY d.created_at DESC`;
    } else {
      query += ` ORDER BY d.name ASC`;
    }

    // Execute query without pagination
    const [dishes] = await pool.query(query, params);

    // Parse any JSON fields and format boolean fields
    const formattedDishes = dishes.map(d => ({
      ...d,
      flavor_profile: d.flavor_profile ? JSON.parse(d.flavor_profile) : [],
      ingredients: d.ingredients ? JSON.parse(d.ingredients) : [],
      is_signature: !!d.is_signature,
      featured: !!d.featured
    }));

    // Return just the dishes array for consistency with other admin routes
    res.json(formattedDishes);
  } catch (error) {
    console.error('Error fetching dishes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create dish
router.post('/admin/dishes', adminAuthRequired, async (req, res) => {
  try {
    const {
      name,
      municipality_id,
      category_id,
      category,
      description,
      image_url,
      flavor_profile = [],
      ingredients = [],
      history = null,
      is_signature = false,
      featured = false,
      featured_rank = null,
      panel_rank = null
    } = req.body;

    // Validate input
    const { isValid, errors } = validateDishInput(req.body);
    if (!isValid) {
      return res.status(400).json({ errors });
    }

    // Generate slug
    const slug = slugify(name);

    // First verify that the municipality exists
    const [[municipality]] = await pool.query(
      'SELECT id FROM municipalities WHERE id = ?',
      [municipality_id]
    );

    if (!municipality) {
      return res.status(400).json({ error: 'Municipality not found' });
    }

    // If category provided but no category_id, try to resolve it
    let finalCategoryId = category_id;
    if (!finalCategoryId && category) {
      const [[cat]] = await pool.query(
        'SELECT id FROM dish_categories WHERE code = ? OR display_name = ? LIMIT 1',
        [category, category]
      );
      if (cat) {
        finalCategoryId = cat.id;
      } else {
        return res.status(400).json({ error: 'Invalid category' });
      }
    }

    // Start a transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert the dish
      // Always lookup category code from dish_categories using category_id
      let categoryCode = 'food';
      if (finalCategoryId) {
        const [[cat]] = await pool.query('SELECT code FROM dish_categories WHERE id = ? LIMIT 1', [finalCategoryId]);
        if (cat && cat.code) categoryCode = String(cat.code).toLowerCase();
      }

      // Insert the dish with both category_id and category string
      console.log('📝 DISH INSERT VALUES:', {
        name,
        slug,
        municipality_id,
        finalCategoryId,
        categoryCode,
        description,
        image_url,
        flavor_profile,
        ingredients,
        history,
        is_signature,
        featured,
        featured_rank,
        panel_rank
      });
      const [result] = await connection.query(`
        INSERT INTO dishes (
          municipality_id,
          category_id,
          name,
          slug,
          description,
          flavor_profile,
          ingredients,
          history,
          image_url,
          category,
          popularity,
          rating,
          is_signature,
          panel_rank,
          featured,
          featured_rank
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        municipality_id,
        finalCategoryId,
        name,
        slug,
        description || null,
        JSON.stringify(flavor_profile),
        JSON.stringify(ingredients),
        history,
        image_url || null,
        categoryCode,
        popularity || 0,
        rating || 0,
        is_signature ? 1 : 0,
        panel_rank,
        featured ? 1 : 0,
        featured_rank
      ]);

      const dishId = result.insertId;

      // Insert ingredients if provided
      if (ingredients?.length > 0) {
        const ingredientValues = ingredients.map(ingredient => [dishId, ingredient]);
        await connection.query('INSERT INTO dish_ingredients (dish_id, ingredient_name) VALUES ?', [ingredientValues]);
      }

      // Commit the transaction
      await connection.commit();

      // Fetch the complete dish data
      const [[dish]] = await pool.query(`
        SELECT d.*, 
               c.display_name as category, 
               c.code as category_code, 
               r.name as restaurant_name, 
               GROUP_CONCAT(di.ingredient_name) as ingredients
        FROM dishes d
        LEFT JOIN dish_categories c ON d.category_id = c.id
        LEFT JOIN restaurants r ON d.restaurant_id = r.id
        LEFT JOIN dish_ingredients di ON d.id = di.dish_id
        WHERE d.id = ?
        GROUP BY d.id
      `, [dishId]);

      // Format the ingredients array
      if (dish) {
        dish.ingredients = dish.ingredients ? dish.ingredients.split(',') : [];
      }

      res.status(201).json(dish);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating dish:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dish
router.put('/admin/dishes/:id', adminAuthRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      municipality_id,
      category_id,
      description,
      image_url,
      flavor_profile = [],
      ingredients = [],
      history = null,
      is_signature = false,
      featured = false,
      featured_rank = null,
      panel_rank = null,
      rating = null,
      popularity = null
    } = req.body;

    console.log('🔄 Updating dish:', { id, ...req.body });

    // Validate input
    const { isValid, errors } = validateDishInput(req.body);
    if (!isValid) {
      console.log('❌ Validation failed:', errors);
      return res.status(400).json({ errors });
    }

    // Generate slug
    const slug = slugify(name);
    
    // Lookup category code from dish_categories
    let categoryCode = 'food';
    if (category_id) {
      const [[cat]] = await pool.query('SELECT code FROM dish_categories WHERE id = ? LIMIT 1', [category_id]);
      if (cat && cat.code) categoryCode = cat.code;
    }

    // Update the dish
    const [result] = await pool.query(`
      UPDATE dishes 
      SET municipality_id = ?,
          category_id = ?,
          category = ?,
          name = ?,
          slug = ?,
          description = ?,
          image_url = ?,
          flavor_profile = ?,
          ingredients = ?,
          history = ?,
          is_signature = ?,
          featured = ?,
          featured_rank = ?,
          panel_rank = ?,
          rating = ?,
          popularity = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      municipality_id,
      category_id,
      categoryCode,
      name,
      slug,
      description || null,
      image_url || null,
      JSON.stringify(flavor_profile || []),
      JSON.stringify(ingredients || []),
      history || null,
      is_signature ? 1 : 0,
      featured ? 1 : 0,
      featured_rank || null,
      panel_rank || null,
      rating,
      popularity,
      id
    ]);

    console.log('🔄 Update result:', result);

    if (result.affectedRows === 0) {
      console.log('❌ Dish not found:', id);
      return res.status(404).json({ error: 'Dish not found' });
    }

    // Fetch the updated dish data including municipality and category info
    const [[dish]] = await pool.query(`
      SELECT d.*, 
             m.name as municipality_name,
             c.display_name as category,
             c.code as category_code
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      LEFT JOIN dish_categories c ON d.category_id = c.id
      WHERE d.id = ?
    `, [id]);

    // Parse JSON fields
    if (dish) {
      try {
        dish.flavor_profile = dish.flavor_profile ? JSON.parse(dish.flavor_profile) : [];
        dish.ingredients = dish.ingredients ? JSON.parse(dish.ingredients) : [];
      } catch (e) {
        console.error('Error parsing JSON fields:', e);
      }
    }

    console.log('✅ Updated dish:', dish);
    res.json(dish);
  } catch (error) {
    console.error('❌ Error updating dish:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
// PATCH /admin/dishes/:id -- curation only
router.patch('/admin/dishes/:id', adminAuthRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      panel_rank = null,
      is_signature = undefined,
      featured = undefined,
      featured_rank = undefined
    } = req.body;

    // Build update fields
    const fields = [];
    const params = [];
    if (panel_rank !== undefined) {
      fields.push('panel_rank = ?');
      params.push(panel_rank);
    }
    if (is_signature !== undefined) {
      fields.push('is_signature = ?');
      params.push(is_signature ? 1 : 0);
    }
    if (featured !== undefined) {
      fields.push('featured = ?');
      params.push(featured ? 1 : 0);
    }
    if (featured_rank !== undefined) {
      fields.push('featured_rank = ?');
      params.push(featured_rank);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No curation fields provided' });
    }
    params.push(id);

    const sql = `UPDATE dishes SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const [result] = await pool.query(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }
    // Return updated dish
    const [[dish]] = await pool.query('SELECT * FROM dishes WHERE id = ?', [id]);
    res.json(dish);
  } catch (error) {
    console.error('❌ Error PATCHing dish curation:', error);
    res.status(500).json({ error: 'Failed to update dish curation', details: error.message });
  }
});

router.get('/admin/restaurants/:restaurantId/dishes', adminAuthRequired, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const [dishes] = await pool.query(`
      SELECT d.*,
             COUNT(dr.id) as review_count,
             COALESCE(AVG(dr.rating), 0) as avg_rating,
             GROUP_CONCAT(di.ingredient_name) as ingredients
      FROM dishes d
      LEFT JOIN dish_reviews dr ON d.id = dr.dish_id
      LEFT JOIN dish_ingredients di ON d.id = di.dish_id
      WHERE d.restaurant_id = ?
      GROUP BY d.id
      ORDER BY d.name ASC
    `, [restaurantId]);

    // Format ingredients arrays
    dishes.forEach(dish => {
      dish.ingredients = dish.ingredients ? dish.ingredients.split(',') : [];
    });

    res.json(dishes);
  } catch (error) {
    console.error('Error fetching restaurant dishes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;