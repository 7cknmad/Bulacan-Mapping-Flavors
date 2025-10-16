import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const {
  PORT = 3002,
  DB_HOST = '127.0.0.1',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'bulacan_flavors',
  ALLOWED_ORIGINS = 'http://localhost:5174,https://7cknmad.github.io',
} = process.env;

const allowed = new Set(
  ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
);

const app = express();
app.use(express.json());

// CORS (no cookies; front-end should use credentials:'omit')
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);               // curl / server-to-server
    if (allowed.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  },
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

// DB pool
const pool = mysql.createPool({
  host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  waitForConnections: true, connectionLimit: 10, namedPlaceholders: true,
});

app.get('/api/admin/health', (req, res) => {
  res.json({ ok: true, service: 'admin-api', time: new Date().toISOString() });
});

/* ---------- Minimal writes you can expand later ----------
   NOTE: These SQLs assume columns you already have.
   If some columns differ in your schema, tweak the SET lists accordingly.
*/

// Create Dish
app.post('/api/admin/dishes', async (req, res) => {
  try {
    const {
      municipality_id, name, slug, description = null, image_url = null,
      category = 'food', flavor_profile = null, ingredients = null,
      rating = null, popularity = null, is_signature = null, panel_rank = null,
    } = req.body;

    const sql = `
      INSERT INTO dishes
      (municipality_id, name, slug, description, image_url, category,
       flavor_profile, ingredients, rating, popularity, is_signature, panel_rank)
      VALUES (:municipality_id, :name, :slug, :description, :image_url, :category,
              :flavor_profile, :ingredients, :rating, :popularity, :is_signature, :panel_rank)
    `;
    await pool.execute(sql, {
      municipality_id, name, slug, description, image_url, category,
      flavor_profile: flavor_profile ? JSON.stringify(flavor_profile) : null,
      ingredients: ingredients ? JSON.stringify(ingredients) : null,
      rating, popularity, is_signature, panel_rank,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('createDish error', e);
    res.status(500).json({ error: 'Failed to create dish', detail: String(e?.message || e) });
  }
});

// Update Dish
app.patch('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const up = { ...req.body };
    if ('flavor_profile' in up && Array.isArray(up.flavor_profile)) {
      up.flavor_profile = JSON.stringify(up.flavor_profile);
    }
    if ('ingredients' in up && Array.isArray(up.ingredients)) {
      up.ingredients = JSON.stringify(up.ingredients);
    }

    const fields = Object.keys(up)
      .filter(k => up[k] !== undefined)
      .map(k => `${k} = :${k}`);
    if (fields.length === 0) return res.json({ ok: true });

    const sql = `UPDATE dishes SET ${fields.join(', ')} WHERE id = :id`;
    await pool.execute(sql, { id, ...up });
    res.json({ ok: true });
  } catch (e) {
    console.error('updateDish error', e);
    res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message || e) });
  }
});

// Delete Dish
app.delete('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`DELETE FROM dish_restaurants WHERE dish_id = :id`, { id });
    await pool.execute(`DELETE FROM dishes WHERE id = :id`, { id });
    res.json({ ok: true });
  } catch (e) {
    console.error('deleteDish error', e);
    res.status(500).json({ error: 'Failed to delete dish', detail: String(e?.message || e) });
  }
});

// Create Restaurant
app.post('/api/admin/restaurants', async (req, res) => {
  try {
    const {
      municipality_id = null, name, slug, kind = 'restaurant',
      description = null, address = '', phone = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      price_range = null, cuisine_types = null, rating = null,
      lat, lng, image_url = null
    } = req.body;

    const sql = `
      INSERT INTO restaurants
      (municipality_id, name, slug, kind, description, address, phone, website,
       facebook, instagram, opening_hours, price_range, cuisine_types, rating,
       lat, lng, image_url)
      VALUES
      (:municipality_id, :name, :slug, :kind, :description, :address, :phone, :website,
       :facebook, :instagram, :opening_hours, :price_range, :cuisine_types, :rating,
       :lat, :lng, :image_url)
    `;
    await pool.execute(sql, {
      municipality_id, name, slug, kind, description, address, phone, website,
      facebook, instagram, opening_hours, price_range,
      cuisine_types: cuisine_types ? JSON.stringify(cuisine_types) : null,
      rating, lat, lng, image_url
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('createRestaurant error', e);
    res.status(500).json({ error: 'Failed to create restaurant', detail: String(e?.message || e) });
  }
});

// Update Restaurant
app.patch('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const up = { ...req.body };
    if ('cuisine_types' in up && Array.isArray(up.cuisine_types)) {
      up.cuisine_types = JSON.stringify(up.cuisine_types);
    }
    const fields = Object.keys(up)
      .filter(k => up[k] !== undefined)
      .map(k => `${k} = :${k}`);
    if (fields.length === 0) return res.json({ ok: true });

    const sql = `UPDATE restaurants SET ${fields.join(', ')} WHERE id = :id`;
    await pool.execute(sql, { id, ...up });
    res.json({ ok: true });
  } catch (e) {
    console.error('updateRestaurant error', e);
    res.status(500).json({ error: 'Failed to update restaurant', detail: String(e?.message || e) });
  }
});

// Delete Restaurant
app.delete('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`DELETE FROM dish_restaurants WHERE restaurant_id = :id`, { id });
    await pool.execute(`DELETE FROM restaurants WHERE id = :id`, { id });
    res.json({ ok: true });
  } catch (e) {
    console.error('deleteRestaurant error', e);
    res.status(500).json({ error: 'Failed to delete restaurant', detail: String(e?.message || e) });
  }
});

// Link Dish <-> Restaurant
app.post('/api/admin/dish-restaurants', async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note = null, availability = 'regular' } = req.body;
    const sql = `
      INSERT INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
      VALUES (:dish_id, :restaurant_id, :price_note, :availability)
      ON DUPLICATE KEY UPDATE price_note = VALUES(price_note), availability = VALUES(availability)
    `;
    await pool.execute(sql, { dish_id, restaurant_id, price_note, availability });
    res.json({ ok: true });
  } catch (e) {
    console.error('link dish-restaurant error', e);
    res.status(500).json({ error: 'Failed to link', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/dish-restaurants', async (req, res) => {
  try {
    const { dish_id, restaurant_id } = req.query;
    const sql = `DELETE FROM dish_restaurants WHERE dish_id = :dish_id AND restaurant_id = :restaurant_id`;
    await pool.execute(sql, { dish_id, restaurant_id });
    res.json({ ok: true });
  } catch (e) {
    console.error('unlink dish-restaurant error', e);
    res.status(500).json({ error: 'Failed to unlink', detail: String(e?.message || e) });
  }
});

// Set dish curation (signature/panel rank)
app.patch('/api/admin/dishes/:id/curation', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_signature = null, panel_rank = null } = req.body;
    await pool.execute(
      `UPDATE dishes SET is_signature = :is_signature, panel_rank = :panel_rank WHERE id = :id`,
      { id, is_signature, panel_rank }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('setDishCuration error', e);
    res.status(500).json({ error: 'Failed to set dish curation', detail: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}`);
});
