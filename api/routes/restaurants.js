import express from 'express';
import { adminAuthRequired } from '../middleware/adminAuth.js';
import pool from '../db.js';

const router = express.Router();

// Helper function to generate URL-friendly slugs
const slugify = (str) => {
  return String(str)
    .normalize('NFKD') // Split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase() // Convert to lowercase
    .trim() // Remove whitespace from both ends
    .replace(/[^a-z0-9 -]/g, '') // Remove any non-alphanumeric character except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single hyphen
    .substring(0, 180); // Limit to 180 characters
};

// Validation helper
const validateRestaurantInput = (data) => {
  const errors = {};

  // Required fields
  if (!data.name?.trim()) errors.name = 'Name is required (restaurant.js)';
  if (!data.kind) errors.kind = 'Restaurant type is required';
  if (!data.municipality_id) errors.municipality_id = 'Municipality is required';
  if (!data.address?.trim()) errors.address = 'Address is required';
  if (!data.lat || !data.lng) errors.location = 'Location coordinates are required';

  // Field validations
  if (data.name && data.name.length > 180) errors.name = 'Name must be 180 characters or less';
  if (data.phone && data.phone.length > 40) errors.phone = 'Phone must be 40 characters or less';
  if (data.email && data.email.length > 120) errors.email = 'Email must be 120 characters or less';
  if (data.website && data.website.length > 300) errors.website = 'Website URL must be 300 characters or less';
  if (data.facebook && data.facebook.length > 300) errors.facebook = 'Facebook URL must be 300 characters or less';
  if (data.instagram && data.instagram.length > 300) errors.instagram = 'Instagram URL must be 300 characters or less';
  if (data.opening_hours && data.opening_hours.length > 240) errors.opening_hours = 'Opening hours must be 240 characters or less';
  if (data.address && data.address.length > 300) errors.address = 'Address must be 300 characters or less';
  
  // Validate price_range enum
  if (data.price_range && !['budget', 'moderate', 'expensive'].includes(data.price_range)) {
    errors.price_range = 'Invalid price range';
  }

  // Validate restaurant kind enum
  if (data.kind && !['restaurant', 'stall', 'store', 'dealer', 'market', 'home-based'].includes(data.kind)) {
    errors.kind = 'Invalid restaurant type';
  }

  // Validate cuisine_types JSON
  if (data.cuisine_types) {
    try {
      if (typeof data.cuisine_types === 'string') {
        JSON.parse(data.cuisine_types);
      }
    } catch (e) {
      errors.cuisine_types = 'Cuisine types must be valid JSON';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Get restaurants with pagination, search, and filters
router.get('/admin/restaurants', adminAuthRequired, async (req, res) => {
  try {
    const search = req.query.search || '';
    const municipalityId = req.query.municipality_id;
    const dishId = req.query.dishId;
    const sort = req.query.sort || 'name';

    let query = `
      SELECT r.*, m.name as municipality_name
      FROM restaurants r
      LEFT JOIN municipalities m ON r.municipality_id = m.id
      ${dishId ? 'INNER JOIN restaurant_dishes rd ON r.id = rd.restaurant_id' : ''}
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (r.name LIKE ? OR r.description LIKE ? OR r.address LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (municipalityId) {
      query += ` AND r.municipality_id = ?`;
      params.push(municipalityId);
    }

    if (dishId) {
      query += ` AND rd.dish_id = ?`;
      params.push(dishId);
    }

    // Add sorting
    if (sort === 'rating') {
      query += ` ORDER BY r.avg_rating DESC`;
    } else if (sort === 'newest') {
      query += ` ORDER BY r.created_at DESC`;
    } else {
      query += ` ORDER BY r.name ASC`;
    }

    // Execute query without pagination
    const [restaurants] = await pool.query(query, params);

    // Parse any JSON fields
    const formattedRestaurants = restaurants.map(r => ({
      ...r,
      cuisine_types: r.cuisine_types ? JSON.parse(r.cuisine_types) : [],
      featured: !!r.featured
    }));

    // Return just the restaurants array for consistency with other admin routes
    res.json(formattedRestaurants);

  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single restaurant
router.get('/admin/restaurants/:id', adminAuthRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [[restaurant]] = await pool.query(`
      SELECT r.*,
             m.name as municipality_name 
      FROM restaurants r
      LEFT JOIN municipalities m ON r.municipality_id = m.id
      WHERE r.id = ?
    `, [id]);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Parse JSON fields
    if (restaurant.cuisine_types) {
      restaurant.cuisine_types = JSON.parse(restaurant.cuisine_types);
    }

    res.json(restaurant);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create restaurant
router.post('/admin/restaurants', adminAuthRequired, async (req, res) => {
  try {
    const { isValid, errors } = validateRestaurantInput(req.body);
    if (!isValid) {
      return res.status(400).json({ errors });
    }

    const {
      name, kind = 'restaurant', description, image_url, municipality_id,
      address, phone, email, website, facebook, instagram,
      opening_hours, price_range = 'moderate', cuisine_types, lat, lng,
      featured = 0, featured_rank, panel_rank
    } = req.body;

  // Create location point (MySQL expects POINT(lng lat))
  const location = `POINT(${lng} ${lat})`;
  const location_pt = location;

    // Add default fields
    const status = 'active';
    const metadata = {};

    // Generate slug from name
    const slug = slugify(name);

    // Debug log for payload and location
    console.log('📝 RESTAURANT INSERT PAYLOAD:', {
      name, kind, description, image_url, municipality_id,
      address, phone, email, website, facebook, instagram,
      opening_hours, price_range, cuisine_types, lat, lng,
      featured, featured_rank, panel_rank, location, location_pt
    });

    const [result] = await pool.query(`
      INSERT INTO restaurants (
        name, slug, kind, description, image_url, municipality_id,
        address, phone, email, website, facebook, instagram,
        opening_hours, price_range, cuisine_types, lat, lng,
        featured, featured_rank, panel_rank, location, location_pt,
        status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(?), ST_GeomFromText(?), ?, ?)
    `, [
      name, slug, kind, description || null, image_url || null, municipality_id,
      address, phone || null, email || null, website || null, 
      facebook || null, instagram || null, opening_hours || null,
      price_range, JSON.stringify(cuisine_types || []), lat, lng,
      featured, featured_rank || null, panel_rank || null,
      location, location_pt,
      status, JSON.stringify(metadata)
    ]);

    const [[restaurant]] = await pool.query(`
      SELECT r.*,
             m.name as municipality_name 
      FROM restaurants r
      LEFT JOIN municipalities m ON r.municipality_id = m.id
      WHERE r.id = ?
    `, [result.insertId]);

    // Parse JSON fields
    if (restaurant.cuisine_types) {
      restaurant.cuisine_types = JSON.parse(restaurant.cuisine_types);
    }

    res.status(201).json(restaurant);
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update restaurant
router.put('/admin/restaurants/:id', adminAuthRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { isValid, errors } = validateRestaurantInput(req.body);
    if (!isValid) {
      return res.status(400).json({ errors });
    }

    const {
      name, kind, description, image_url, municipality_id,
      address, phone, email, website, facebook, instagram,
      opening_hours, price_range, cuisine_types, lat, lng,
      featured, featured_rank, panel_rank
    } = req.body;

    // Create location point
    const location = `POINT(${lng} ${lat})`;

    const [result] = await pool.query(`
      UPDATE restaurants 
      SET name = ?,
          kind = ?,
          description = ?,
          image_url = ?,
          municipality_id = ?,
          address = ?,
          phone = ?,
          email = ?,
          website = ?,
          facebook = ?,
          instagram = ?,
          opening_hours = ?,
          price_range = ?,
          cuisine_types = ?,
          lat = ?,
          lng = ?,
          featured = ?,
          featured_rank = ?,
          panel_rank = ?,
          location = ST_GeomFromText(?),
          location_pt = ST_GeomFromText(?),
          status = ?,
          metadata = ?
      WHERE id = ?
    `, [
      name, kind, description || null, image_url || null, municipality_id,
      address, phone || null, email || null, website || null, 
      facebook || null, instagram || null, opening_hours || null,
      price_range, JSON.stringify(cuisine_types || []), lat, lng,
      featured || 0, featured_rank || null, panel_rank || null,
      location, location,
      'active', // Default status
      JSON.stringify({}), // Default empty metadata
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const [[restaurant]] = await pool.query(`
      SELECT r.*,
             m.name as municipality_name 
      FROM restaurants r
      LEFT JOIN municipalities m ON r.municipality_id = m.id
      WHERE r.id = ?
    `, [id]);

    // Parse JSON fields
    if (restaurant.cuisine_types) {
      restaurant.cuisine_types = JSON.parse(restaurant.cuisine_types);
    }

    res.json(restaurant);
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete restaurant
router.delete('/admin/restaurants/:id', adminAuthRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM restaurants WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({
      success: true,
      message: 'Restaurant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
