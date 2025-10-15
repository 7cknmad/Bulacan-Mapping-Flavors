// api/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

/* ---------- CORS ---------- */
const allowedOrigins = new Set([
  'http://localhost:5173',              // Vite dev
  'https://7cknmad.github.io',          // GitHub Pages (path is not part of origin)
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

/* ---------- DB ---------- */
const cfg = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'bulacan_flavors',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
};
let pool;
(async () => {
  try {
    pool = mysql.createPool(cfg);
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log('✅ Connected to DB:', db);
  } catch (e) {
    console.error('❌ Failed to init DB pool:', e);
  }
})();

/* ---------- Helpers ---------- */
const jsonArray = (v) => {
  if (v == null) return null;
  if (Array.isArray(v)) return JSON.stringify(v);
  try { return JSON.stringify(v); } catch { return '[]'; }
};
const safeNum = (v, def=0) => Number.isFinite(Number(v)) ? Number(v) : def;

/* ---------- Public endpoints (already used by your FE) ---------- */
app.get('/api/municipalities', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, description, province, lat, lng, image_url
       FROM municipalities ORDER BY name`
    );
    res.json(rows);
  } catch (e) {
    console.error('MUNICIPALITIES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipalities', detail: String(e?.message || e) });
  }
});

app.get('/api/dishes', async (req, res) => {
  try {
    const { municipalityId, category, q } = req.query;
    const where = [];
    const params = [];

    if (municipalityId) { where.push('d.municipality_id = ?'); params.push(Number(municipalityId)); }
    if (category) { where.push('c.code = ?'); params.push(String(category)); }
    if (q) {
      where.push('(MATCH(d.name,d.description) AGAINST(? IN NATURAL LANGUAGE MODE))');
      params.push(String(q));
    }

    const sql = `
      SELECT d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
             d.flavor_profile, d.ingredients, d.featured, d.featured_rank,
             m.id AS municipality_id, m.name AS municipality_name,
             c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY d.popularity DESC, d.name ASC
      LIMIT 500
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('DISHES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes', detail: String(e?.message || e) });
  }
});

app.get('/api/restaurants', async (req, res) => {
  try {
    const { municipalityId, dishId, kind, q } = req.query;

    const where = [];
    const params = [];
    const joinDish = dishId
      ? 'INNER JOIN dish_restaurants dr ON dr.restaurant_id = r.id AND dr.dish_id = ?'
      : '';
    if (dishId) params.push(Number(dishId));
    if (municipalityId) { where.push('r.municipality_id = ?'); params.push(Number(municipalityId)); }
    if (kind) { where.push('r.kind = ?'); params.push(String(kind)); }
    if (q) {
      where.push('(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }

    const sql = `
      SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
             r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
             r.rating, r.lat, r.lng, r.signature, r.signature_rank, r.image_url
      FROM restaurants r
      ${joinDish}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY r.rating DESC, r.name ASC
      LIMIT 500
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('RESTAURANTS ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch restaurants', detail: String(e?.message || e) });
  }
});

app.get('/api/municipalities/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid municipality id' });

    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
              d.flavor_profile, d.ingredients, d.featured, d.featured_rank,
              c.code AS category, d.municipality_id
       FROM dishes d
       JOIN dish_categories c ON c.id = d.category_id
       WHERE d.municipality_id = ?
       ORDER BY d.popularity DESC, d.name ASC
       LIMIT 500`, [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/municipalities/:id/dishes ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipality dishes', detail: String(e?.message || e) });
  }
});

app.get('/api/municipalities/:id/restaurants', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid municipality id' });

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
              r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
              r.rating, r.lat, r.lng, r.signature, r.signature_rank, r.image_url
       FROM restaurants r
       WHERE r.municipality_id = ?
       ORDER BY r.rating DESC, r.name ASC
       LIMIT 500`, [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('MUNI RESTAURANTS ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipality restaurants', detail: String(e?.message || e) });
  }
});

app.get('/api/restaurants/by-dish/:dishId', async (req, res) => {
  try {
    const dishId = Number(req.params.dishId);
    if (!Number.isFinite(dishId)) return res.status(400).json({ error: 'Invalid dish id' });

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
              r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
              r.rating, r.lat, r.lng,
              dr.price_note, dr.availability, r.image_url
       FROM dish_restaurants dr
       INNER JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = ?
       ORDER BY r.rating DESC, r.name ASC`, [dishId]
    );
    res.json(rows);
  } catch (e) {
    console.error('RESTAURANTS BY DISH ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch restaurants for dish', detail: String(e?.message || e) });
  }
});

app.get('/api/restaurants/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid restaurant id' });

    const [rows] = await pool.query(
      `SELECT d.id, d.slug, d.name, d.description, d.image_url, d.rating, d.popularity,
              JSON_EXTRACT(d.flavor_profile, '$') AS flavor_profile,
              JSON_EXTRACT(d.ingredients, '$')     AS ingredients,
              dc.code AS category, d.municipality_id
       FROM dish_restaurants dr
       INNER JOIN dishes d        ON d.id = dr.dish_id
       INNER JOIN dish_categories dc ON dc.id = d.category_id
       WHERE dr.restaurant_id = ?
       ORDER BY d.popularity DESC, d.name ASC`, [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('RESTO DISHES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes for restaurant', detail: String(e?.message || e) });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: row.ok === 1, db: cfg.database });
  } catch (e) {
    console.error('HEALTH ERROR:', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ---------- Admin Auth ---------- */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local';
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'bulacan';
const validTokens = new Set();

function auth(req, res, next) {
  const h = req.header('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'Unauthorized' });
  const t = m[1];
  if (!validTokens.has(t)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/admin/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    const tok = 'adm_' + Math.random().toString(36).slice(2);
    validTokens.add(tok);
    return res.json({ token: tok, user: { email } });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/admin/auth/me', auth, (req, res) => {
  // very simple: you’re authenticated if token is valid
  res.json({ user: { email: ADMIN_EMAIL }});
});

app.post('/api/admin/auth/logout', auth, (req, res) => {
  const h = req.header('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) validTokens.delete(m[1]);
  res.json({ ok: true });
});

/* ---------- Admin CRUD: dishes ---------- */
app.get('/api/admin/dishes', auth, async (req, res) => {
  try {
    const { municipalityId, q } = req.query;
    const where = [];
    const params = [];
    if (municipalityId) { where.push('d.municipality_id=?'); params.push(Number(municipalityId)); }
    if (q) { where.push('(d.name LIKE ? OR d.slug LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
              d.flavor_profile, d.ingredients, d.featured, d.featured_rank,
              d.municipality_id, c.code AS category
       FROM dishes d
       JOIN dish_categories c ON c.id = d.category_id
       ${where.length ? 'WHERE '+where.join(' AND ') : ''}
       ORDER BY d.id DESC LIMIT 1000`, params
    );
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to list dishes' });
  }
});

app.post('/api/admin/dishes', auth, async (req, res) => {
  try {
    const {
      municipality_id, category = 'food', name, slug,
      description = null, flavor_profile = [], ingredients = [],
      image_url = null, popularity = 0, rating = 0
    } = req.body || {};

    if (!municipality_id || !name || !slug) return res.status(400).json({ error: 'Missing required fields' });

    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [category]);
    if (!cat) return res.status(400).json({ error: 'Unknown category code' });

    const [r] = await pool.query(
      `INSERT INTO dishes
        (municipality_id, category_id, name, slug, description,
         flavor_profile, ingredients, image_url, popularity, rating)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [municipality_id, cat.id, name, slug, description, jsonArray(flavor_profile), jsonArray(ingredients), image_url, popularity, rating]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to create dish', detail: String(e?.message||e) });
  }
});

app.put('/api/admin/dishes/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      municipality_id, category = 'food', name, slug,
      description = null, flavor_profile = [], ingredients = [],
      image_url = null, popularity = 0, rating = 0, featured = 0, featured_rank = null
    } = req.body || {};

    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [category]);
    if (!cat) return res.status(400).json({ error: 'Unknown category code' });

    await pool.query(
      `UPDATE dishes SET
         municipality_id=?, category_id=?, name=?, slug=?, description=?,
         flavor_profile=?, ingredients=?, image_url=?, popularity=?, rating=?,
         featured=?, featured_rank=?
       WHERE id=?`,
      [municipality_id, cat.id, name, slug, description,
       jsonArray(flavor_profile), jsonArray(ingredients), image_url, popularity, rating,
       featured ? 1 : 0, featured_rank, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message||e) });
  }
});

app.delete('/api/admin/dishes/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM dishes WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to delete dish' });
  }
});

app.put('/api/admin/dishes/:id/featured', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { featured = 0, rank = null } = req.body || {};
    await pool.query(`UPDATE dishes SET featured=?, featured_rank=? WHERE id=?`,
      [featured ? 1 : 0, rank, id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to set featured' });
  }
});

/* ---------- Admin CRUD: restaurants ---------- */
app.get('/api/admin/restaurants', auth, async (req, res) => {
  try {
    const { municipalityId, q } = req.query;
    const where = [];
    const params = [];
    if (municipalityId) { where.push('r.municipality_id=?'); params.push(Number(municipalityId)); }
    if (q) { where.push('(r.name LIKE ? OR r.slug LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
              r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
              r.rating, r.lat, r.lng, r.signature, r.signature_rank, r.municipality_id, r.image_url
       FROM restaurants r
       ${where.length ? 'WHERE '+where.join(' AND ') : ''}
       ORDER BY r.id DESC LIMIT 1000`, params
    );
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to list restaurants' });
  }
});

app.post('/api/admin/restaurants', auth, async (req, res) => {
  try {
    const {
      municipality_id, name, slug, kind = 'restaurant',
      address, lat, lng, description = null,
      price_range = 'moderate', cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0, image_url = null
    } = req.body || {};

    if (!municipality_id || !name || !slug || !address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [r] = await pool.query(
      `INSERT INTO restaurants
        (name, slug, kind, description, municipality_id, address,
         phone, email, website, facebook, instagram, opening_hours,
         price_range, cuisine_types, rating, lat, lng, location_pt, image_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
         ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326), ?)`,
      [name, slug, kind, description, municipality_id, address,
       phone, email, website, facebook, instagram, opening_hours,
       price_range, jsonArray(cuisine_types), rating, lat, lng, lng, lat, image_url]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to create restaurant', detail: String(e?.message||e) });
  }
});

app.put('/api/admin/restaurants/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      municipality_id, name, slug, kind = 'restaurant',
      address, lat, lng, description = null,
      price_range = 'moderate', cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0, signature = 0, signature_rank = null, image_url = null
    } = req.body || {};

    await pool.query(
      `UPDATE restaurants SET
         name=?, slug=?, kind=?, description=?, municipality_id=?, address=?,
         phone=?, email=?, website=?, facebook=?, instagram=?, opening_hours=?,
         price_range=?, cuisine_types=?, rating=?, lat=?, lng=?, location_pt=ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326),
         signature=?, signature_rank=?, image_url=?
       WHERE id=?`,
      [name, slug, kind, description, municipality_id, address,
       phone, email, website, facebook, instagram, opening_hours,
       price_range, jsonArray(cuisine_types), rating, lat, lng, lng, lat,
       signature ? 1 : 0, signature_rank, image_url, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to update restaurant', detail: String(e?.message||e) });
  }
});

app.delete('/api/admin/restaurants/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM restaurants WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

app.put('/api/admin/restaurants/:id/signature', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { signature = 0, rank = null } = req.body || {};
    await pool.query(`UPDATE restaurants SET signature=?, signature_rank=? WHERE id=?`,
      [signature ? 1 : 0, rank, id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to set signature' });
  }
});

/* ---------- Linking (one↔many) ---------- */
app.post('/api/admin/dish-restaurants', auth, async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note = null, availability = 'regular' } = req.body || {};
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'dish_id and restaurant_id are required' });
    await pool.query(
      `INSERT INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE price_note=VALUES(price_note), availability=VALUES(availability)`,
      [dish_id, restaurant_id, price_note, availability]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to link dish & restaurant', detail: String(e?.message||e) });
  }
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
