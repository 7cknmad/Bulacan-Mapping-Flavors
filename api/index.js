import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

function parseOrigins(input) {
  if (!input) return [];
  const s = input.trim();
  // Accept JSON array or simple CSV
  if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('"') && s.endsWith('"'))) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.map(x => String(x).trim()).filter(Boolean) : [];
    } catch {
      // fall through to CSV
    }
  }
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

const rawOrigins = parseOrigins(process.env.CORS_ORIGINS || '');
// Always allow localhost dev ports commonly used by Vite
const devDefaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set([...rawOrigins, ...devDefaults]);

// If nothing configured and not prod, allow any (handy for local)
const allowAnyInDev = allowedOrigins.size === 0 && process.env.NODE_ENV !== 'production';

app.use(cors({
  origin(origin, cb) {
    // No Origin (curl/postman) → allow
    if (!origin) return cb(null, true);

    // Allow any origin in dev if nothing configured
    if (allowAnyInDev) return cb(null, true);

    // Allow your GH Pages domain explicitly
    if (origin === 'https://7cknmad.github.io') return cb(null, true);

    // Allow any Cloudflare tunnel subdomain (origin changes each run)
    try {
      const u = new URL(origin);
      if (u.hostname.endsWith('.trycloudflare.com')) return cb(null, true);
    } catch { /* ignore */ }

    // Allow anything explicitly listed in CORS_ORIGINS
    if (allowedOrigins.has(origin)) return cb(null, true);

    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true, // sets Access-Control-Allow-Credentials: true
}));

app.use(express.json());
app.set('trust proxy', 1); // needed for secure cookies behind proxies

const isProd = process.env.NODE_ENV === 'production';
const secureCookie = isProd;           // true on https
const sameSiteMode = isProd ? 'none' : 'lax';

app.use(session({
  name: 'bmf.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: secureCookie,
    sameSite: sameSiteMode,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

/* ===================== DB ===================== */

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'bulacan',
  connectionLimit: 10,
  namedPlaceholders: true,
  timezone: 'Z',
});

async function q(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/* ===================== Helpers ===================== */

function parseIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parse0or1(v) {
  if (v === undefined) return null;
  if (v === '0' || v === 0) return 0;
  if (v === '1' || v === 1) return 1;
  return null;
}

const arr = (x) => Array.isArray(x) ? x
  : (x == null || x === '') ? null
  : (typeof x === 'string'
      ? (() => { try { const j = JSON.parse(x); return Array.isArray(j) ? j : null; } catch { return null; } })()
      : null);

function coerceDish(row) {
  return {
    id: row.id,
    municipality_id: row.municipality_id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    image_url: row.image_url ?? null,
    category: row.category,
    flavor_profile: arr(row.flavor_profile),
    ingredients: arr(row.ingredients),
    popularity: row.popularity ?? null,
    rating: row.rating ?? null,
    is_signature: row.is_signature ?? null,
    panel_rank: row.panel_rank ?? null,
  };
}

function coerceRestaurant(row) {
  return {
    id: row.id,
    municipality_id: row.municipality_id ?? null,
    name: row.name,
    slug: row.slug,
    kind: row.kind ?? null,
    description: row.description ?? null,
    address: row.address,
    phone: row.phone ?? null,
    website: row.website ?? null,
    facebook: row.facebook ?? null,
    instagram: row.instagram ?? null,
    opening_hours: row.opening_hours ?? null,
    price_range: row.price_range ?? null,
    cuisine_types: arr(row.cuisine_types),
    rating: row.rating ?? null,
    lat: row.lat,
    lng: row.lng,
    image_url: row.image_url ?? null,
    featured: row.featured ?? null,
    featured_rank: row.featured_rank ?? null,
  };
}

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

/* ===================== Public ===================== */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/api/municipalities', async (req, res) => {
  try {
    const rows = await q(
      `SELECT id, name, slug, description, province, lat, lng, image_url
       FROM municipalities ORDER BY name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch municipalities', detail: String(e?.message || e) });
  }
});

app.get('/api/dishes', async (req, res) => {
  try {
    const muniId = parseIntOrNull(req.query.municipalityId);
    const category = (req.query.category || '').toString().trim();
    const qStr = (req.query.q || '').toString().trim();
    const signature = parse0or1(req.query.signature);
    const limit = parseIntOrNull(req.query.limit) || 100;

    const where = [];
    const params = {};
    if (muniId) { where.push('d.municipality_id = :muniId'); params.muniId = muniId; }
    if (category) { where.push('d.category = :category'); params.category = category; }
    if (qStr) { where.push('(d.name LIKE :q OR d.slug LIKE :q)'); params.q = `%${qStr}%`; }
    if (signature !== null) { where.push('IFNULL(d.is_signature,0) = :sig'); params.sig = signature; }

    const rows = await q(
      `SELECT d.*
       FROM dishes d
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY
         CASE WHEN d.panel_rank IS NULL THEN 999 ELSE d.panel_rank END ASC,
         IFNULL(d.rating, 0) DESC,
         d.name ASC
       LIMIT :limit`, { ...params, limit }
    );
    res.json(rows.map(coerceDish));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch dishes', detail: String(e?.message || e) });
  }
});

app.get('/api/restaurants', async (req, res) => {
  try {
    const muniId = parseIntOrNull(req.query.municipalityId);
    const dishId = parseIntOrNull(req.query.dishId);
    const qStr = (req.query.q || '').toString().trim();
    const featured = parse0or1(req.query.featured);
    const limit = parseIntOrNull(req.query.limit) || 100;

    const where = [];
    const params = {};
    let join = '';

    if (dishId) {
      join = 'INNER JOIN dish_restaurant dr ON dr.restaurant_id = r.id AND dr.dish_id = :dishId';
      params.dishId = dishId;
    }
    if (muniId) { where.push('r.municipality_id = :muniId'); params.muniId = muniId; }
    if (qStr) { where.push('(r.name LIKE :q OR r.slug LIKE :q OR r.address LIKE :q)'); params.q = `%${qStr}%`; }
    if (featured !== null) { where.push('IFNULL(r.featured,0) = :feat'); params.feat = featured; }

    const rows = await q(
      `SELECT r.*
       FROM restaurants r
       ${join}
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY
         CASE WHEN r.featured_rank IS NULL THEN 999 ELSE r.featured_rank END ASC,
         IFNULL(r.rating, 0) DESC,
         r.name ASC
       LIMIT :limit`, { ...params, limit }
    );
    res.json(rows.map(coerceRestaurant));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch restaurants', detail: String(e?.message || e) });
  }
});

/* ===================== Admin Auth ===================== */

async function findAdminByUsername(username) {
  try {
    const rows = await q('SELECT id, username, password_hash FROM admins WHERE username = :u LIMIT 1', { u: username });
    return rows[0] || null;
  } catch {
    return null;
  }
}

function envAdminOK(u, p) {
  const EU = process.env.ADMIN_USER;
  const EP = process.env.ADMIN_PASS;
  if (!EU || !EP) return false;
  return u === EU && p === EP;
}

app.post('/api/admin/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing username/password' });

    let ok = false;
    const dbAdmin = await findAdminByUsername(username);
    if (dbAdmin) {
      // Plain compare for now (you can switch to bcrypt)
      ok = password === dbAdmin.password_hash;
    } else {
      ok = envAdminOK(username, password);
    }

    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.admin = { username };
    res.json({ ok: true, admin: { username } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed', detail: String(e?.message || e) });
  }
});

app.get('/api/admin/auth/me', (req, res) => {
  if (!req.session?.admin) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ ok: true, admin: req.session.admin });
});

app.post('/api/admin/auth/logout', (req, res) => {
  req.session?.destroy?.(() => {});
  res.json({ ok: true });
});

/* ===================== Admin CRUD ===================== */

app.post('/api/admin/dishes', requireAuth, async (req, res) => {
  try {
    const p = req.body || {};
    const result = await q(
      `INSERT INTO dishes
        (municipality_id, name, slug, description, image_url, category,
         flavor_profile, ingredients, popularity, rating, is_signature, panel_rank)
       VALUES
        (:municipality_id, :name, :slug, :description, :image_url, :category,
         :flavor_profile, :ingredients, :popularity, :rating, :is_signature, :panel_rank)`,
      {
        municipality_id: p.municipality_id,
        name: p.name,
        slug: p.slug,
        description: p.description ?? null,
        image_url: p.image_url ?? null,
        category: p.category,
        flavor_profile: p.flavor_profile ? JSON.stringify(p.flavor_profile) : null,
        ingredients: p.ingredients ? JSON.stringify(p.ingredients) : null,
        popularity: p.popularity ?? null,
        rating: p.rating ?? null,
        is_signature: p.is_signature ?? null,
        panel_rank: p.panel_rank ?? null,
      }
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create dish', detail: String(e?.message || e) });
  }
});

app.patch('/api/admin/dishes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const p = req.body || {};

    // Build dynamic update
    const fields = [];
    const params = { id };
    const assign = (col, key, transform = (v)=>v) => {
      if (p[key] !== undefined) {
        fields.push(`${col} = :${key}`);
        params[key] = transform(p[key]);
      }
    };

    assign('municipality_id','municipality_id');
    assign('name','name');
    assign('slug','slug');
    assign('description','description');
    assign('image_url','image_url');
    assign('category','category');
    assign('flavor_profile','flavor_profile', (v)=> v ? JSON.stringify(v) : null);
    assign('ingredients','ingredients', (v)=> v ? JSON.stringify(v) : null);
    assign('popularity','popularity');
    assign('rating','rating');
    assign('is_signature','is_signature');
    assign('panel_rank','panel_rank');

    if (!fields.length) return res.json({ ok: true }); // nothing to update

    await q(`UPDATE dishes SET ${fields.join(', ')} WHERE id = :id`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/dishes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await q('DELETE FROM dish_restaurant WHERE dish_id = :id', { id });
    await q('DELETE FROM dishes WHERE id = :id', { id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete dish', detail: String(e?.message || e) });
  }
});

app.post('/api/admin/restaurants', requireAuth, async (req, res) => {
  try {
    const p = req.body || {};
    const result = await q(
      `INSERT INTO restaurants
       (municipality_id, name, slug, kind, description, address, phone, website,
        facebook, instagram, opening_hours, price_range, cuisine_types, rating,
        lat, lng, image_url, featured, featured_rank)
       VALUES
       (:municipality_id, :name, :slug, :kind, :description, :address, :phone, :website,
        :facebook, :instagram, :opening_hours, :price_range, :cuisine_types, :rating,
        :lat, :lng, :image_url, :featured, :featured_rank)`,
      {
        municipality_id: p.municipality_id ?? null,
        name: p.name,
        slug: p.slug,
        kind: p.kind ?? null,
        description: p.description ?? null,
        address: p.address,
        phone: p.phone ?? null,
        website: p.website ?? null,
        facebook: p.facebook ?? null,
        instagram: p.instagram ?? null,
        opening_hours: p.opening_hours ?? null,
        price_range: p.price_range ?? null,
        cuisine_types: p.cuisine_types ? JSON.stringify(p.cuisine_types) : null,
        rating: p.rating ?? null,
        lat: p.lat,
        lng: p.lng,
        image_url: p.image_url ?? null,
        featured: p.featured ?? null,
        featured_rank: p.featured_rank ?? null,
      }
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create restaurant', detail: String(e?.message || e) });
  }
});

app.patch('/api/admin/restaurants/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const p = req.body || {};

    const fields = [];
    const params = { id };
    const assign = (col, key, transform = (v)=>v) => {
      if (p[key] !== undefined) {
        fields.push(`${col} = :${key}`);
        params[key] = transform(p[key]);
      }
    };

    assign('municipality_id','municipality_id');
    assign('name','name');
    assign('slug','slug');
    assign('kind','kind');
    assign('description','description');
    assign('address','address');
    assign('phone','phone');
    assign('website','website');
    assign('facebook','facebook');
    assign('instagram','instagram');
    assign('opening_hours','opening_hours');
    assign('price_range','price_range');
    assign('cuisine_types','cuisine_types', (v)=> v ? JSON.stringify(v) : null);
    assign('rating','rating');
    assign('lat','lat');
    assign('lng','lng');
    assign('image_url','image_url');
    assign('featured','featured');
    assign('featured_rank','featured_rank');

    if (!fields.length) return res.json({ ok: true });

    await q(`UPDATE restaurants SET ${fields.join(', ')} WHERE id = :id`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update restaurant', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/restaurants/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await q('DELETE FROM dish_restaurant WHERE restaurant_id = :id', { id });
    await q('DELETE FROM restaurants WHERE id = :id', { id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete restaurant', detail: String(e?.message || e) });
  }
});

/* ===================== Linking ===================== */

app.get('/api/admin/dishes/:id/restaurants', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(
      `SELECT r.*, dr.price_note, dr.availability
       FROM dish_restaurant dr
       INNER JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = :id
       ORDER BY r.name ASC`, { id }
    );
    res.json(rows.map(coerceRestaurant).map(r => ({
      ...r,
      link: { price_note: rows.find(x => x.id === r.id)?.price_note ?? null,
              availability: rows.find(x => x.id === r.id)?.availability ?? 'regular' }
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch linked restaurants', detail: String(e?.message || e) });
  }
});

app.get('/api/admin/restaurants/:id/dishes', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(
      `SELECT d.*, dr.price_note, dr.availability
       FROM dish_restaurant dr
       INNER JOIN dishes d ON d.id = dr.dish_id
       WHERE dr.restaurant_id = :id
       ORDER BY d.name ASC`, { id }
    );
    res.json(rows.map(coerceDish).map(d => ({
      ...d,
      link: { price_note: rows.find(x => x.id === d.id)?.price_note ?? null,
              availability: rows.find(x => x.id === d.id)?.availability ?? 'regular' }
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch linked dishes', detail: String(e?.message || e) });
  }
});

app.post('/api/admin/dish-restaurants', requireAuth, async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note = null, availability = 'regular' } = req.body || {};
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'Missing dish_id/restaurant_id' });
    await q(
      `INSERT INTO dish_restaurant (dish_id, restaurant_id, price_note, availability)
       VALUES (:dish_id, :restaurant_id, :price_note, :availability)
       ON DUPLICATE KEY UPDATE price_note = VALUES(price_note), availability = VALUES(availability)`,
      { dish_id, restaurant_id, price_note, availability }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to link dish & restaurant', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/dish-restaurants', requireAuth, async (req, res) => {
  try {
    const dish_id = parseIntOrNull(req.query.dish_id);
    const restaurant_id = parseIntOrNull(req.query.restaurant_id);
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'Missing dish_id/restaurant_id' });
    await q(`DELETE FROM dish_restaurant WHERE dish_id = :dish_id AND restaurant_id = :restaurant_id`, { dish_id, restaurant_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to unlink dish & restaurant', detail: String(e?.message || e) });
  }
});

/* ===================== Analytics ===================== */

app.get('/api/admin/analytics/summary', requireAuth, async (req, res) => {
  try {
    const [dishCounts, featuredRests, linkCounts] = await Promise.all([
      q(`SELECT m.id AS municipality_id, m.name AS municipality_name, d.category, COUNT(*) AS total
         FROM dishes d
         INNER JOIN municipalities m ON m.id = d.municipality_id
         GROUP BY m.id, d.category`),
      q(`SELECT m.id AS municipality_id, m.name AS municipality_name, COUNT(*) AS featured_total
         FROM restaurants r
         INNER JOIN municipalities m ON m.id = r.municipality_id
         WHERE IFNULL(r.featured,0) = 1
         GROUP BY m.id`),
      q(`SELECT d.id AS dish_id, d.name AS dish_name, COUNT(dr.restaurant_id) AS restaurants_linked
         FROM dishes d
         LEFT JOIN dish_restaurant dr ON dr.dish_id = d.id
         GROUP BY d.id
         ORDER BY restaurants_linked DESC
         LIMIT 10`)
    ]);
    res.json({ dishCounts, featuredRests, linkCounts });
  } catch (e) {
    res.status(500).json({ error: 'Failed analytics', detail: String(e?.message || e) });
  }
});

/* ===================== Start ===================== */

app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
});
