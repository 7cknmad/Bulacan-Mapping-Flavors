import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

dotenv.config();

const PORT = process.env.PORT || 3001;
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'admin_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_me';

// DB
const pool = mysql.createPool({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  connectionLimit: 10, timezone: 'Z'
});

async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// CORS
const rawOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(/[,\s]+/).filter(Boolean);
const allowedSet = new Set(rawOrigins.map(o => o.toLowerCase()));

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const o = origin.toLowerCase();
    if (allowedSet.has('*') || allowedSet.has(o)) return cb(null, true);
    try {
      const u = new URL(o);
      const base = `${u.protocol}//${u.host}`;
      if (allowedSet.has(base)) return cb(null, true);
    } catch {}
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const app = express();
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Session (cookie)
app.use(session({
  name: SESSION_COOKIE_NAME,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',   // Required for cross-site (GitHub Pages -> Tunnel)
    secure: true        // Required on HTTPS (Cloudflare tunnel is HTTPS)
  }
}));

// Helpers
function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ===================== Public endpoints ===================== */

// Municipalities
app.get('/api/municipalities', async (req, res) => {
  const rows = await q(`SELECT id, name, slug, description, province, lat, lng, image_url FROM municipalities ORDER BY name`);
  res.json(rows);
});

// Dishes (public list with filters)
app.get('/api/dishes', async (req, res) => {
  const { municipalityId, category, q: search, signature, limit } = req.query;
  const where = [];
  const params = [];

  if (municipalityId) { where.push(`d.municipality_id = ?`); params.push(Number(municipalityId)); }
  if (category)       { where.push(`d.category = ?`); params.push(String(category)); }
  if (signature != null) { where.push(`d.is_signature = ?`); params.push(Number(signature)); }
  if (search)         { where.push(`(d.name LIKE ? OR d.slug LIKE ?)`); params.push(`%${search}%`, `%${search}%`); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const lim = limit ? `LIMIT ${Number(limit)}` : '';

  // sort: if signature mode, show rank order first
  const orderSql = signature != null && Number(signature) === 1
    ? `ORDER BY (d.panel_rank IS NULL), d.panel_rank ASC, d.rating DESC`
    : `ORDER BY d.rating DESC, d.popularity DESC, d.name ASC`;

  const rows = await q(`
    SELECT d.*, m.name AS municipality_name
    FROM dishes d
    JOIN municipalities m ON m.id = d.municipality_id
    ${whereSql}
    ${orderSql}
    ${lim}
  `, params);

  // Normalize JSON fields
  for (const r of rows) {
    try { if (r.flavor_profile && typeof r.flavor_profile === 'string') r.flavor_profile = JSON.parse(r.flavor_profile); } catch {}
    try { if (r.ingredients && typeof r.ingredients === 'string') r.ingredients = JSON.parse(r.ingredients); } catch {}
  }

  res.json(rows);
});

// Restaurants (public list with filters; supports dishId for “who serves this dish”)
app.get('/api/restaurants', async (req, res) => {
  const { municipalityId, dishId, q: search, featured, limit } = req.query;

  const where = [];
  const params = [];

  if (municipalityId) { where.push(`r.municipality_id = ?`); params.push(Number(municipalityId)); }
  if (featured != null) { where.push(`r.featured = ?`); params.push(Number(featured)); }
  if (search) { where.push(`(r.name LIKE ? OR r.slug LIKE ?)`); params.push(`%${search}%`, `%${search}%`); }

  let join = '';
  if (dishId) {
    join = `JOIN dish_restaurants dr ON dr.restaurant_id = r.id`;
    where.push(`dr.dish_id = ?`); params.push(Number(dishId));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const lim = limit ? `LIMIT ${Number(limit)}` : '';

  const orderSql = featured != null && Number(featured) === 1
    ? `ORDER BY (r.featured_rank IS NULL), r.featured_rank ASC, r.rating DESC`
    : `ORDER BY r.rating DESC, r.name ASC`;

  const rows = await q(`
    SELECT DISTINCT r.*
    FROM restaurants r
    ${join}
    ${whereSql}
    ${orderSql}
    ${lim}
  `, params);

  for (const r of rows) {
    try { if (r.cuisine_types && typeof r.cuisine_types === 'string') r.cuisine_types = JSON.parse(r.cuisine_types); } catch {}
  }

  res.json(rows);
});

/* ===================== Admin Auth ===================== */

app.get('/api/admin/auth/me', (req, res) => {
  if (!req.session?.admin) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ id: req.session.admin.id, email: req.session.admin.email });
});

app.post('/api/admin/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const rows = await q(`SELECT id, email, password_hash FROM admin_users WHERE email = ?`, [email]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.admin = { id: user.id, email: user.email };
  res.json({ ok: true });
});

app.post('/api/admin/auth/logout', (req, res) => {
  req.session?.destroy(() => res.json({ ok: true }));
});

/* ===================== Admin: CRUD ===================== */
app.get('/api/admin/dishes', requireAdmin, async (req, res) => {
  const { municipalityId, q: search } = req.query;
  const where = [];
  const params = [];
  if (municipalityId) { where.push(`d.municipality_id = ?`); params.push(Number(municipalityId)); }
  if (search) { where.push(`(d.name LIKE ? OR d.slug LIKE ?)`); params.push(`%${search}%`,`%${search}%`); }
  const sql = `
    SELECT d.*, m.name AS municipality_name
    FROM dishes d
    JOIN municipalities m ON m.id = d.municipality_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY d.updated_at DESC, d.id DESC
    LIMIT 500
  `;
  const rows = await q(sql, params);
  for (const r of rows) {
    try { if (r.flavor_profile && typeof r.flavor_profile === 'string') r.flavor_profile = JSON.parse(r.flavor_profile); } catch {}
    try { if (r.ingredients && typeof r.ingredients === 'string') r.ingredients = JSON.parse(r.ingredients); } catch {}
  }
  res.json(rows);
});

app.post('/api/admin/dishes', requireAdmin, async (req, res) => {
  const p = req.body || {};
  const flavor = Array.isArray(p.flavor_profile) ? JSON.stringify(p.flavor_profile) : null;
  const ingred = Array.isArray(p.ingredients) ? JSON.stringify(p.ingredients) : null;
  const r = await q(`
    INSERT INTO dishes
      (municipality_id, name, slug, description, image_url, category, flavor_profile, ingredients, popularity, rating, is_signature, panel_rank)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    p.municipality_id, p.name, p.slug, p.description ?? null, p.image_url ?? null, p.category ?? 'food',
    flavor, ingred, p.popularity ?? null, p.rating ?? null, p.is_signature ? 1 : 0, p.panel_rank ?? null
  ]);
  res.json({ id: r.insertId });
});

app.patch('/api/admin/dishes/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  // if curation rank set to 1..3, make sure no duplicate rank in same municipality
  if (p.panel_rank != null && p.panel_rank >= 1 && p.panel_rank <= 3 && (p.is_signature == null || p.is_signature === 1)) {
    const [{ municipality_id }] = await q(`SELECT municipality_id FROM dishes WHERE id = ?`, [id]);
    await q(`UPDATE dishes SET panel_rank = NULL WHERE municipality_id = ? AND panel_rank = ? AND id <> ?`, [municipality_id, p.panel_rank, id]);
    if (p.is_signature == null) p.is_signature = 1;
  }
  const fields = [];
  const params = [];
  for (const k of ['municipality_id','name','slug','description','image_url','category','popularity','rating','is_signature','panel_rank']) {
    if (p[k] !== undefined) { fields.push(`${k} = ?`); params.push(p[k]); }
  }
  if (p.flavor_profile !== undefined) { fields.push(`flavor_profile = ?`); params.push(Array.isArray(p.flavor_profile) ? JSON.stringify(p.flavor_profile) : null); }
  if (p.ingredients !== undefined)    { fields.push(`ingredients = ?`);    params.push(Array.isArray(p.ingredients) ? JSON.stringify(p.ingredients) : null); }
  if (!fields.length) return res.json({ ok: true });
  params.push(id);
  await q(`UPDATE dishes SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
});

app.delete('/api/admin/dishes/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await q(`DELETE FROM dishes WHERE id = ?`, [id]);
  res.json({ ok: true });
});

// Restaurants CRUD
app.get('/api/admin/restaurants', requireAdmin, async (req, res) => {
  const { municipalityId, q: search } = req.query;
  const where = [];
  const params = [];
  if (municipalityId) { where.push(`r.municipality_id = ?`); params.push(Number(municipalityId)); }
  if (search) { where.push(`(r.name LIKE ? OR r.slug LIKE ?)`); params.push(`%${search}%`,`%${search}%`); }
  const rows = await q(`
    SELECT r.*, m.name AS municipality_name
    FROM restaurants r
    JOIN municipalities m ON m.id = r.municipality_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY r.updated_at DESC, r.id DESC
    LIMIT 500
  `, params);
  for (const r of rows) {
    try { if (r.cuisine_types && typeof r.cuisine_types === 'string') r.cuisine_types = JSON.parse(r.cuisine_types); } catch {}
  }
  res.json(rows);
});

app.post('/api/admin/restaurants', requireAdmin, async (req, res) => {
  const p = req.body || {};
  const cuisines = Array.isArray(p.cuisine_types) ? JSON.stringify(p.cuisine_types) : null;
  const r = await q(`
    INSERT INTO restaurants
      (municipality_id, name, slug, kind, description, address, phone, website, facebook, instagram, opening_hours, price_range, cuisine_types, rating, lat, lng, image_url, featured, featured_rank)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    p.municipality_id, p.name, p.slug, p.kind ?? 'restaurant', p.description ?? null, p.address ?? '',
    p.phone ?? null, p.website ?? null, p.facebook ?? null, p.instagram ?? null,
    p.opening_hours ?? null, p.price_range ?? 'budget',
    cuisines, p.rating ?? null, p.lat, p.lng, p.image_url ?? null, p.featured ? 1 : 0, p.featured_rank ?? null
  ]);
  res.json({ id: r.insertId });
});

app.patch('/api/admin/restaurants/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (p.featured_rank != null && p.featured_rank >=1 && p.featured_rank <=3 && (p.featured == null || p.featured === 1)) {
    const [{ municipality_id }] = await q(`SELECT municipality_id FROM restaurants WHERE id = ?`, [id]);
    await q(`UPDATE restaurants SET featured_rank = NULL WHERE municipality_id = ? AND featured_rank = ? AND id <> ?`, [municipality_id, p.featured_rank, id]);
    if (p.featured == null) p.featured = 1;
  }
  const fields = [];
  const params = [];
  for (const k of ['municipality_id','name','slug','kind','description','address','phone','website','facebook','instagram','opening_hours','price_range','rating','lat','lng','image_url','featured','featured_rank']) {
    if (p[k] !== undefined) { fields.push(`${k} = ?`); params.push(p[k]); }
  }
  if (p.cuisine_types !== undefined) { fields.push(`cuisine_types = ?`); params.push(Array.isArray(p.cuisine_types) ? JSON.stringify(p.cuisine_types) : null); }
  if (!fields.length) return res.json({ ok: true });
  params.push(id);
  await q(`UPDATE restaurants SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
});

app.delete('/api/admin/restaurants/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await q(`DELETE FROM restaurants WHERE id = ?`, [id]);
  res.json({ ok: true });
});

/* ===================== Linking ===================== */
app.get('/api/admin/dishes/:id/restaurants', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const rows = await q(`
    SELECT r.*
    FROM dish_restaurants dr
    JOIN restaurants r ON r.id = dr.restaurant_id
    WHERE dr.dish_id = ?
    ORDER BY r.name ASC
  `, [id]);
  res.json(rows);
});
app.get('/api/admin/restaurants/:id/dishes', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const rows = await q(`
    SELECT d.*
    FROM dish_restaurants dr
    JOIN dishes d ON d.id = dr.dish_id
    WHERE dr.restaurant_id = ?
    ORDER BY d.name ASC
  `, [id]);
  res.json(rows);
});

app.post('/api/admin/dish-restaurants', requireAdmin, async (req, res) => {
  const { dish_id, restaurant_id, price_note = null, availability = 'regular' } = req.body || {};
  await q(`INSERT IGNORE INTO dish_restaurants (dish_id, restaurant_id, price_note, availability) VALUES (?,?,?,?)`,
    [dish_id, restaurant_id, price_note, availability]);
  res.json({ ok: true });
});

app.delete('/api/admin/dish-restaurants', requireAdmin, async (req, res) => {
  const { dish_id, restaurant_id } = req.query;
  await q(`DELETE FROM dish_restaurants WHERE dish_id = ? AND restaurant_id = ?`, [Number(dish_id), Number(restaurant_id)]);
  res.json({ ok: true });
});

/* ===================== Curation (Top-3) ===================== */
app.patch('/api/admin/dishes/:id/curation', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { is_signature, panel_rank } = req.body || {};
  const [{ municipality_id }] = await q(`SELECT municipality_id FROM dishes WHERE id = ?`, [id]);
  if (panel_rank != null && panel_rank >=1 && panel_rank <=3) {
    await q(`UPDATE dishes SET panel_rank = NULL WHERE municipality_id = ? AND panel_rank = ? AND id <> ?`, [municipality_id, panel_rank, id]);
  }
  await q(`UPDATE dishes SET is_signature = ?, panel_rank = ? WHERE id = ?`, [is_signature ? 1 : 0, panel_rank ?? null, id]);
  res.json({ ok: true });
});

app.patch('/api/admin/restaurants/:id/curation', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { featured, featured_rank } = req.body || {};
  const [{ municipality_id }] = await q(`SELECT municipality_id FROM restaurants WHERE id = ?`, [id]);
  if (featured_rank != null && featured_rank >=1 && featured_rank <=3) {
    await q(`UPDATE restaurants SET featured_rank = NULL WHERE municipality_id = ? AND featured_rank = ? AND id <> ?`, [municipality_id, featured_rank, id]);
  }
  await q(`UPDATE restaurants SET featured = ?, featured_rank = ? WHERE id = ?`, [featured ? 1 : 0, featured_rank ?? null, id]);
  res.json({ ok: true });
});

/* ===================== Analytics ===================== */
app.get('/api/admin/analytics/summary', requireAdmin, async (req, res) => {
  const [dishCounts, restaurantCounts, topDishes, topRestaurants] = await Promise.all([
    q(`SELECT m.id, m.name, COUNT(d.id) AS dish_count
       FROM municipalities m LEFT JOIN dishes d ON d.municipality_id = m.id
       GROUP BY m.id ORDER BY m.name`),
    q(`SELECT m.id, m.name, COUNT(r.id) AS restaurant_count
       FROM municipalities m LEFT JOIN restaurants r ON r.municipality_id = m.id
       GROUP BY m.id ORDER BY m.name`),
    q(`SELECT d.*, m.name AS municipality_name FROM dishes d
       JOIN municipalities m ON m.id = d.municipality_id
       WHERE d.is_signature = 1 AND d.panel_rank IS NOT NULL
       ORDER BY m.name, d.panel_rank`),
    q(`SELECT r.*, m.name AS municipality_name FROM restaurants r
       JOIN municipalities m ON m.id = r.municipality_id
       WHERE r.featured = 1 AND r.featured_rank IS NOT NULL
       ORDER BY m.name, r.featured_rank`)
  ]);
  res.json({ dishCounts, restaurantCounts, topDishes, topRestaurants });
});

app.listen(PORT, () => {
  console.log(`API running on :${PORT}`);
});
