import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
dotenv.config();
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me';
const app = express();

// Allow your frontend origins (Production + Local Dev)
const allowedOrigins = new Set([
  'http://localhost:5173',           // Vite dev
  'https://7cknmad.github.io',       // GitHub Pages (the path /Bulacan-Mapping-Flavors is not part of Origin)
]);
app.use(cors({
  origin: (origin, cb) => {
    const allow = [
      'http://localhost:5173',
      'https://7cknmad.github.io'
    ];
    if (!origin || allow.includes(origin)) return cb(null, true);
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/postman
    const ok =
      origin === 'https://7cknmad.github.io' ||
      /^http:\/\/localhost:\d+$/.test(origin); // any localhost:*
    return ok ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

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

// /api/dishes
app.get('/api/dishes', async (req, res) => {
  try {
    const { municipalityId, category, q, slug, signature, limit } = req.query;
    const where = [], params = [];

    if (municipalityId) { where.push('d.municipality_id = ?'); params.push(Number(municipalityId)); }

    if (category) {
      const parts = String(category).split(',').map(s=>s.trim()).filter(Boolean);
      if (parts.length === 1) { where.push('c.code = ?'); params.push(parts[0]); }
      else { where.push(`c.code IN (${parts.map(()=>'?').join(',')})`); params.push(...parts); }
    }

    if (signature === '1') where.push('d.is_signature = 1');
    if (slug) { where.push('d.slug = ?'); params.push(String(slug)); }

    if (q) {
      where.push('(d.slug = ? OR MATCH(d.name,d.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR d.name LIKE ?)');
      params.push(String(q), String(q), `%${String(q)}%`);
    }

    const lim = Math.min(Number(limit) || 200, 200);

    const sql = `
      SELECT d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
             d.flavor_profile, d.ingredients, d.is_signature, d.panel_rank,
             m.id AS municipality_id, m.name AS municipality_name,
             c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY COALESCE(d.panel_rank, 999), d.popularity DESC, d.name ASC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [...params, lim]);
    res.json(rows);
  } catch (e) {
    console.error('DISHES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes', detail: String(e?.message || e) });
  }
});


// /api/restaurants
app.get('/api/restaurants', async (req, res) => {
  try {
    const { municipalityId, dishId, kind, q, featured, limit } = req.query;
    const where = [], params = [];
    const joinDish = dishId ? 'INNER JOIN dish_restaurants dr ON dr.restaurant_id=r.id AND dr.dish_id=?' : '';
    if (dishId) params.push(Number(dishId));

    if (municipalityId) { where.push('r.municipality_id = ?'); params.push(Number(municipalityId)); }
    if (kind)          { where.push('r.kind = ?'); params.push(String(kind)); }
    if (featured === '1') where.push('r.is_featured = 1');
    if (q) { where.push('(MATCH(r.name,r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)'); params.push(String(q), `%${String(q)}%`); }

    const lim = Math.min(Number(limit) || 200, 200);

    const sql = `
      SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
             r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
             r.rating, r.lat, r.lng, r.is_featured, r.panel_rank
      FROM restaurants r
      ${joinDish}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY COALESCE(r.panel_rank, 999), r.rating DESC, r.name ASC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [...params, lim]);
    res.json(rows);
  } catch (e) {
    console.error('RESTAURANTS ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch restaurants', detail: String(e?.message || e) });
  }
});


// /api/municipalities/:id/dishes
app.get('/api/municipalities/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid municipality id' });

    const { category, signature, limit } = req.query;
    const where = ['d.municipality_id = ?']; const params = [id];

    if (category) {
      const parts = String(category).split(',').map(s=>s.trim()).filter(Boolean);
      if (parts.length === 1) { where.push('c.code = ?'); params.push(parts[0]); }
      else { where.push(`c.code IN (${parts.map(()=>'?').join(',')})`); params.push(...parts); }
    }
    if (signature === '1') where.push('d.is_signature = 1');

    const lim = Math.min(Number(limit) || 200, 200);

    const sql = `
      SELECT d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
             d.flavor_profile, d.ingredients, d.is_signature, d.panel_rank,
             m.id AS municipality_id, m.name AS municipality_name,
             c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(d.panel_rank, 999), d.popularity DESC, d.name ASC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [...params, lim]);
    res.json(rows);
  } catch (e) {
    console.error('MUNI DISHES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipality dishes', detail: String(e?.message || e) });
  }
});


// /api/municipalities/:id/restaurants
app.get('/api/municipalities/:id/restaurants', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid municipality id' });

    const { featured, limit } = req.query;
    const where = ['r.municipality_id = ?']; const params = [id];
    if (featured === '1') where.push('r.is_featured = 1');

    const lim = Math.min(Number(limit) || 200, 200);

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
              r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
              r.rating, r.lat, r.lng, r.is_featured, r.panel_rank
       FROM restaurants r
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(r.panel_rank, 999), r.rating DESC, r.name ASC
       LIMIT ?`,
      [...params, lim]
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
              dr.price_note, dr.availability
       FROM dish_restaurants dr
       INNER JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = ?
       ORDER BY r.rating DESC, r.name ASC`,
      [dishId]
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
       ORDER BY d.popularity DESC, d.name ASC`,
      [id]
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

app.get('/api/municipalities', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, description, province, lat, lng, image_url
       FROM municipalities
       ORDER BY name`
    );
    res.json(rows);
  } catch (e) {
    console.error('MUNICIPALITIES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipalities', detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
// Create restaurant
app.post('/api/admin/restaurants', async (req, res) => {
  try {
    const {
      municipality_id, name, slug, kind = 'restaurant',
      address, lat, lng, description = null,
      price_range = 'moderate', cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0
    } = req.body;

    if (!municipality_id || !name || !slug || !address || lat == null || lng == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [r] = await pool.query(
      `INSERT INTO restaurants
        (name, slug, kind, description, municipality_id, address,
         phone, email, website, facebook, instagram, opening_hours,
         price_range, cuisine_types, rating, lat, lng, location_pt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
         ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326))
       ON DUPLICATE KEY UPDATE
         description=VALUES(description), address=VALUES(address), kind=VALUES(kind),
         opening_hours=VALUES(opening_hours), price_range=VALUES(price_range),
         cuisine_types=VALUES(cuisine_types), rating=VALUES(rating),
         lat=VALUES(lat), lng=VALUES(lng), location_pt=VALUES(location_pt)`,
      [name, slug, kind, description, municipality_id, address,
       phone, email, website, facebook, instagram, opening_hours,
       price_range, JSON.stringify(cuisine_types), rating, lat, lng, lng, lat]
    );
    const id = r.insertId || (await pool.query(`SELECT id FROM restaurants WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save restaurant', detail: String(e.message || e) });
  }
});

// Create dish
app.post('/api/admin/dishes', async (req, res) => {
  try {
    const {
      municipality_id, category_code, name, slug,
      description = null, flavor_profile = [], ingredients = [],
      history = null, image_url = null, popularity = 0, rating = 0
    } = req.body;

    if (!municipality_id || !category_code || !name || !slug) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [category_code]);
    if (!cat) return res.status(400).json({ error: 'Unknown category_code' });

    const [r] = await pool.query(
      `INSERT INTO dishes
        (municipality_id, category_id, name, slug, description,
         flavor_profile, ingredients, history, image_url, popularity, rating)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         description=VALUES(description), flavor_profile=VALUES(flavor_profile),
         ingredients=VALUES(ingredients), history=VALUES(history),
         image_url=VALUES(image_url), popularity=VALUES(popularity), rating=VALUES(rating)`,
      [municipality_id, cat.id, name, slug, description,
       JSON.stringify(flavor_profile), JSON.stringify(ingredients), history,
       image_url, popularity, rating]
    );
    const id = r.insertId || (await pool.query(`SELECT id FROM dishes WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save dish', detail: String(e.message || e) });
  }
});

// Link dish <-> restaurant
app.post('/api/admin/dish-restaurants', async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note = null, availability = 'regular' } = req.body;
    if (!dish_id || !restaurant_id) {
      return res.status(400).json({ error: 'dish_id and restaurant_id are required' });
    }
    await pool.query(
      `INSERT INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE price_note=VALUES(price_note), availability=VALUES(availability)`,
      [dish_id, restaurant_id, price_note, availability]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to link dish & restaurant', detail: String(e.message || e) });
  }
});

function signAdmin(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) return res.status(401).json({ error: 'Auth required' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

app.post('/api/admin/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const [[user]] = await pool.query('SELECT * FROM admin_users WHERE email=? AND is_active=1', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signAdmin(user);
  // Secure cookie so GH Pages (https) can use it
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',   // cross-site (GitHub Pages -> tunnel)
    maxAge: 7 * 24 * 3600 * 1000
  });
  res.json({ ok: true, name: user.name, email: user.email });
});

app.post('/api/admin/auth/logout', (req, res) => {
  res.clearCookie('admin_token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ ok: true });
});

app.get('/api/admin/auth/me', requireAdmin, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

// Search by name (use in async selects)
app.get('/api/admin/search/dishes', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const [rows] = await pool.query(
    `SELECT d.id, d.name, d.slug, c.code AS category
     FROM dishes d
     JOIN dish_categories c ON c.id = d.category_id
     WHERE (? = '' OR d.name LIKE CONCAT('%', ?, '%'))
     ORDER BY d.name ASC
     LIMIT 20`, [q, q]
  );
  res.json(rows);
});

app.get('/api/admin/search/restaurants', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const [rows] = await pool.query(
    `SELECT id, name, slug
     FROM restaurants
     WHERE (? = '' OR name LIKE CONCAT('%', ?, '%'))
     ORDER BY name ASC
     LIMIT 20`, [q, q]
  );
  res.json(rows);
});

// Create / Update (you already have POST routes; add PATCH & DELETE)
app.patch('/api/admin/dishes/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const {
    name, slug, municipality_id, category_code,
    description, flavor_profile, ingredients, image_url,
    popularity, rating, is_signature, panel_rank
  } = req.body;

  const sets = []; const params = [];
  if (name != null) { sets.push('name=?'); params.push(name); }
  if (slug != null) { sets.push('slug=?'); params.push(slug); }
  if (municipality_id != null) { sets.push('municipality_id=?'); params.push(municipality_id); }
  if (category_code != null) {
    const [[cat]] = await pool.query('SELECT id FROM dish_categories WHERE code=?', [category_code]);
    if (!cat) return res.status(400).json({ error: 'Invalid category_code' });
    sets.push('category_id=?'); params.push(cat.id);
  }
  if (description !== undefined) { sets.push('description=?'); params.push(description); }
  if (flavor_profile !== undefined) { sets.push('flavor_profile=?'); params.push(JSON.stringify(flavor_profile ?? null)); }
  if (ingredients !== undefined) { sets.push('ingredients=?'); params.push(JSON.stringify(ingredients ?? null)); }
  if (image_url !== undefined) { sets.push('image_url=?'); params.push(image_url); }
  if (popularity != null) { sets.push('popularity=?'); params.push(popularity); }
  if (rating != null) { sets.push('rating=?'); params.push(rating); }
  if (is_signature != null) { sets.push('is_signature=?'); params.push(is_signature ? 1 : 0); }
  if (panel_rank !== undefined) { sets.push('panel_rank=?'); params.push(panel_rank === null ? null : Number(panel_rank)); }

  if (!sets.length) return res.json({ ok: true, updated: 0 });
  params.push(id);
  await pool.query(`UPDATE dishes SET ${sets.join(', ')} WHERE id=?`, params);
  res.json({ ok: true });
});

app.patch('/api/admin/restaurants/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const {
    name, slug, kind, description, municipality_id, address,
    phone, email, website, facebook, instagram, opening_hours,
    price_range, cuisine_types, rating, lat, lng,
    is_featured, panel_rank
  } = req.body;

  const sets = []; const params = [];
  if (name != null) { sets.push('name=?'); params.push(name); }
  if (slug != null) { sets.push('slug=?'); params.push(slug); }
  if (kind != null) { sets.push('kind=?'); params.push(kind); }
  if (description !== undefined) { sets.push('description=?'); params.push(description); }
  if (municipality_id != null) { sets.push('municipality_id=?'); params.push(municipality_id); }
  if (address != null) { sets.push('address=?'); params.push(address); }
  if (phone !== undefined) { sets.push('phone=?'); params.push(phone); }
  if (email !== undefined) { sets.push('email=?'); params.push(email); }
  if (website !== undefined) { sets.push('website=?'); params.push(website); }
  if (facebook !== undefined) { sets.push('facebook=?'); params.push(facebook); }
  if (instagram !== undefined) { sets.push('instagram=?'); params.push(instagram); }
  if (opening_hours !== undefined) { sets.push('opening_hours=?'); params.push(opening_hours); }
  if (price_range != null) { sets.push('price_range=?'); params.push(price_range); }
  if (cuisine_types !== undefined) { sets.push('cuisine_types=?'); params.push(JSON.stringify(cuisine_types ?? null)); }
  if (rating != null) { sets.push('rating=?'); params.push(rating); }
  if (lat != null && lng != null) {
    sets.push('lat=?','lng=?','location_pt=ST_GeomFromText(CONCAT("POINT(", ?, " ", ?, ")"), 4326)');
    params.push(lat, lng, lng, lat);
  }
  if (is_featured != null) { sets.push('is_featured=?'); params.push(is_featured ? 1 : 0); }
  if (panel_rank !== undefined) { sets.push('panel_rank=?'); params.push(panel_rank === null ? null : Number(panel_rank)); }

  if (!sets.length) return res.json({ ok: true, updated: 0 });
  params.push(id);
  await pool.query(`UPDATE restaurants SET ${sets.join(', ')} WHERE id=?`, params);
  res.json({ ok: true });
});

// Link dish <-> restaurant (you already have)
app.post('/api/admin/dish-restaurants', requireAdmin, async (req, res) => {
  // dish_id, restaurant_id, price_note, availability
  // (same as your existing route but add requireAdmin)
  // ... keep as-is
  res.json({ ok: true });
});

// High-level counts
app.get('/api/admin/stats/overview', requireAdmin, async (_req, res) => {
  const [[row]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM municipalities) AS municipalities,
      (SELECT COUNT(*) FROM dishes) AS dishes,
      (SELECT COUNT(*) FROM dishes d JOIN dish_categories c ON c.id=d.category_id WHERE c.code='delicacy') AS delicacies,
      (SELECT COUNT(*) FROM restaurants) AS restaurants,
      (SELECT COUNT(*) FROM dish_restaurants) AS links
  `);
  res.json(row);
});

// Top dishes by link count (optionally by municipality/category)
app.get('/api/admin/stats/top-dishes', requireAdmin, async (req, res) => {
  const { municipalityId, category, limit = 10 } = req.query;
  const where = []; const params = [];
  if (municipalityId) { where.push('d.municipality_id=?'); params.push(Number(municipalityId)); }
  if (category) { where.push('c.code=?'); params.push(String(category)); }

  const [rows] = await pool.query(
    `SELECT d.id, d.name, d.slug, c.code AS category,
            COALESCE(d.panel_rank, 999) AS rank_hint,
            COUNT(dr.restaurant_id) AS places
     FROM dishes d
     JOIN dish_categories c ON c.id=d.category_id
     LEFT JOIN dish_restaurants dr ON dr.dish_id=d.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY d.id
     ORDER BY rank_hint, places DESC, d.popularity DESC, d.name ASC
     LIMIT ?`, [...params, Math.min(Number(limit)||10, 50)]
  );
  res.json(rows);
});

// Top restaurants by dish count
app.get('/api/admin/stats/top-restaurants', requireAdmin, async (req, res) => {
  const { municipalityId, limit = 10 } = req.query;
  const where = []; const params = [];
  if (municipalityId) { where.push('r.municipality_id=?'); params.push(Number(municipalityId)); }

  const [rows] = await pool.query(
    `SELECT r.id, r.name, r.slug,
            COALESCE(r.panel_rank, 999) AS rank_hint,
            COUNT(dr.dish_id) AS dishes
     FROM restaurants r
     LEFT JOIN dish_restaurants dr ON dr.restaurant_id=r.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY r.id
     ORDER BY rank_hint, dishes DESC, r.rating DESC, r.name ASC
     LIMIT ?`, [...params, Math.min(Number(limit)||10, 50)]
  );
  res.json(rows);
});
