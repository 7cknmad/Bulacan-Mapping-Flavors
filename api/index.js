import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
const app = express();
/* ---------------- CORS (GH Pages + local + tunnel) ---------------- */
const allowed = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://7cknmad.github.io',
]);
if (process.env.ALLOWED_ORIGINS) {
  for (const o of process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) {
    allowed.add(o);
  }
}
function isAllowedOrigin(origin) {
  if (!origin) return true; // curl/postman
  if (allowed.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith('.trycloudflare.com')) return true;
  } catch {}
  return false;
}
const corsOptions = {
  origin: (origin, cb) => isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`CORS: ${origin}`)),
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  credentials: true, // allow cookies for session/refresh flows
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.set('trust proxy', 1);

/* ---------------- Header-based auth (no cookies) ---------------- */
const {
  ADMIN_JWT_SECRET = 'dev-secret-change-me',
  ADMIN_EMAIL = 'adminbmf',
  ADMIN_PASSWORD_HASH = '',
  ADMIN_PASSWORD =  'password',
  JWT_SECRET = 'bulacan_secret_key',
} = process.env;

// User Favorites Endpoints
app.get('/api/user/favorites', authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [rows] = await pool.query(
      `SELECT f.*, 
              f.metadata,
              CASE 
                WHEN f.item_type = 'dish' THEN d.name
                WHEN f.item_type = 'restaurant' THEN r.name
              END as name,
              CASE 
                WHEN f.item_type = 'dish' THEN d.image_url
                WHEN f.item_type = 'restaurant' THEN r.image_url
              END as image_url,
              CASE
                WHEN f.item_type = 'dish' THEN d.avg_rating
                WHEN f.item_type = 'restaurant' THEN r.avg_rating
              END as avg_rating,
              CASE
                WHEN f.item_type = 'dish' THEN d.total_ratings
                WHEN f.item_type = 'restaurant' THEN r.total_ratings
              END as total_ratings,
              m.name as municipality_name
       FROM user_favorites f
       LEFT JOIN dishes d ON f.item_type = 'dish' AND f.item_id = d.id
       LEFT JOIN restaurants r ON f.item_type = 'restaurant' AND f.item_id = r.id
       LEFT JOIN municipalities m ON 
         CASE 
           WHEN f.item_type = 'dish' THEN d.municipality_id
           WHEN f.item_type = 'restaurant' THEN r.municipality_id
         END = m.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

app.post('/api/user/favorites', authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { itemId, itemType, metadata } = req.body;

    if (!itemId || !itemType) {
      return res.status(400).json({ error: 'Missing itemId or itemType' });
    }

    if (!['dish', 'restaurant'].includes(itemType)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }

    await pool.query(
      'INSERT INTO user_favorites (user_id, item_id, item_type, metadata) VALUES (?, ?, ?, ?)',
      [userId, itemId, itemType, metadata ? JSON.stringify(metadata) : null]
    );

    res.status(201).json({ message: 'Added to favorites' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Already in favorites' });
    }
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add to favorites' });
  }
});

app.delete('/api/user/favorites/:itemType/:itemId', authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { itemType, itemId } = req.params;

    if (!['dish', 'restaurant'].includes(itemType)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }

    await pool.query(
      'DELETE FROM user_favorites WHERE user_id = ? AND item_id = ? AND item_type = ?',
      [userId, itemId, itemType]
    );

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove from favorites' });
  }
});

// Batch check multiple items' favorite status
app.post('/api/user/favorites/check', authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array required' });
    }

    // Build query for multiple items
    const placeholders = items.map(() => '(user_id = ? AND item_id = ? AND item_type = ?)').join(' OR ');
    const params = items.flatMap(item => [userId, item.itemId, item.itemType]);

    const [rows] = await pool.query(
      `SELECT item_id, item_type FROM user_favorites WHERE ${placeholders}`,
      params
    );

    // Create a map of favorites
    const favorites = rows.reduce((acc, { item_id, item_type }) => {
      acc[`${item_type}-${item_id}`] = true;
      return acc;
    }, {});

    // Return status for each requested item
    const status = items.reduce((acc, { itemId, itemType }) => {
      acc[`${itemType}-${itemId}`] = !!favorites[`${itemType}-${itemId}`];
      return acc;
    }, {});

    res.json(status);
  } catch (error) {
    console.error('Error checking favorites status:', error);
    res.status(500).json({ error: 'Failed to check favorites status' });
  }
});

function sign(payload) {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '7d' });
}
function signRefresh(payload) {
  // refresh tokens longer lived
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '30d' });
}
function readBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}
function authRequired(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, ADMIN_JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

/* ---------------- Database connection & schema info ---------------- */

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'bulacan_flavors',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
};

// Startup marker to help debug which version of this file is running.
console.log('🛠️ api/index.js loaded - build marker v1');

let pool;
const schema = { dishes: new Set(), restaurants: new Set() };
const hasD = c => schema.dishes.has(c);
const hasR = c => schema.restaurants.has(c);

async function loadSchemaInfo() {
  const [rowsD] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='dishes'`, [cfg.database]);
  schema.dishes = new Set(rowsD.map(r => r.COLUMN_NAME));

  const [rowsR] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='restaurants'`, [cfg.database]);
  schema.restaurants = new Set(rowsR.map(r => r.COLUMN_NAME));

  console.log('🧭 Schema:', { dishes: [...schema.dishes], restaurants: [...schema.restaurants] });
}

(async () => {
  pool = mysql.createPool(cfg);
  const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
  console.log('✅ Connected to DB:', db);
  
  // Create user_favorites table if it doesn't exist
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_id INT NOT NULL,
        item_type ENUM('dish', 'restaurant') NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_favorite (user_id, item_id, item_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ User favorites table ready');
  } catch (e) {
    console.error('❌ Error creating favorites table:', e);
  }

  await loadSchemaInfo();
})().catch(e => console.error('❌ DB init error:', e));

/* ---------------- Helpers ---------------- */
const toInt = v => (v == null ? null : Number(v));
const jsonOrNull = v => (v == null || v === '' ? null : JSON.stringify(v));
const parseMaybeJsonArray = (v) => {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  try { const x = JSON.parse(v); return Array.isArray(x) ? x : null; } catch { return null; }
};
const slugify = (s) => String(s || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '').slice(0, 100);

const validateDish = (req, res, next) => {
  const { name, municipality_id, category } = req.body;
  const errors = [];
  
  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  if (!municipality_id || !Number.isInteger(Number(municipality_id))) {
    errors.push('Valid municipality ID is required');
  }
  if (!category) {
    errors.push('Category is required');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  
  next();
};

/* ========================================================================== */
/*                              PUBLIC API (/api)                              */
/* ========================================================================== */

app.post('/auth/register', registerHandler);
app.post('/api/auth/register', registerHandler);
app.post('/auth/login', loginHandler);
app.post('/api/auth/login', loginHandler);



async function loginHandler(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });

  try {
    const normalized = String(email).trim();
    try { console.log('[login] incoming', { path: req.path, ip: req.ip || req.connection?.remoteAddress, email: normalized }); } catch (e) {}

    // Lookup user (case-insensitive email). Select both plain and hash columns if present.
    const [rows] = await pool.query(
      'SELECT id, email, password, password_hash, salt, display_name, role FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalized]
    );

    if (!rows || rows.length === 0) {
      try { console.log('[login] no user found for', normalized); } catch (e) {}
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const user = rows[0];

    // Decide authentication method: prefer plain `password` if present, otherwise try bcrypt `password_hash`.
    let authenticated = false;
    if (user.password && String(user.password).length > 0) {
      authenticated = user.password === String(password);
    } else if (user.password_hash && String(user.password_hash).length > 0) {
      try {
        authenticated = await bcrypt.compare(String(password), String(user.password_hash));
      } catch (e) {
        console.error('bcrypt compare error:', e && e.message ? e.message : e);
        authenticated = false;
      }
    }

    try { console.log('[login] user found', { id: user.id, email: user.email, display_name: user.display_name, hasPlain: !!user.password, hasHash: !!user.password_hash, authenticated }); } catch (e) {}

    if (!authenticated) return res.status(401).json({ error: 'invalid_credentials' });

    const token = sign({ uid: user.id, email: user.email, displayName: user.display_name });
    // issue a refresh token as httpOnly cookie for optional cookie-based session
    try {
      const refresh = signRefresh({ uid: user.id });
      res.cookie('refresh_token', refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    } catch (e) { console.error('Failed to set refresh cookie', e); }
    return res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.display_name, role: user.role || 'user' } });
  } catch (err) {
    console.error('Login error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'login_failed' });
  }
}



async function registerHandler(req, res) {
  // Simple registration: expects { email, password, displayName }
  const { email, password, displayName } = req.body || {};
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'missing_fields', message: 'email, password and displayName are required' });
  }

  if (!pool) return res.status(500).json({ error: 'server_not_ready' });

  try {
    const normalized = String(email).trim();

    // Check if a user with this email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1', [normalized]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'user_exists' });
    }

    // Insert new user (plain-text password as requested)
    const [result] = await pool.query(
      `INSERT INTO users (email, password, display_name, created_at, role) VALUES (?, ?, ?, NOW(), ?)`,
      [normalized, String(password), String(displayName), 'user']
    );

    const user = { id: result.insertId, email: normalized, name: displayName };
    const token = sign({ uid: user.id, email: user.email, displayName: user.name });
      try {
        const refresh = signRefresh({ uid: user.id });
        res.cookie('refresh_token', refresh, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/api',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      } catch (e) { console.error('Failed to set refresh cookie (register)', e); }
    return res.status(201).json({ ok: true, token, user });
  } catch (err) {
    console.error('Registration DB error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'registration_failed' });
  }
}

// Register routes after app is defined


app.get('/auth/me', (req, res) => {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = jwt.verify(token, ADMIN_JWT_SECRET);
    res.json({ user: { id: p.uid || 'admin', email: p.email, name: 'Administrator', role: 'admin' } });
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }

});

// Simple cookie parser helper
function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(/;\s*/).filter(Boolean).reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
}

// Refresh endpoint - exchanges an httpOnly refresh cookie for a new access token and user
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const refresh = cookies['refresh_token'];
    if (!refresh) return res.status(401).json({ error: 'no_refresh' });
    try {
      const payload = jwt.verify(refresh, ADMIN_JWT_SECRET);
      // payload should include uid
      const uid = payload.uid || payload.uid;
      if (!uid) return res.status(401).json({ error: 'invalid_refresh' });
      // load user
      const [[u]] = await pool.query('SELECT id, email, display_name, role FROM users WHERE id=? LIMIT 1', [Number(uid)]);
      if (!u) return res.status(404).json({ error: 'user_not_found' });
      const token = sign({ uid: u.id, email: u.email, displayName: u.display_name });
      return res.json({ ok: true, token, user: { id: u.id, email: u.email, name: u.display_name, role: u.role || 'user' } });
    } catch (e) {
      console.error('Refresh token verify failed', e && e.message ? e.message : e);
      return res.status(401).json({ error: 'invalid_refresh' });
    }
  } catch (e) {
    console.error('Refresh endpoint error', e);
    return res.status(500).json({ error: 'refresh_failed' });
  }
});

// Logout: clear refresh cookie
app.post('/api/auth/logout', (req, res) => {
  try {
    res.cookie('refresh_token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api', maxAge: 0 });
  } catch (e) {}
  res.json({ ok: true });
});

app.get('/api/health', async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: row.ok === 1, db: cfg.database });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Lightweight debug endpoint - returns a marker and file mtime so you can verify the running process
app.get('/api/_debug', async (_req, res) => {
  try {
    const fs = await import('fs');
    const stat = await fs.promises.stat(new URL(import.meta.url));
    return res.json({ ok: true, marker: 'api/index.js loaded - build marker v1', file_mtime: stat.mtime });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/api/dish-categories', async (req, res) => {
  try {
    console.log('🔄 Fetching dish categories...');
    
    const [rows] = await pool.query(`
      SELECT id, code, display_name
      FROM dish_categories 
      ORDER BY display_name ASC
    `);
    
    console.log(`✅ Found ${rows.length} dish categories`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error fetching dish categories:', error);
    console.error('Full error:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch dish categories',
      details: error.message
    });
  }
});

app.get('/api/municipalities', async (_req, res) => {
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

app.get('/api/dishes', async (req, res) => {
  const { municipalityId, q, limit = 500, category, sort = 'rating' } = req.query;
  const where = []; const p = [];
  if (municipalityId) { where.push('d.municipality_id=?'); p.push(Number(municipalityId)); }
  if (q) { where.push('d.name LIKE ?'); p.push(`%${String(q)}%`); }
  if (category) { where.push('c.code=?'); p.push(String(category)); }
  // prepare ORDER BY clause based on sort param
  const sortKey = String(sort || 'rating').toLowerCase();
  const defaultPanel = hasD('panel_rank') ? 'COALESCE(NULLIF(d.panel_rank, 0), 999),' : '';
  const orderClause = sortKey === 'popularity'
    ? `${defaultPanel} d.popularity DESC, d.name ASC`
    : sortKey === 'name'
      ? `${defaultPanel} d.name ASC`
      : `${defaultPanel} d.avg_rating DESC, d.total_ratings DESC, d.name ASC`;

  const sql = `
    SELECT d.id, d.municipality_id, d.name, d.slug, d.description, d.image_url,
           d.rating, d.popularity,
           d.avg_rating, d.total_ratings,
           ${hasD('is_signature') ? 
             'CASE WHEN d.is_signature = 1 THEN 1 ELSE 0 END AS is_signature,' 
             : 'NULL AS is_signature,'}
           ${hasD('panel_rank') ? 'd.panel_rank,' : 'NULL AS panel_rank,'}
           JSON_EXTRACT(d.flavor_profile,'$') AS flavor_profile,
           JSON_EXTRACT(d.ingredients,'$') AS ingredients,
           c.code AS category
    FROM dishes d
    JOIN dish_categories c ON c.id=d.category_id
    ${where.length?`WHERE ${where.join(' AND ')}`:''}
    ORDER BY ${orderClause}
    LIMIT ${Number(limit)||500}`;
  const [rows] = await pool.query(sql, p);
  res.json(rows);
});

app.get('/api/restaurants', async (req, res) => {
  try {
  const { municipalityId, dishId, q, featured, limit, kind, sort = 'rating', page = 1, perPage = 50 } = req.query;

    const where = [];
    const params = [];

    const joinDish = dishId
      ? 'INNER JOIN dish_restaurants dr ON dr.restaurant_id = r.id AND dr.dish_id = ?'
      : '';
    if (dishId) params.push(Number(dishId));

    if (municipalityId) {
      const id = Number(municipalityId);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'municipalityId must be a number' });
      where.push('r.municipality_id = ?'); params.push(id);
    }
    // Optional spatial filter: lat, lng, radiusKm
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;
    const radiusKm = req.query.radiusKm != null ? Number(req.query.radiusKm) : null;
    if ((lat != null && lng == null) || (lat == null && lng != null)) {
      return res.status(400).json({ error: 'Both lat and lng are required for proximity filtering' });
    }
    if (kind) { where.push('r.kind = ?'); params.push(String(kind)); }
    if (q) {
      where.push('(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }
    if (featured != null && hasR('featured')) {
      where.push('r.featured = ?');
    }

    const selectCols = [
      'r.id', 'r.name', 'r.slug', 'r.kind',
      'r.description', 'r.address', 'r.phone', 'r.website',
      'r.facebook', 'r.instagram', 'r.opening_hours',
      'r.price_range',
      "JSON_EXTRACT(r.cuisine_types, '$') AS cuisine_types",
      'r.rating', 'r.lat', 'r.lng',
      'r.avg_rating', 'r.total_ratings'
    ];
    if (hasR('image_url'))     selectCols.push('r.image_url');
    if (hasR('featured'))      selectCols.push('r.featured');
    if (hasR('featured_rank')) selectCols.push('r.featured_rank');

    // Determine ordering
    const sortKey = String(sort || 'rating').toLowerCase();
    const orderClause = sortKey === 'name' ? 'r.name ASC' : 'r.avg_rating DESC, r.total_ratings DESC, r.name ASC';

    // If spatial params provided, compute distance in SQL and filter by radius.
    // Prefer database spatial function (ST_Distance_Sphere) when a POINT-like column is present
    let spatialSelect = '';
    let spatialHaving = '';
    let spatialWhereAppend = ''; // appended to WHERE clause when using DB spatial function
    let spatialParamCount = 0;
    if (lat != null && lng != null && radiusKm != null && Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusKm)) {
      // If restaurants table exposes a POINT column named `location` use ST_Distance_Sphere for better perf
      if (hasR('location')) {
        // ST_Distance_Sphere returns meters; convert to km for compatibility with existing responses
        spatialSelect = ', ST_Distance_Sphere(r.location, POINT(?, ?)) / 1000.0 AS distance_km';
        // filter using WHERE (will be appended to the WHERE clause)
        spatialWhereAppend = ` AND ST_Distance_Sphere(r.location, POINT(?, ?)) <= ?`;
        // params to append: lng, lat for select; lng, lat, radiusMeters for where
        // We'll push them in the same order below; count of spatial params = 5 (select 2 + where 3)
        spatialParamCount = 5;
        // push placeholders: select uses POINT(?,?) - we pass lng, lat for those
        params.push(lng, lat);
        // push WHERE placeholders: POINT(?,?) and radius (meters)
        params.push(lng, lat, Math.round(radiusKm * 1000));
      } else {
        // Fall back to Haversine distance (km) using raw SQL - parameters appended to params array
        spatialSelect = ', (6371 * 2 * ASIN(SQRT(POWER(SIN((? - ABS(r.lat)) * PI() / 180 / 2), 2) + COS(? * PI() / 180) * COS(ABS(r.lat) * PI() / 180) * POWER(SIN((? - r.lng) * PI() / 180 / 2), 2)))) AS distance_km';
        // We'll filter by distance <= radiusKm using HAVING (distance_km is an alias)
        spatialHaving = 'HAVING distance_km <= ?';
        // append lat, lat, lng, radius to params (order must match placeholders)
        params.push(lat, lat, lng, radiusKm);
        spatialParamCount = 4;
      }
    }

  // Pagination: compute total using same FROM/WHERE (but without spatial params used only for select/having)
  const whereSqlBase = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const countSql = `SELECT COUNT(DISTINCT r.id) as total FROM restaurants r ${joinDish} ${whereSqlBase}`;
  const [[countRow]] = await pool.query(countSql, spatialParamCount ? params.slice(0, params.length - spatialParamCount) : params);
    const total = countRow ? Number(countRow.total || 0) : 0;

    const offset = (Number(page) > 0 ? (Number(page) - 1) * Number(perPage) : 0);
    const lim = Number(perPage) > 0 ? Number(perPage) : 50;

    // Build final WHERE: include base WHERE and any spatial WHERE append (for ST_Distance_Sphere case)
    const whereSql = `${whereSqlBase}${spatialWhereAppend}`;

    const sql = `
      SELECT ${selectCols.join(', ')} ${spatialSelect}
      FROM restaurants r
      ${joinDish}
      ${whereSql}
      GROUP BY r.id
      ${spatialHaving ? spatialHaving : ''}
      ORDER BY
        ${hasR('featured_rank') ? 'COALESCE(r.featured_rank, 999),' : ''}
        ${orderClause}
      LIMIT ${lim} OFFSET ${offset}
    `;

    const [rows] = await pool.query(sql, params);

    // If a dishId filter was passed, also fetch any restaurant-specific variants for that dish
    if (req.query.dishId && rows && rows.length) {
      try {
        const restIds = rows.map(r => r.id);
        const placeholders = restIds.map(() => '?').join(',');

        // Check whether dish_variants has an image_url column so we can safely select it
        let selectImage = '';
        let selectAggs = '';
        try {
          const [cols] = await pool.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dish_variants' AND COLUMN_NAME = 'image_url'
          `, [cfg.database]);
          if (cols && cols.length) selectImage = 'dv.image_url,';
        } catch (colErr) {
          // ignore - we'll just not include image_url
          console.warn('Could not detect dish_variants.image_url column:', colErr && colErr.message ? colErr.message : colErr);
        }
        try {
          const [cols2] = await pool.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dish_variants' AND COLUMN_NAME = 'avg_rating'
          `, [cfg.database]);
          if (cols2 && cols2.length) selectAggs = 'dv.avg_rating, dv.total_ratings,';
        } catch (colErr) {
          console.warn('Could not detect dish_variants avg columns:', colErr && colErr.message ? colErr.message : colErr);
        }

  const sql = `SELECT dv.id, dv.dish_id, dv.restaurant_id, ${selectImage} ${selectAggs} dv.name, dv.description, dv.price, dv.is_available, dv.created_at, dv.updated_at
                     FROM dish_variants dv
                     WHERE dv.dish_id = ? AND dv.restaurant_id IN (${placeholders}) AND dv.is_available = 1`;

        const [variants] = await pool.query(sql, [Number(req.query.dishId), ...restIds]);
        const byRest = new Map();
        for (const v of variants) {
          const arr = byRest.get(v.restaurant_id) || [];
          arr.push(v);
          byRest.set(v.restaurant_id, arr);
        }
        for (const r of rows) {
          r.variants = byRest.get(r.id) || [];
        }
      } catch (e) {
        console.error('Failed to fetch dish_variants for restaurants:', e);
      }
    }

    res.json({ rows, total });
  } catch (e) {
    console.error('RESTAURANTS ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch restaurants', detail: String(e?.message || e) });
  }
});

// GET variants for a dish (include restaurant info)
app.get('/api/dishes/:id/variants', async (req, res) => {
  try {
    const dishId = Number(req.params.id);
    if (!Number.isFinite(dishId)) return res.status(400).json({ error: 'Invalid dish id' });
    const [rows] = await pool.query(`
      SELECT dv.id, dv.dish_id, dv.restaurant_id, dv.name, dv.description, dv.price, dv.is_available, dv.created_at, dv.updated_at,
             r.id as restaurant_id, r.name as restaurant_name, r.slug as restaurant_slug, r.address as restaurant_address, r.avg_rating
      FROM dish_variants dv
      JOIN restaurants r ON r.id = dv.restaurant_id
      WHERE dv.dish_id = ? AND dv.is_available = 1
      ORDER BY r.name, dv.name
    `, [dishId]);
    res.json(rows);
  } catch (e) {
    console.error('Failed to fetch dish variants:', e);
    res.status(500).json({ error: 'Failed to fetch dish variants', detail: String(e?.message || e) });
  }
});

// GET variants for a restaurant (include dish info)
app.get('/api/restaurants/:id/variants', async (req, res) => {
  try {
    const rid = Number(req.params.id);
    if (!Number.isFinite(rid)) return res.status(400).json({ error: 'Invalid restaurant id' });
    const [rows] = await pool.query(`
      SELECT dv.id, dv.dish_id, dv.restaurant_id, dv.name, dv.description, dv.price, dv.is_available, dv.created_at, dv.updated_at,
             d.id as dish_id, d.name as dish_name, d.slug as dish_slug, d.image_url as dish_image_url
      FROM dish_variants dv
      JOIN dishes d ON d.id = dv.dish_id
      WHERE dv.restaurant_id = ? AND dv.is_available = 1
      ORDER BY d.name, dv.name
    `, [rid]);
    res.json(rows);
  } catch (e) {
    console.error('Failed to fetch restaurant variants:', e);
    res.status(500).json({ error: 'Failed to fetch restaurant variants', detail: String(e?.message || e) });
  }
});

// Admin: create a variant
app.post('/admin/variants', authRequired, async (req, res) => {
  try {
    const { dish_id, restaurant_id, name, description = null, price = null, is_available = 1 } = req.body || {};
    if (!dish_id || !restaurant_id || !name) return res.status(400).json({ error: 'dish_id, restaurant_id and name are required' });
    const [result] = await pool.query(`
      INSERT INTO dish_variants (dish_id, restaurant_id, name, description, price, is_available, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [Number(dish_id), Number(restaurant_id), String(name), description, price == null ? null : Number(price), is_available ? 1 : 0]);
    const [[row]] = await pool.query('SELECT * FROM dish_variants WHERE id = ? LIMIT 1', [result.insertId]);
    res.json(row);
  } catch (e) {
    console.error('Failed to create variant:', e);
    res.status(500).json({ error: 'Failed to create variant', detail: String(e?.message || e) });
  }
});

// Admin: update a variant
app.put('/admin/variants/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const ups = [];
    const vals = [];
    const allowed = ['name','description','price','is_available'];
    for (const k of allowed) {
      if (k in req.body) { ups.push(`${k}=?`); vals.push(k === 'is_available' ? (req.body[k] ? 1 : 0) : req.body[k]); }
    }
    if (!ups.length) return res.json({ ok: true });
    vals.push(id);
    await pool.query(`UPDATE dish_variants SET ${ups.join(',')}, updated_at = NOW() WHERE id = ?`, vals);
    const [[row]] = await pool.query('SELECT * FROM dish_variants WHERE id = ? LIMIT 1', [id]);
    res.json(row);
  } catch (e) {
    console.error('Failed to update variant:', e);
    res.status(500).json({ error: 'Failed to update variant', detail: String(e?.message || e) });
  }
});

// Admin: delete a variant
app.delete('/admin/variants/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    await pool.query('DELETE FROM dish_variants WHERE id = ?', [id]);
    res.json({ ok: true, id });
  } catch (e) {
    console.error('Failed to delete variant:', e);
    res.status(500).json({ error: 'Failed to delete variant', detail: String(e?.message || e) });
  }
});

app.get('/api/restaurants/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const [rows] = await pool.query(`
      SELECT d.*, dr.price_note, dr.availability
      FROM dish_restaurants dr
      JOIN dishes d ON d.id = dr.dish_id
      WHERE dr.restaurant_id = ?
      ORDER BY d.name
    `, [id]);

    res.json(rows);
  } catch (e) {
    console.error('PUBLIC /api/restaurants/:id/dishes ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes for restaurant', detail: String(e?.message || e) });
  }
});

/* ========================================================================== */
/*                              ADMIN API (/admin)                             */
/* ========================================================================== */

// Guard ALL admin routes (Bearer JWT)
app.use('/admin', authRequired);

app.get('/admin/dish-categories', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, code, display_name, description, created_at
      FROM dish_categories 
      ORDER BY display_order ASC, display_name ASC
    `);
    
    console.log(`✅ Found ${rows.length} dish categories (admin)`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error fetching dish categories (admin):', error);
    res.status(500).json({ 
      error: 'Failed to fetch dish categories',
      details: error.message 
    });
  }
});

app.get('/admin/health', async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: row.ok === 1, db: cfg.database });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/admin/municipalities', async (_req, res) => {
  const [rows] = await pool.query(`SELECT id, name, slug FROM municipalities ORDER BY name`);
  res.json(rows);
});

/* -------- analytics -------- */
async function buildPerMunicipalityCounts() {
  const [munis] = await pool.query(`SELECT id, name FROM municipalities ORDER BY name`);
  const [dCounts] = await pool.query(`SELECT municipality_id id, COUNT(*) dishes FROM dishes GROUP BY municipality_id`);
  const [rCounts] = await pool.query(`SELECT municipality_id id, COUNT(*) restaurants FROM restaurants GROUP BY municipality_id`);
  const dm = new Map(dCounts.map(r => [r.id, r.dishes]));
  const rm = new Map(rCounts.map(r => [r.id, r.restaurants]));
  return munis.map(m => ({
    municipality_id: m.id,
    municipality_name: m.name,
    dishes: dm.get(m.id) || 0,
    restaurants: rm.get(m.id) || 0,
  }));
}

app.get('/admin/analytics/summary', async (_req, res) => {
  try {
    const [[{ dishCount }]] = await pool.query(`SELECT COUNT(*) AS dishCount FROM dishes`);
    const [[{ restCount }]] = await pool.query(`SELECT COUNT(*) AS restCount FROM restaurants`);
    const [[{ muniCount }]] = await pool.query(`SELECT COUNT(*) AS muniCount FROM municipalities`);
    const perMunicipality = await buildPerMunicipalityCounts();
    const topDishSql = `
      SELECT d.id, d.name, d.slug, ${hasD('panel_rank')?'d.panel_rank,':'NULL AS panel_rank,'}
             ${hasD('is_signature')?'d.is_signature,':'NULL AS is_signature,'}
             d.popularity
      FROM dishes d
      ORDER BY ${hasD('panel_rank')?'COALESCE(d.panel_rank,999),':''} d.popularity DESC, d.name
      LIMIT 3`;
    const [topDishes] = await pool.query(topDishSql);
    const topRestSql = `
      SELECT r.id, r.name, r.slug, r.rating,
             ${hasR('featured')?'r.featured,':'NULL AS featured,'}
             ${hasR('featured_rank')?'r.featured_rank':'NULL AS featured_rank'}
      FROM restaurants r
      ORDER BY ${hasR('featured_rank')?'COALESCE(r.featured_rank,999),':''} r.rating DESC, r.name
      LIMIT 3`;
    const [topRestaurants] = await pool.query(topRestSql);

    res.json({
      counts: { dishes: dishCount, restaurants: restCount, municipalities: muniCount },
      perMunicipality,
      top: { dishes: topDishes, restaurants: topRestaurants }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed analytics', detail: String(e?.message || e) });
  }
});
app.get('/admin/analytics/municipality-counts', async (_req, res) => {
  try { res.json(await buildPerMunicipalityCounts()); }
  catch (e) { res.status(500).json({ error: 'Failed per-municipality', detail: String(e?.message || e) }); }
});
app.get('/admin/analytics/per-municipality', async (_req, res) => {
  try { res.json(await buildPerMunicipalityCounts()); }
  catch (e) { res.status(500).json({ error: 'Failed per-municipality', detail: String(e?.message || e) }); }
});
app.get('/admin/analytics/per_municipality', async (_req, res) => {
  try { res.json(await buildPerMunicipalityCounts()); }
  catch (e) { res.status(500).json({ error: 'Failed per_municipality', detail: String(e?.message || e) }); }
});

/* -------- dishes (CRUD) -------- */
app.get('/admin/dishes', async (req, res) => {
  const { municipalityId, q, limit = 500, category } = req.query;
  const where = []; const p = [];
  if (municipalityId) { where.push('d.municipality_id=?'); p.push(Number(municipalityId)); }
  if (q) { where.push('d.name LIKE ?'); p.push(`%${String(q)}%`); }
  if (category) { where.push('c.code=?'); p.push(String(category)); }
  const sql = `
    SELECT d.id, d.municipality_id, d.name, d.slug, d.description, d.image_url,
           d.rating, d.popularity,
           ${hasD('is_signature')?'d.is_signature,':'NULL AS is_signature,'}
           ${hasD('panel_rank')?'d.panel_rank,':'NULL AS panel_rank,'}
           JSON_EXTRACT(d.flavor_profile,'$') AS flavor_profile,
           JSON_EXTRACT(d.ingredients,'$') AS ingredients,
           c.code AS category
    FROM dishes d
    JOIN dish_categories c ON c.id=d.category_id
    ${where.length?`WHERE ${where.join(' AND ')}`:''}
    ORDER BY 
      ${hasD('panel_rank') ? 'COALESCE(NULLIF(d.panel_rank, 0), 999),' : ''}
      d.name ASC
    LIMIT ${Number(limit)||500}`;
  const [rows] = await pool.query(sql, p);
  res.json(rows);
});

app.post('/admin/dishes', async (req, res) => {
  try {
    console.log('🔄 Creating new dish...');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      municipality_id, name, slug, description, image_url,
      category_id, // This is what the frontend is sending
      flavor_profile, ingredients, popularity, rating,
      is_signature, panel_rank,
    } = req.body;

    console.log('📋 Received fields:', {
      municipality_id,
      name,
      slug,
      category_id,
      description: description ? `${description.substring(0, 50)}...` : 'null',
      image_url: image_url ? `${image_url.substring(0, 50)}...` : 'null',
      flavor_profile,
      ingredients,
      popularity,
      rating,
      is_signature,
      panel_rank
    });

    if (!municipality_id || !name || !category_id) {
      const missing = [];
      if (!municipality_id) missing.push('municipality_id');
      if (!name) missing.push('name');
      if (!category_id) missing.push('category_id');
      
      console.log('❌ Missing required fields:', missing);
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing_fields: missing,
        details: 'municipality_id, name, category_id are required' 
      });
    }

    // Check if category exists by ID (not by code)
    const [[cat]] = await pool.query(`SELECT id, code FROM dish_categories WHERE id=?`, [Number(category_id)]);
    if (!cat) {
      console.log('❌ Invalid category_id:', category_id);
      return res.status(400).json({ 
        error: 'Invalid category_id',
        details: `Category with id ${category_id} not found` 
      });
    }

    console.log('✅ Found category:', cat);

    const payload = {
      municipality_id: Number(municipality_id),
      category_id: cat.id, // Use the validated category ID
      name: String(name),
      slug: slug ? String(slug) : slugify(name),
      description: description ?? null,
      image_url: image_url ?? null,
      flavor_profile: jsonOrNull(parseMaybeJsonArray(flavor_profile)),
      ingredients: jsonOrNull(parseMaybeJsonArray(ingredients)),
      popularity: toInt(popularity),
      rating: toInt(rating),
      ...(hasD('is_signature') ? { is_signature: is_signature ? 1 : 0 } : {}),
      ...(hasD('panel_rank') ? { panel_rank: panel_rank == null ? null : Number(panel_rank) } : {}),
    };

    console.log('✅ Prepared payload:', payload);

    const fields = Object.keys(payload);
    const placeholders = fields.map(()=>'?').join(',');
    const values = fields.map(k => payload[k]);
    
    console.log('📝 Executing SQL with fields:', fields);
    
    const [result] = await pool.query(
      `INSERT INTO dishes (${fields.join(',')}) VALUES (${placeholders})`, values);
    
    console.log(`✅ Created dish: ${name} (ID: ${result.insertId})`);
    res.json({ id: result.insertId, ...payload });
  } catch (e) {
    console.error('❌ Error creating dish:', e);
    console.error('Full error details:', {
      message: e.message,
      code: e.code,
      errno: e.errno,
      sqlMessage: e.sqlMessage,
      sqlState: e.sqlState
    });
    res.status(500).json({ 
      error: 'Failed to create dish', 
      detail: String(e?.message || e),
      sqlError: e.sqlMessage 
    });
  }
});

// Endpoint to get top dishes or restaurants

app.post('/api/ratings', async (req, res) => {
  try {
    const { user_id, rateable_id, rateable_type, rating } = req.body;

    if (!['dish', 'restaurant', 'variant'].includes(rateable_type)) {
      return res.status(400).json({ error: 'Invalid rateable_type. Must be "dish", "restaurant" or "variant".' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    // Insert or update user rating
    await pool.query(`
      INSERT INTO ratings (user_id, rateable_id, rateable_type, rating)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = NOW()
    `, [user_id, rateable_id, rateable_type, rating]);

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit rating', details: error.message });
  }
});

/* ---------------- Reviews (ratings + comments) ---------------- */

// Fetch reviews for a dish or restaurant
app.get('/api/reviews', async (req, res) => {
  try {
    const { rateable_id, rateable_type, limit = 200 } = req.query;
    if (!rateable_id || !rateable_type) return res.status(400).json({ error: 'rateable_id and rateable_type are required' });

    const [rows] = await pool.query(
      `SELECT r.id, r.user_id, r.rateable_id, r.rateable_type, r.rating, r.comment, r.created_at, r.updated_at,
              u.display_name AS user_name, u.email AS user_email
       FROM ratings r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.rateable_type = ? AND r.rateable_id = ?
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [String(rateable_type), Number(rateable_id), Number(limit)]
    );
    res.json(rows);
  } catch (e) {
    console.error('Failed to fetch reviews:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create or update a review (rating + optional comment)
app.post('/api/reviews', authRequired, async (req, res) => {
  try {
    const { rateable_id, rateable_type, rating, comment } = req.body || {};
    const user_id = req.user && req.user.uid;
    if (!user_id) return res.status(401).json({ error: 'unauthorized' });
    if (!user_id || !rateable_id || !rateable_type || !rating) return res.status(400).json({ error: 'Missing fields; rateable_id, rateable_type, rating required' });
  if (!['dish', 'restaurant', 'variant'].includes(String(rateable_type))) return res.status(400).json({ error: 'rateable_type must be dish, restaurant or variant' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' });

    // Insert or update the rating row; include comment. Use authenticated user id from JWT.
    await pool.query(`
      INSERT INTO ratings (user_id, rateable_id, rateable_type, rating, comment)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = NOW()
    `, [user_id, rateable_id, rateable_type, rating, comment || null]);

    // Return the saved review
    const [rows] = await pool.query(
      `SELECT r.id, r.user_id, r.rateable_id, r.rateable_type, r.rating, r.comment, r.created_at, r.updated_at,
              u.display_name AS user_name, u.email AS user_email
       FROM ratings r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.user_id = ? AND r.rateable_id = ? AND r.rateable_type = ?
       LIMIT 1`,
      [user_id, rateable_id, rateable_type]
    );

    // Recalculate aggregates for the affected item (avg_rating, total_ratings)
    try {
      await recalcAggregatesFor(rateable_type, rateable_id);
    } catch (e) { console.error('Failed recalc after save review:', e); }

    res.json(rows[0] || null);
  } catch (e) {
    console.error('Failed to save review:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// Get reviews for a specific user (pass user_id as query param)
app.get('/api/user/reviews', authRequired, async (req, res) => {
  try {
    const user_id = req.user && req.user.uid;
    const { limit = 200 } = req.query;
    if (!user_id) return res.status(401).json({ error: 'unauthorized' });

    const [rows] = await pool.query(
      `SELECT r.id, r.user_id, r.rateable_id, r.rateable_type, r.rating, r.comment, r.created_at, r.updated_at,
              u.display_name AS user_name, u.email AS user_email
       FROM ratings r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.user_id = ?
       ORDER BY r.updated_at DESC
       LIMIT ?`,
      [Number(user_id), Number(limit)]
    );
    res.json(rows);
  } catch (e) {
    console.error('Failed to fetch user reviews:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch user reviews' });
  }
});

// Update a review by id
app.put('/api/reviews/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const { rating, comment } = req.body || {};
    if (rating != null && (rating < 1 || rating > 5)) return res.status(400).json({ error: 'rating must be between 1 and 5' });

    // Ensure the authenticated user owns this review
    const user_id = req.user && req.user.uid;
    if (!user_id) return res.status(401).json({ error: 'unauthorized' });
    const [[existing]] = await pool.query('SELECT user_id FROM ratings WHERE id = ? LIMIT 1', [id]);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (Number(existing.user_id) !== Number(user_id)) return res.status(403).json({ error: 'forbidden' });

    const sets = [];
    const vals = [];
    if (rating != null) { sets.push('rating=?'); vals.push(rating); }
    if (comment !== undefined) { sets.push('comment=?'); vals.push(comment); }
    if (!sets.length) return res.json({ ok: true });

    vals.push(id);
    await pool.query(`UPDATE ratings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
    // Recalculate aggregates for the affected item
    try {
      const [[row]] = await pool.query('SELECT rateable_type, rateable_id FROM ratings WHERE id=? LIMIT 1', [id]);
      if (row) await recalcAggregatesFor(row.rateable_type, row.rateable_id);
    } catch (e) { console.error('Failed recalc after update review:', e); }
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to update review:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete a review by id
app.delete('/api/reviews/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const user_id = req.user && req.user.uid;
    if (!user_id) return res.status(401).json({ error: 'unauthorized' });

    const [[existing]] = await pool.query('SELECT user_id, rateable_type, rateable_id FROM ratings WHERE id = ? LIMIT 1', [id]);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (Number(existing.user_id) !== Number(user_id)) return res.status(403).json({ error: 'forbidden' });

    // capture rateable info, delete, then recalc aggregates
    const rateable_type = existing.rateable_type;
    const rateable_id = existing.rateable_id;
    await pool.query('DELETE FROM ratings WHERE id = ?', [id]);
    try { await recalcAggregatesFor(rateable_type, rateable_id); } catch (e) { console.error('Failed recalc after delete review:', e); }
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to delete review:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Helper: recalculate avg_rating and total_ratings for dish, restaurant or variant
async function recalcAggregatesFor(rateable_type, rateable_id) {
  const rt = String(rateable_type);

  // Variant is a special case: update dish_variants if present
  if (rt === 'variant') {
    try {
      const [[info]] = await pool.query(`
        SELECT IFNULL(AVG(rating),0) AS avg_rating, COUNT(rating) AS total_ratings
        FROM ratings WHERE rateable_type = ? AND rateable_id = ?
      `, [rt, Number(rateable_id)]);
      const avg = Number(info?.avg_rating || 0);
      const total = Number(info?.total_ratings || 0);
      try {
        await pool.query('UPDATE dish_variants SET avg_rating = ?, total_ratings = ? WHERE id = ?', [avg, total, rateable_id]);
      } catch (e) {
        // If columns don't exist, just warn and continue
        console.warn('Could not update dish_variants aggregates (columns may be missing):', e && e.message ? e.message : e);
      }
    } catch (e) {
      console.error('Failed to recalc aggregates for variant:', e && e.message ? e.message : e);
    }
    return;
  }

  // dish / restaurant
  if (!['dish', 'restaurant'].includes(rt)) return;
  try {
    const [rows] = await pool.query(`
      SELECT IFNULL(AVG(rating),0) AS avg_rating, COUNT(rating) AS total_ratings
      FROM ratings WHERE rateable_type = ? AND rateable_id = ?
    `, [rt, Number(rateable_id)]);
    const info = rows && rows[0] ? rows[0] : { avg_rating: 0, total_ratings: 0 };
    const avg = Number(info.avg_rating || 0);
    const total = Number(info.total_ratings || 0);
    if (rt === 'dish') {
      await pool.query('UPDATE dishes SET avg_rating = ?, total_ratings = ? WHERE id = ?', [avg, total, rateable_id]);
    } else {
      await pool.query('UPDATE restaurants SET avg_rating = ?, total_ratings = ? WHERE id = ?', [avg, total, rateable_id]);
    }
  } catch (e) {
    console.error('Failed to recalc aggregates:', e && e.message ? e.message : e);
  }
}

app.get('/api/top-dishes', async (req, res) => {
  try {
    const { municipality_id } = req.query;

    const [dishes] = await pool.query(`
      SELECT id, name, avg_rating, total_ratings
      FROM dishes
      WHERE municipality_id = ?
      ORDER BY avg_rating DESC, total_ratings DESC
      LIMIT 10
    `, [municipality_id]);

    res.json(dishes);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top dishes', details: error.message });
  }
});

app.get('/api/top-restaurants', async (req, res) => {
  try {
    const { municipality_id } = req.query;

    const [restaurants] = await pool.query(`
      SELECT id, name, avg_rating, total_ratings
      FROM restaurants
      WHERE municipality_id = ?
      ORDER BY avg_rating DESC, total_ratings DESC
      LIMIT 10
    `, [municipality_id]);

    res.json(restaurants);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top restaurants', details: error.message });
  }
});

// Endpoint to submit a rating
app.post('/api/ratings', async (req, res) => {
  try {
    const { user_id, rateable_id, rateable_type, rating } = req.body;

    // Validate input
    if (!['dish', 'restaurant'].includes(rateable_type)) {
      return res.status(400).json({ error: 'Invalid rateable_type. Must be "dish" or "restaurant".' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    // Insert or update user rating
    const query = `
      INSERT INTO ratings (user_id, rateable_id, rateable_type, rating)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = NOW()
    `;
    await pool.query(query, [user_id, rateable_id, rateable_type, rating]);

    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('❌ Error submitting rating:', error);
    res.status(500).json({ error: 'Failed to submit rating', details: error.message });
  }
});
app.put('/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const up = {};
    const allow = [
      'municipality_id','name','slug','description','image_url',
      'popularity','rating','flavor_profile','ingredients'
    ];
    if (hasD('is_signature')) allow.push('is_signature');
    if (hasD('panel_rank')) allow.push('panel_rank');

    for (const k of allow) {
      if (k in req.body) {
        if (k === 'flavor_profile' || k === 'ingredients') {
          up[k] = jsonOrNull(parseMaybeJsonArray(req.body[k]));
        } else if (k === 'is_signature') {
          up[k] = req.body[k] ? 1 : 0;
        } else if (k === 'panel_rank') {
          up[k] = req.body[k] == null ? null : Number(req.body[k]);
        } else {
          up[k] = req.body[k];
        }
      }
    }
    
    // Handle category_id update (not category code)
    if ('category_id' in req.body && req.body.category_id) {
      const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE id=?`, [Number(req.body.category_id)]);
      if (!cat) return res.status(400).json({ error: 'Invalid category_id' });
      up.category_id = cat.id;
    }
    
    if ('name' in req.body && !('slug' in req.body)) up.slug = slugify(req.body.name);

    const sets = Object.keys(up).map(k => `${k}=?`);
    const values = Object.keys(up).map(k => up[k]);
    if (!sets.length) return res.json({ ok: true, id });

    await pool.query(`UPDATE dishes SET ${sets.join(', ')} WHERE id=?`, [...values, id]);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message || e) });
  }
});

app.delete('/admin/dishes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=?`, [id]);
  await pool.query(`DELETE FROM dishes WHERE id=?`, [id]);
  res.json({ ok: true, id });
});

/* -------- restaurants (CRUD) -------- */
app.get('/admin/restaurants', async (req, res) => {
  const { municipalityId, q, limit = 500 } = req.query;
  const where = []; const p = [];
  if (municipalityId) { where.push('r.municipality_id=?'); p.push(Number(municipalityId)); }
  if (q) { where.push('r.name LIKE ?'); p.push(`%${String(q)}%`); }
  const select = `
    r.id, r.municipality_id, r.name, r.slug, r.kind,
    r.description, r.address, r.phone, r.website, r.facebook, r.instagram, r.opening_hours,
    r.price_range, JSON_EXTRACT(r.cuisine_types,'$') AS cuisine_types,
    r.rating, r.lat, r.lng
    ${hasR('image_url')?', r.image_url':''}
    ${hasR('featured')?', r.featured':''}
    ${hasR('featured_rank')?', r.featured_rank':''}
  `;
  const [rows] = await pool.query(`
    SELECT ${select} FROM restaurants r
    ${where.length?`WHERE ${where.join(' AND ')}`:''}
    ORDER BY ${hasR('featured_rank')?'COALESCE(r.featured_rank,999),':''} r.name ASC
    LIMIT ${Number(limit)||500}`, p);
  res.json(rows);
});

app.post('/admin/restaurants', async (req, res) => {
  try {
    const {
      municipality_id, name, slug, kind,
      description, address, phone, website, facebook, instagram, opening_hours,
      price_range, cuisine_types, rating, lat, lng,
      image_url, featured, featured_rank
    } = req.body;

    if (!municipality_id || !name || !address || lat == null || lng == null) {
      return res.status(400).json({ error: 'municipality_id, name, address, lat, lng are required' });
    }
    const payload = {
      municipality_id: Number(municipality_id),
      name: String(name),
      slug: slug ? String(slug) : slugify(name),
      kind: kind ?? 'restaurant',
      description: description ?? null,
      address: String(address),
      phone: phone ?? null,
      website: website ?? null,
      facebook: facebook ?? null,
      instagram: instagram ?? null,
      opening_hours: opening_hours ?? null,
      price_range: price_range ?? null,
      cuisine_types: jsonOrNull(parseMaybeJsonArray(cuisine_types)),
      rating: toInt(rating),
      lat: Number(lat),
      lng: Number(lng),
      ...(hasR('image_url') ? { image_url: image_url ?? null } : {}),
      ...(hasR('featured') ? { featured: featured ? 1 : 0 } : {}),
      ...(hasR('featured_rank') ? { featured_rank: featured_rank == null ? null : Number(featured_rank) } : {}),
    };

    const fields = Object.keys(payload);
    const placeholders = fields.map(()=>'?').join(',');
    const values = fields.map(k => payload[k]);
    const [result] = await pool.query(
      `INSERT INTO restaurants (${fields.join(',')}) VALUES (${placeholders})`, values);
    res.json({ id: result.insertId, ...payload });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create restaurant', detail: String(e?.message || e) });
  }
});

app.patch('/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const up = {};
    const allow = [
      'municipality_id','name','slug','kind','description','address','phone','website','facebook','instagram',
      'opening_hours','price_range','rating','lat','lng','cuisine_types'
    ];
    if (hasR('image_url')) allow.push('image_url');
    if (hasR('featured')) allow.push('featured');
    if (hasR('featured_rank')) allow.push('featured_rank');

    for (const k of allow) {
      if (k in req.body) {
        if (k === 'cuisine_types') up[k] = jsonOrNull(parseMaybeJsonArray(req.body[k]));
        else if (k === 'featured') up[k] = req.body[k] ? 1 : 0;
        else if (k === 'featured_rank') up[k] = req.body[k] == null ? null : Number(req.body[k]);
        else up[k] = req.body[k];
      }
    }
    if ('name' in req.body && !('slug' in req.body)) up.slug = slugify(req.body.name);

    const sets = Object.keys(up).map(k => `${k}=?`);
    const values = Object.keys(up).map(k => up[k]);
    if (!sets.length) return res.json({ ok: true, id });

    await pool.query(`UPDATE restaurants SET ${sets.join(', ')} WHERE id=?`, [...values, id]);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update restaurant', detail: String(e?.message || e) });
  }
});

app.delete('/admin/restaurants/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await pool.query(`DELETE FROM dish_restaurants WHERE restaurant_id=?`, [id]);
  await pool.query(`DELETE FROM restaurants WHERE id=?`, [id]);
  res.json({ ok: true, id });
});

/* -------- linking & curation (+compat aliases) -------- */
app.get('/admin/dishes/:id/restaurants', async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT r.*, dr.price_note, dr.availability
    FROM dish_restaurants dr
    JOIN restaurants r ON r.id=dr.restaurant_id
    WHERE dr.dish_id=? ORDER BY r.name`, [id]);
  res.json(rows);
  
});
app.get('/admin/restaurants/:id/dishes', async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT d.*, dr.price_note, dr.availability
    FROM dish_restaurants dr
    JOIN dishes d ON d.id=dr.dish_id
    WHERE dr.restaurant_id=? ORDER BY d.name`, [id]);
  res.json(rows);
});

app.post('/admin/dish-restaurants', async (req, res) => {
  const { dish_id, restaurant_id, price_note=null, availability='regular' } = req.body || {};
  if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'dish_id and restaurant_id are required' });
  await pool.query(`
    INSERT INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE price_note=VALUES(price_note), availability=VALUES(availability)
  `, [dish_id, restaurant_id, price_note, availability]);
  res.json({ ok: true });
});
app.delete('/admin/dish-restaurants', async (req, res) => {
  const dish_id = Number(req.query.dish_id);
  const restaurant_id = Number(req.query.restaurant_id);
  if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'dish_id & restaurant_id are required' });
  await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dish_id, restaurant_id]);
  res.json({ ok: true });

});
// Aliases commonly used by previous admin client:
app.post('/admin/links', async (req, res) => {
  const { dishId, restaurantId, price_note=null, availability='regular' } = req.body || {};
  if (!dishId || !restaurantId) return res.status(400).json({ error: 'dishId and restaurantId are required' });
  await pool.query(`
    INSERT INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE price_note=VALUES(price_note), availability=VALUES(availability)
  `, [dishId, restaurantId, price_note, availability]);
  res.json({ ok: true });
});
app.delete('/admin/links', async (req, res) => {
  const dishId = Number(req.query.dishId);
  const restaurantId = Number(req.query.restaurantId);
  if (!dishId || !restaurantId) return res.status(400).json({ error: 'dishId & restaurantId are required' });
  await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dishId, restaurantId]);
  res.json({ ok: true });
});

app.post('/admin/dishes/:dishId/unlink-restaurants', async (req, res) => {
  try {
    const dishId = Number(req.params.dishId);
    const { restaurantIds } = req.body;

    if (!restaurantIds) {
      return res.status(400).json({ error: 'restaurantIds is required' });
    }

    const restaurantIdArray = Array.isArray(restaurantIds) ? restaurantIds : [restaurantIds];
    
    if (restaurantIdArray.length === 0) {
      return res.status(400).json({ error: 'No restaurant IDs provided' });
    }

    const placeholders = restaurantIdArray.map((_, index) => `?`).join(',');
    const query = `
      DELETE FROM dish_restaurants 
      WHERE dish_id = ? 
      AND restaurant_id IN (${placeholders})
    `;

    const values = [dishId, ...restaurantIdArray];
    
    const [result] = await pool.query(query, values);
    
    res.json({
      success: true,
      message: `Successfully unlinked dish ${dishId} from ${result.affectedRows} restaurant(s)`,
      unlinkedCount: result.affectedRows,
      dishId,
      restaurantIds: restaurantIdArray
    });

  } catch (error) {
    console.error('Error unlinking dish from restaurants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink dish from restaurants',
      details: error.message
    });
  }
});

/**
 * Batch unlink multiple dishes from multiple restaurants
 */
app.post('/admin/dishes/bulk-unlink', async (req, res) => {
  try {
    const { unlinks } = req.body; // Array of { dishId, restaurantId } objects
    
    if (!unlinks || !Array.isArray(unlinks) || unlinks.length === 0) {
      return res.status(400).json({ error: 'unlinks array is required' });
    }

    let totalUnlinked = 0;
    
    // Process in batches to avoid too many database connections
    const batchSize = 100;
    for (let i = 0; i < unlinks.length; i += batchSize) {
      const batch = unlinks.slice(i, i + batchSize);
      
      const conditions = batch.map((link, index) => 
        `(dish_id = ? AND restaurant_id = ?)`
      ).join(' OR ');
      
      const values = batch.flatMap(link => [link.dishId, link.restaurantId]);
      
      const query = `DELETE FROM dish_restaurants WHERE ${conditions}`;
      const [result] = await pool.query(query, values);
      
      totalUnlinked += result.affectedRows;
    }

    res.json({
      success: true,
      message: `Successfully unlinked ${totalUnlinked} dish-restaurant relationships`,
      unlinkedCount: totalUnlinked,
      totalProcessed: unlinks.length
    });

  } catch (error) {
    console.error('Error in batch unlinking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch unlink dishes',
      details: error.message
    });
  }
});

/**
 * Unlink a dish from ALL restaurants (clean slate)
 */
app.delete('/admin/dishes/:dishId/restaurants', async (req, res) => {
  try {
    const dishId = Number(req.params.dishId);
    
    const [result] = await pool.query(
      'DELETE FROM dish_restaurants WHERE dish_id = ?',
      [dishId]
    );
    
    res.json({
      success: true,
      message: `Successfully unlinked dish ${dishId} from all restaurants (${result.affectedRows} links removed)`,
      unlinkedCount: result.affectedRows,
      dishId
    });

  } catch (error) {
    console.error('Error unlinking dish from all restaurants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink dish from all restaurants',
      details: error.message
    });
  }
});


app.post('/api/restaurants/unlink', async (req, res) => {
  const { dishId, restaurantId } = req.body || {};
  if (!dishId || !restaurantId) return res.status(400).json({ error: 'dishId & restaurantId are required' });
  await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dishId, restaurantId]);
  res.json({ ok: true });
});
app.post('/admin/dish-restaurants/unlink', async (req, res) => {
  const { dish_id, restaurant_id } = req.body || {};
  if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'dish_id & restaurant_id are required' });
  await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dish_id, restaurant_id]);
  res.json({ ok: true });
});

// Curation (provide both "/curate" and "/curation" aliases)
app.patch('/admin/curate/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_signature, panel_rank, featured, featured_rank } = req.body || {};
    const up = {};
    
    // Use the schema checking functions properly
    if (req.body.is_signature !== undefined && hasD('is_signature')) 
      up.is_signature = is_signature ? 1 : 0;
    if (req.body.panel_rank !== undefined && hasD('panel_rank')) 
      up.panel_rank = panel_rank == null ? null : Number(panel_rank);
    if (req.body.featured !== undefined && hasD('featured')) 
      up.featured = featured ? 1 : 0;
    if (req.body.featured_rank !== undefined && hasD('featured_rank')) 
      up.featured_rank = featured_rank == null ? null : Number(featured_rank);

    const sets = Object.keys(up).map(k => `${k}=?`); 
    const vals = Object.keys(up).map(k => up[k]);
    if (!sets.length) return res.json({ ok: true });
    
    await pool.query(`UPDATE dishes SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating dish curation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.patch('/admin/curate/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { featured, featured_rank } = req.body || {};
    const up = {};
    
    if (req.body.featured !== undefined && hasR('featured')) 
      up.featured = featured ? 1 : 0;
    if (req.body.featured_rank !== undefined && hasR('featured_rank')) 
      up.featured_rank = featured_rank == null ? null : Number(featured_rank);
    
    const sets = Object.keys(up).map(k => `${k}=?`); 
    const vals = Object.keys(up).map(k => up[k]);
    if (!sets.length) return res.json({ ok: true });
    
    await pool.query(`UPDATE restaurants SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating restaurant curation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Aliases "/curation/*" via same handlers:
app.patch('/admin/curation/dishes/:id', async (req, res) => {
  // Forward to the actual handler logic
  try {
    const id = Number(req.params.id);
    const { is_signature, panel_rank, featured, featured_rank } = req.body || {};
    const up = {};
    
    if (req.body.is_signature !== undefined && hasD('is_signature')) 
      up.is_signature = is_signature ? 1 : 0;
    if (req.body.panel_rank !== undefined && hasD('panel_rank')) 
      up.panel_rank = panel_rank == null ? null : Number(panel_rank);
    if (req.body.featured !== undefined && hasD('featured')) 
      up.featured = featured ? 1 : 0;
    if (req.body.featured_rank !== undefined && hasD('featured_rank')) 
      up.featured_rank = featured_rank == null ? null : Number(featured_rank);

    const sets = Object.keys(up).map(k => `${k}=?`); 
    const vals = Object.keys(up).map(k => up[k]);
    if (!sets.length) return res.json({ ok: true });
    
    await pool.query(`UPDATE dishes SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating dish curation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/admin/curation/restaurants/:id', async (req, res) => {
  // Forward to the actual handler logic
  try {
    const id = Number(req.params.id);
    const { featured, featured_rank } = req.body || {};
    const up = {};
    
    if (req.body.featured !== undefined && hasR('featured')) 
      up.featured = featured ? 1 : 0;
    if (req.body.featured_rank !== undefined && hasR('featured_rank')) 
      up.featured_rank = featured_rank == null ? null : Number(featured_rank);
    
    const sets = Object.keys(up).map(k => `${k}=?`); 
    const vals = Object.keys(up).map(k => up[k]);
    if (!sets.length) return res.json({ ok: true });
    
    await pool.query(`UPDATE restaurants SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating restaurant curation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// =============================================================================
// RESTAURANT-SPECIFIC DISH FEATURING ENDPOINTS
// =============================================================================
app.get('/api/restaurants/:id/featured-dishes', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    console.log('🔄 GET /api/restaurants/' + restaurantId + '/featured-dishes');
    
    // First, check if the restaurant exists
    const [restaurantCheck] = await pool.query(
      'SELECT id, name FROM restaurants WHERE id = ?',
      [restaurantId]
    );
    
    if (restaurantCheck.length === 0) {
      console.log('❌ Restaurant not found:', restaurantId);
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    console.log('✅ Restaurant found:', restaurantCheck[0].name);

    // Check if dish_restaurants table has the required columns
    try {
      const [tableInfo] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'dish_restaurants' 
        AND TABLE_SCHEMA = DATABASE()
      `);
      console.log('📋 dish_restaurants columns:', tableInfo.map(col => col.COLUMN_NAME));
    } catch (tableError) {
      console.log('⚠️ Could not check table structure:', tableError.message);
    }

    // Simple query to get all dishes for this restaurant
    const query = `
      SELECT 
        d.id as dish_id,
        d.name as dish_name,
        d.description as original_description,
        d.category,
        d.image_url,
        d.municipality_id,
        dr.is_featured,
        dr.featured_rank,
        dr.restaurant_specific_description,
        dr.restaurant_specific_price,
        dr.availability,
        dr.created_at
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      WHERE dr.restaurant_id = ?
      ORDER BY dr.is_featured DESC, dr.featured_rank ASC, d.name ASC
    `;
    
    console.log('📝 Executing query for restaurant:', restaurantId);
    const [dishes] = await pool.query(query, [restaurantId]);
    console.log(`✅ Found ${dishes.length} dishes for restaurant ${restaurantId}`);
    
    res.json(dishes);
  } catch (error) {
    console.error('❌ Error fetching featured dishes:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });
    res.status(500).json({ 
      error: 'Failed to fetch featured dishes',
      details: error.message 
    });
  }
});

app.patch('/admin/restaurants/:restaurantId/dishes/:dishId/feature', async (req, res) => {
  try {
    const { restaurantId, dishId } = req.params;
    const {
      is_featured,
      featured_rank,
      restaurant_specific_description,
      restaurant_specific_price,
      availability
    } = req.body;

    console.log('Updating restaurant dish feature:', { 
      restaurantId, 
      dishId, 
      is_featured, 
      featured_rank 
    });

    // Check if relationship exists
    const [existing] = await pool.query(
      'SELECT * FROM dish_restaurants WHERE restaurant_id = ? AND dish_id = ?',
      [restaurantId, dishId]
    );

    if (existing.length === 0) {
      // Create new relationship
      await pool.query(
        `INSERT INTO dish_restaurants 
         (restaurant_id, dish_id, is_featured, featured_rank, restaurant_specific_description, restaurant_specific_price, availability) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurantId, 
          dishId, 
          is_featured ? 1 : 0, 
          featured_rank, 
          restaurant_specific_description, 
          restaurant_specific_price, 
          availability || 'regular'
        ]
      );
      console.log('Created new dish-restaurant relationship');
    } else {
      // Update existing relationship
      await pool.query(
        `UPDATE dish_restaurants 
         SET is_featured = ?, featured_rank = ?, restaurant_specific_description = ?, restaurant_specific_price = ?, availability = ?
         WHERE restaurant_id = ? AND dish_id = ?`,
        [
          is_featured ? 1 : 0, 
          featured_rank, 
          restaurant_specific_description, 
          restaurant_specific_price, 
          availability || 'regular', 
          restaurantId, 
          dishId
        ]
      );
      console.log('Updated existing dish-restaurant relationship');
    }

    res.json({ success: true, message: 'Dish feature updated successfully' });
  } catch (error) {
    console.error('Error updating dish feature:', error);
    res.status(500).json({ error: 'Failed to update dish feature' });
  }
});

app.post('/admin/restaurants/:restaurantId/dishes', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { dish_id, is_featured, featured_rank, restaurant_specific_description, restaurant_specific_price, availability } = req.body;

    console.log('Adding dish to restaurant:', { restaurantId, dish_id, ...req.body });

    // Check if relationship already exists
    const [existing] = await pool.query(
      'SELECT * FROM dish_restaurants WHERE restaurant_id = ? AND dish_id = ?',
      [restaurantId, dish_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Dish is already linked to this restaurant' });
    }

    await pool.query(
      `INSERT INTO dish_restaurants 
       (restaurant_id, dish_id, is_featured, featured_rank, restaurant_specific_description, restaurant_specific_price, availability) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        restaurantId, 
        dish_id, 
        is_featured ? 1 : 0, 
        featured_rank, 
        restaurant_specific_description, 
        restaurant_specific_price, 
        availability || 'regular'
      ]
    );

    console.log('Successfully added dish to restaurant');
    res.json({ success: true, message: 'Dish added to restaurant successfully' });
  } catch (error) {
    console.error('Error adding dish to restaurant:', error);
    res.status(500).json({ error: 'Failed to add dish to restaurant' });
  }
});

// GET /api/restaurants/:restaurantId/dishes/:dishId
app.get('/api/restaurants/:restaurantId/dishes/:dishId', async (req, res) => {
  try {
    const { restaurantId, dishId } = req.params;
    
    console.log('Fetching restaurant dish details:', { restaurantId, dishId });
    
    const [results] = await pool.query(
      `SELECT 
        dr.*, 
        d.name as dish_name, 
        d.description as original_description,
        d.category,
        d.image_url,
        d.municipality_id
       FROM dish_restaurants dr
       JOIN dishes d ON dr.dish_id = d.id
       WHERE dr.restaurant_id = ? AND dr.dish_id = ?`,
      [restaurantId, dishId]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Dish not found in restaurant' });
    }
    
    const dish = results[0];
    
    // Parse JSON fields if they exist
    const parsedDish = {
      ...dish,
      flavor_profile: dish.flavor_profile ? JSON.parse(dish.flavor_profile) : null,
      ingredients: dish.ingredients ? JSON.parse(dish.ingredients) : null,
    };
    
    res.json(parsedDish);
  } catch (error) {
    console.error('Error fetching restaurant dish details:', error);
    res.status(500).json({ error: 'Failed to fetch dish details' });
  }
});

// GET /api/restaurants/:restaurantId/dishes/:dishId
// Get restaurant-specific dish details
app.get('/api/restaurants/:restaurantId/dishes/:dishId', async (req, res) => {
  try {
    const { restaurantId, dishId } = req.params;
    
    const [results] = await pool.query(
      `SELECT 
        dr.*, 
        d.name as dish_name, 
        d.description as original_description,
        d.category,
        d.image_url
       FROM dish_restaurants dr
       JOIN dishes d ON dr.dish_id = d.id
       WHERE dr.restaurant_id = ? AND dr.dish_id = ?`,
      [restaurantId, dishId]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Dish not found in restaurant' });
    }
    
    const dish = results[0];
    
    // Parse JSON fields if they exist
    const parsedDish = {
      ...dish,
      flavor_profile: dish.flavor_profile ? JSON.parse(dish.flavor_profile) : null,
      ingredients: dish.ingredients ? JSON.parse(dish.ingredients) : null,
    };
    
    res.json(parsedDish);
  } catch (error) {
    console.error('Error fetching restaurant dish details:', error);
    res.status(500).json({ error: 'Failed to fetch dish details' });
  }
});

// GET /api/restaurants/:id/dishes
// Get all dishes for a restaurant (both featured and non-featured)
app.get('/api/restaurants/:id/dishes', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    const query = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.category,
        d.image_url,
        d.municipality_id,
        d.rating,
        d.popularity,
        dr.is_featured,
        dr.featured_rank,
        dr.restaurant_specific_description,
        dr.restaurant_specific_price,
        dr.availability,
        dr.price_note,
        dr.created_at
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      WHERE dr.restaurant_id = ?
      ORDER BY dr.is_featured DESC, dr.featured_rank ASC, d.name ASC
    `;
    
    const [dishes] = await pool.query(query, [restaurantId]);
    res.json(dishes);
  } catch (error) {
    console.error('Error fetching restaurant dishes:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant dishes' });
  }
});

// DELETE /admin/restaurants/:restaurantId/dishes/:dishId
// Remove a dish from a restaurant
app.delete('/admin/restaurants/:restaurantId/dishes/:dishId', async (req, res) => {
  try {
    const { restaurantId, dishId } = req.params;

    console.log('Removing dish from restaurant:', { restaurantId, dishId });

    const [result] = await pool.query(
      'DELETE FROM dish_restaurants WHERE restaurant_id = ? AND dish_id = ?',
      [restaurantId, dishId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dish not found in restaurant' });
    }

    res.json({ success: true, message: 'Dish removed from restaurant successfully' });
  } catch (error) {
    console.error('Error removing dish from restaurant:', error);
    res.status(500).json({ error: 'Failed to remove dish from restaurant' });
  }
});

// PATCH /admin/restaurants/:restaurantId/dishes/:dishId/availability
// Update only the availability of a dish in a restaurant
app.patch('/admin/restaurants/:restaurantId/dishes/:dishId/availability', async (req, res) => {

  try {
    const { restaurantId, dishId } = req.params;
    // ...existing code for this route...
    // (leave this route unchanged, just close the try block properly)
  } catch (error) {
    // ...existing error handling...
  }
  
});

// (Duplicate registration handler removed; handler is defined earlier in the file)

// =============================================================================
// RESTAURANT-DISH LINKING ENDPOINTS (BULK OPERATIONS & ANALYTICS)
// =============================================================================
app.get('/api/restaurant-dish-links', async (req, res) => {
  try {
    const { dishId, restaurantId, municipalityId, limit = 1000 } = req.query;
    
    let where = ['1=1'];
    const params = [];

    if (dishId) {
      where.push('dr.dish_id = ?');
      params.push(Number(dishId));
    }
    
    if (restaurantId) {
      where.push('dr.restaurant_id = ?');
      params.push(Number(restaurantId));
    }
    
    if (municipalityId) {
      where.push('r.municipality_id = ?');
      params.push(Number(municipalityId));
    }

    const query = `
      SELECT 
        dr.dish_id,
        dr.restaurant_id,
        dr.is_featured,
        dr.featured_rank,
        dr.restaurant_specific_description,
        dr.restaurant_specific_price,
        dr.availability,
        dr.created_at,
        dr.updated_at,
        d.name as dish_name,
        d.category as dish_category,
        d.image_url as dish_image_url,
        r.name as restaurant_name,
        r.address as restaurant_address,
        m.name as municipality_name
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      JOIN restaurants r ON dr.restaurant_id = r.id
      JOIN municipalities m ON r.municipality_id = m.id
      WHERE ${where.join(' AND ')}
      ORDER BY r.name, d.name
      LIMIT ?
    `;
    
    params.push(Number(limit));
    
    const [links] = await pool.query(query, params);
    console.log(`✅ Found ${links.length} restaurant-dish links`);
    
    res.json(links);
  } catch (error) {
    console.error('❌ Error fetching restaurant-dish links:', error);
    res.status(500).json({ 
      error: 'Failed to fetch restaurant-dish links',
      details: error.message 
    });
  }
});

// GET /api/restaurant-dish-links/dish/:dishId - Get all restaurants for a dish
app.get('/api/restaurant-dish-links/dish/:dishId', async (req, res) => {
  try {
    const dishId = req.params.dishId;
    
    const query = `
      SELECT 
        r.id as restaurant_id,
        r.name as restaurant_name,
        r.address,
        r.phone,
        r.website,
        m.name as municipality_name,
        dr.is_featured,
        dr.featured_rank,
        dr.restaurant_specific_description,
        dr.restaurant_specific_price,
        dr.availability,
        dr.created_at
      FROM dish_restaurants dr
      JOIN restaurants r ON dr.restaurant_id = r.id
      JOIN municipalities m ON r.municipality_id = m.id
      WHERE dr.dish_id = ?
      ORDER BY r.name
    `;
    
    const [restaurants] = await pool.query(query, [dishId]);
    console.log(`✅ Found ${restaurants.length} restaurants for dish ${dishId}`);
    
    res.json(restaurants);
  } catch (error) {
    console.error('❌ Error fetching restaurants for dish:', error);
    res.status(500).json({ 
      error: 'Failed to fetch restaurants for dish',
      details: error.message 
    });
  }
});

// GET /api/restaurant-dish-links/restaurant/:restaurantId - Get all dishes for a restaurant
app.get('/api/restaurant-dish-links/restaurant/:restaurantId', async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId;
    
    const query = `
      SELECT 
        d.id as dish_id,
        d.name as dish_name,
        d.description,
        d.category,
        d.image_url,
        d.rating,
        d.popularity,
        m.name as municipality_name,
        dr.is_featured,
        dr.featured_rank,
        dr.restaurant_specific_description,
        dr.restaurant_specific_price,
        dr.availability,
        dr.created_at
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      JOIN municipalities m ON d.municipality_id = m.id
      WHERE dr.restaurant_id = ?
      ORDER BY dr.is_featured DESC, dr.featured_rank ASC, d.name ASC
    `;
    
    const [dishes] = await pool.query(query, [restaurantId]);
    console.log(`✅ Found ${dishes.length} dishes for restaurant ${restaurantId}`);
    
    res.json(dishes);
  } catch (error) {
    console.error('❌ Error fetching dishes for restaurant:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dishes for restaurant',
      details: error.message 
    });
  }
});

// GET /api/restaurant-dish-links/municipality/:municipalityId - Get all links in a municipality
app.get('/api/restaurant-dish-links/municipality/:municipalityId', async (req, res) => {
  try {
    const municipalityId = req.params.municipalityId;
    
    const query = `
      SELECT 
        dr.dish_id,
        dr.restaurant_id,
        d.name as dish_name,
        r.name as restaurant_name,
        dr.is_featured,
        dr.featured_rank,
        dr.availability,
        dr.created_at
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      JOIN restaurants r ON dr.restaurant_id = r.id
      WHERE r.municipality_id = ? OR d.municipality_id = ?
      ORDER BY r.name, d.name
    `;
    
    const [links] = await pool.query(query, [municipalityId, municipalityId]);
    console.log(`✅ Found ${links.length} links in municipality ${municipalityId}`);
    
    res.json(links);
  } catch (error) {
    console.error('❌ Error fetching links for municipality:', error);
    res.status(500).json({ 
      error: 'Failed to fetch links for municipality',
      details: error.message 
    });
  }
});

// POST /api/restaurant-dish-links/bulk-link - Bulk link dishes to restaurants
app.post('/api/restaurant-dish-links/bulk-link', async (req, res) => {
  try {
    const { dish_ids, restaurant_ids } = req.body;
    
    if (!dish_ids || !restaurant_ids || !Array.isArray(dish_ids) || !Array.isArray(restaurant_ids)) {
      return res.status(400).json({ 
        error: 'dish_ids and restaurant_ids arrays are required' 
      });
    }
    
    if (dish_ids.length === 0 || restaurant_ids.length === 0) {
      return res.status(400).json({ 
        error: 'Both dish_ids and restaurant_ids must contain at least one ID' 
      });
    }

    console.log(`🔄 Bulk linking ${dish_ids.length} dishes to ${restaurant_ids.length} restaurants`);
    
    // Check for existing links to avoid duplicates
    const placeholders = dish_ids.map(() => '?').join(',');
    const restaurantPlaceholders = restaurant_ids.map(() => '?').join(',');
    
    const [existingLinks] = await pool.query(`
      SELECT dish_id, restaurant_id 
      FROM dish_restaurants 
      WHERE dish_id IN (${placeholders}) AND restaurant_id IN (${restaurantPlaceholders})
    `, [...dish_ids, ...restaurant_ids]);
    
    const existingSet = new Set(
      existingLinks.map(link => `${link.dish_id}-${link.restaurant_id}`)
    );
    
    // Prepare new links (skip existing ones)
    const newLinks = [];
    for (const dishId of dish_ids) {
      for (const restaurantId of restaurant_ids) {
        const key = `${dishId}-${restaurantId}`;
        if (!existingSet.has(key)) {
          newLinks.push([dishId, restaurantId, 0, null, null, null, 'regular']);
        }
      }
    }
    
    if (newLinks.length === 0) {
      return res.json({ 
        success: true, 
        message: 'All links already exist', 
        created: 0,
        skipped: dish_ids.length * restaurant_ids.length
      });
    }
    
    // Insert new links
    const valuesPlaceholders = newLinks.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
    const flatValues = newLinks.flat();
    
    await pool.query(`
      INSERT INTO dish_restaurants 
      (dish_id, restaurant_id, is_featured, featured_rank, restaurant_specific_description, restaurant_specific_price, availability)
      VALUES ${valuesPlaceholders}
    `, flatValues);
    
    console.log(`✅ Created ${newLinks.length} new dish-restaurant links`);
    
    res.json({
      success: true,
      message: `Successfully created ${newLinks.length} links`,
      created: newLinks.length,
      skipped: (dish_ids.length * restaurant_ids.length) - newLinks.length,
      total_attempted: dish_ids.length * restaurant_ids.length
    });
    
  } catch (error) {
    console.error('❌ Error in bulk linking:', error);
    res.status(500).json({ 
      error: 'Failed to create bulk links',
      details: error.message 
    });
  }
});

// POST /api/restaurant-dish-links/bulk-unlink - Bulk unlink dishes from restaurants
app.post('/api/restaurant-dish-links/bulk-unlink', async (req, res) => {
  try {
    const { dish_ids, restaurant_ids } = req.body;
    
    if (!dish_ids || !restaurant_ids || !Array.isArray(dish_ids) || !Array.isArray(restaurant_ids)) {
      return res.status(400).json({ 
        error: 'dish_ids and restaurant_ids arrays are required' 
      });
    }
    
    if (dish_ids.length === 0 || restaurant_ids.length === 0) {
      return res.status(400).json({ 
        error: 'Both dish_ids and restaurant_ids must contain at least one ID' 
      });
    }

    console.log(`🔄 Bulk unlinking ${dish_ids.length} dishes from ${restaurant_ids.length} restaurants`);
    
    const dishPlaceholders = dish_ids.map(() => '?').join(',');
    const restaurantPlaceholders = restaurant_ids.map(() => '?').join(',');
    
    const [result] = await pool.query(`
      DELETE FROM dish_restaurants 
      WHERE dish_id IN (${dishPlaceholders}) AND restaurant_id IN (${restaurantPlaceholders})
    `, [...dish_ids, ...restaurant_ids]);
    
    console.log(`✅ Removed ${result.affectedRows} dish-restaurant links`);
    
    res.json({
      success: true,
      message: `Successfully removed ${result.affectedRows} links`,
      removed: result.affectedRows
    });
    
  } catch (error) {
    console.error('❌ Error in bulk unlinking:', error);
    res.status(500).json({ 
      error: 'Failed to remove bulk links',
      details: error.message 
    });
  }
});

// GET /api/restaurant-dish-links/stats - Get statistics about links
app.get('/api/restaurant-dish-links/stats', async (req, res) => {
  try {
    // Total links count
    const [[{ total_links }]] = await pool.query(`
      SELECT COUNT(*) as total_links FROM dish_restaurants
    `);
    
    // Most linked dishes
    const [mostLinkedDishes] = await pool.query(`
      SELECT 
        d.id,
        d.name,
        d.category,
        d.image_url,
        COUNT(dr.dish_id) as link_count
      FROM dishes d
      JOIN dish_restaurants dr ON d.id = dr.dish_id
      GROUP BY d.id, d.name, d.category, d.image_url
      ORDER BY link_count DESC
      LIMIT 10
    `);
    
    // Restaurants with most dishes
    const [restaurantsWithMostDishes] = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.address,
        m.name as municipality_name,
        COUNT(dr.restaurant_id) as dish_count
      FROM restaurants r
      JOIN dish_restaurants dr ON r.id = dr.restaurant_id
      JOIN municipalities m ON r.municipality_id = m.id
      GROUP BY r.id, r.name, r.address, m.name
      ORDER BY dish_count DESC
      LIMIT 10
    `);
    
    // Featured dishes count
    const [[{ featured_count }]] = await pool.query(`
      SELECT COUNT(*) as featured_count 
      FROM dish_restaurants 
      WHERE is_featured = 1
    `);
    
    // Links per municipality
    const [linksPerMunicipality] = await pool.query(`
      SELECT 
        m.id,
        m.name,
        COUNT(dr.dish_id) as link_count
      FROM municipalities m
      LEFT JOIN restaurants r ON m.id = r.municipality_id
      LEFT JOIN dish_restaurants dr ON r.id = dr.restaurant_id
      GROUP BY m.id, m.name
      ORDER BY link_count DESC
    `);
    
    res.json({
      total_links,
      featured_count,
      most_linked_dishes: mostLinkedDishes,
      restaurants_with_most_dishes: restaurantsWithMostDishes,
      links_per_municipality: linksPerMunicipality
    });
    
  } catch (error) {
    console.error('❌ Error fetching link stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch link statistics',
      details: error.message 
    });
  }
});

// ADMIN VERSIONS (same endpoints but under /admin)
app.get('/admin/restaurant-dish-links', async (req, res) => {
  // Use the same implementation as the public version
  // This allows admin to access the same data
  try {
    const { dishId, restaurantId, municipalityId, limit = 1000 } = req.query;
    
    let where = ['1=1'];
    const params = [];

    if (dishId) {
      where.push('dr.dish_id = ?');
      params.push(Number(dishId));
    }
    
    if (restaurantId) {
      where.push('dr.restaurant_id = ?');
      params.push(Number(restaurantId));
    }
    
    if (municipalityId) {
      where.push('r.municipality_id = ?');
      params.push(Number(municipalityId));
    }

    const query = `
      SELECT 
        dr.dish_id,
        dr.restaurant_id,
        dr.is_featured,
        dr.featured_rank,
        dr.restaurant_specific_description,
        dr.restaurant_specific_price,
        dr.availability,
        dr.created_at,
        dr.updated_at,
        d.name as dish_name,
        d.category as dish_category,
        d.image_url as dish_image_url,
        r.name as restaurant_name,
        r.address as restaurant_address,
        m.name as municipality_name
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      JOIN restaurants r ON dr.restaurant_id = r.id
      JOIN municipalities m ON r.municipality_id = m.id
      WHERE ${where.join(' AND ')}
      ORDER BY r.name, d.name
      LIMIT ?
    `;
    
    params.push(Number(limit));
    
    const [links] = await pool.query(query, params);
    console.log(`✅ Found ${links.length} restaurant-dish links`);
    
    res.json(links);
  } catch (error) {
    console.error('❌ Error fetching restaurant-dish links:', error);
    res.status(500).json({ 
      error: 'Failed to fetch restaurant-dish links',
      details: error.message 
    });
  }
});

// Add other admin versions similarly...
app.post('/admin/restaurant-dish-links/bulk-link', async (req, res) => {
  // Same implementation as public version
  // ... copy the bulk-link implementation here
});

app.post('/admin/restaurant-dish-links/bulk-unlink', async (req, res) => {
  // Same implementation as public version  
  // ... copy the bulk-unlink implementation here
});

app.get('/admin/restaurant-dish-links/stats', async (req, res) => {
  // Same implementation as public version
  // ... copy the stats implementation here
});

app.get('/admin/dishes-with-restaurants', async (req, res) => {
  try {
    const { municipalityId, limit = 500 } = req.query;
    
    let where = ['1=1'];
    const params = [];

    if (municipalityId) {
      where.push('d.municipality_id = ?');
      params.push(Number(municipalityId));
    }

    const query = `
      SELECT 
        d.id as dish_id,
        d.name as dish_name,
        d.description as dish_description,
        d.category,
        d.image_url as dish_image,
        m.name as municipality_name,
        COUNT(dr.restaurant_id) as restaurant_count,
        GROUP_CONCAT(
          DISTINCT CONCAT(
            r.id, '::', 
            r.name, '::',
            COALESCE(dr2.is_featured, 0), '::',
            COALESCE(dr2.featured_rank, 0)
          ) 
          SEPARATOR '||'
        ) as restaurants_data
      FROM dishes d
      JOIN municipalities m ON d.municipality_id = m.id
      LEFT JOIN dish_restaurants dr ON d.id = dr.dish_id
      LEFT JOIN restaurants r ON dr.restaurant_id = r.id
      LEFT JOIN dish_restaurants dr2 ON d.id = dr2.dish_id AND r.id = dr2.restaurant_id
      WHERE ${where.join(' AND ')}
      GROUP BY d.id, d.name, d.description, d.category, d.image_url, m.name
      ORDER BY restaurant_count DESC, d.name ASC
      LIMIT ?
    `;

    params.push(Number(limit));

    const [dishes] = await pool.query(query, params);

    // Parse the restaurants data
    const dishesWithRestaurants = dishes.map(dish => {
      const restaurants = [];
      if (dish.restaurants_data) {
        const restaurantEntries = dish.restaurants_data.split('||');
        restaurantEntries.forEach(entry => {
          const [id, name, is_featured, featured_rank] = entry.split('::');
          if (id && name) {
            restaurants.push({
              id: parseInt(id),
              name,
              is_featured: parseInt(is_featured),
              featured_rank: parseInt(featured_rank)
            });
          }
        });
      }

      return {
        ...dish,
        restaurants,
        restaurants_data: undefined // Remove the raw data
      };
    });

    console.log(`✅ Found ${dishesWithRestaurants.length} dishes with restaurant data`);
    res.json(dishesWithRestaurants);

  } catch (error) {
    console.error('❌ Error fetching dishes with restaurants:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dishes with restaurants',
      details: error.message 
    });
  }
});

app.get('/admin/restaurants-with-dishes', async (req, res) => {
  try {
    const { municipalityId, limit = 500 } = req.query;
    
    let where = ['1=1'];
    const params = [];

    if (municipalityId) {
      where.push('r.municipality_id = ?');
      params.push(Number(municipalityId));
    }

    const query = `
      SELECT 
        r.id as restaurant_id,
        r.name as restaurant_name,
        r.address,
        r.phone,
        r.website,
        m.name as municipality_name,
        COUNT(dr.dish_id) as dish_count,
        GROUP_CONCAT(
          DISTINCT CONCAT(
            d.id, '::', 
            d.name, '::',
            d.category, '::',
            COALESCE(dr2.is_featured, 0), '::',
            COALESCE(dr2.featured_rank, 0)
          ) 
          SEPARATOR '||'
        ) as dishes_data
      FROM restaurants r
      JOIN municipalities m ON r.municipality_id = m.id
      LEFT JOIN dish_restaurants dr ON r.id = dr.restaurant_id
      LEFT JOIN dishes d ON dr.dish_id = d.id
      LEFT JOIN dish_restaurants dr2 ON r.id = dr2.restaurant_id AND d.id = dr2.dish_id
      WHERE ${where.join(' AND ')}
      GROUP BY r.id, r.name, r.address, r.phone, r.website, m.name
      ORDER BY dish_count DESC, r.name ASC
      LIMIT ?
    `;

    params.push(Number(limit));

    const [restaurants] = await pool.query(query, params);

    // Parse the dishes data
    const restaurantsWithDishes = restaurants.map(restaurant => {
      const dishes = [];
      if (restaurant.dishes_data) {
        const dishEntries = restaurant.dishes_data.split('||');
        dishEntries.forEach(entry => {
          const [id, name, category, is_featured, featured_rank] = entry.split('::');
          if (id && name) {
            dishes.push({
              id: parseInt(id),
              name,
              category,
              is_featured: parseInt(is_featured),
              featured_rank: parseInt(featured_rank)
            });
          }
        });
      }

      return {
        ...restaurant,
        dishes,
        dishes_data: undefined // Remove the raw data
      };
    });

    console.log(`✅ Found ${restaurantsWithDishes.length} restaurants with dish data`);
    res.json(restaurantsWithDishes);

  } catch (error) {
    console.error('❌ Error fetching restaurants with dishes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch restaurants with dishes',
      details: error.message 
    });
  }
});

// GET /admin/unlinking-data - Get comprehensive data for unlinking interface
app.get('/admin/unlinking-data', async (req, res) => {
  try {
    const { municipalityId } = req.query;
    
    // Get dishes with restaurants
    const dishesPromise = pool.query(`
      SELECT 
        d.id, d.name, d.category, d.image_url,
        m.name as municipality_name,
        COUNT(dr.restaurant_id) as linked_restaurants_count
      FROM dishes d
      JOIN municipalities m ON d.municipality_id = m.id
      LEFT JOIN dish_restaurants dr ON d.id = dr.dish_id
      ${municipalityId ? 'WHERE d.municipality_id = ?' : ''}
      GROUP BY d.id, d.name, d.category, d.image_url, m.name
      ORDER BY linked_restaurants_count DESC, d.name ASC
      LIMIT 1000
    `, municipalityId ? [Number(municipalityId)] : []);

    // Get restaurants with dishes
    const restaurantsPromise = pool.query(`
      SELECT 
        r.id, r.name, r.address, r.municipality_id,
        m.name as municipality_name,
        COUNT(dr.dish_id) as linked_dishes_count
      FROM restaurants r
      JOIN municipalities m ON r.municipality_id = m.id
      LEFT JOIN dish_restaurants dr ON r.id = dr.restaurant_id
      ${municipalityId ? 'WHERE r.municipality_id = ?' : ''}
      GROUP BY r.id, r.name, r.address, r.municipality_id, m.name
      ORDER BY linked_dishes_count DESC, r.name ASC
      LIMIT 1000
    `, municipalityId ? [Number(municipalityId)] : []);

    // Get recent links
    const recentLinksPromise = pool.query(`
      SELECT 
        dr.dish_id,
        dr.restaurant_id,
        d.name as dish_name,
        r.name as restaurant_name,
        m1.name as dish_municipality,
        m2.name as restaurant_municipality,
        dr.created_at
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      JOIN restaurants r ON dr.restaurant_id = r.id
      JOIN municipalities m1 ON d.municipality_id = m1.id
      JOIN municipalities m2 ON r.municipality_id = m2.id
      ORDER BY dr.created_at DESC
      LIMIT 50
    `);

    const [[dishes], [restaurants], [recentLinks]] = await Promise.all([
      dishesPromise,
      restaurantsPromise,
      recentLinksPromise
    ]);

    res.json({
      dishes,
      restaurants,
      recentLinks,
      summary: {
        totalDishes: dishes.length,
        totalRestaurants: restaurants.length,
        totalLinks: recentLinks.length // This is just recent ones, but gives an idea
      }
    });

  } catch (error) {
    console.error('❌ Error fetching unlinking data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unlinking data',
      details: error.message 
    });
  }
});

app.post('/admin/unlink-dish', async (req, res) => {
  try {
    const { dishId, restaurantIds } = req.body;

    if (!dishId) {
      return res.status(400).json({ error: 'dishId is required' });
    }

    if (!restaurantIds || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
      return res.status(400).json({ error: 'restaurantIds array is required' });
    }

    const placeholders = restaurantIds.map(() => '?').join(',');
    const query = `
      DELETE FROM dish_restaurants 
      WHERE dish_id = ? 
      AND restaurant_id IN (${placeholders})
    `;

    const values = [dishId, ...restaurantIds];
    const [result] = await pool.query(query, values);

    res.json({
      success: true,
      message: `Successfully unlinked dish ${dishId} from ${result.affectedRows} restaurant(s)`,
      unlinkedCount: result.affectedRows,
      dishId,
      restaurantIds
    });

  } catch (error) {
    console.error('❌ Error unlinking dish:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink dish',
      details: error.message
    });
  }
});

// POST /admin/unlink-restaurant - Unlink a restaurant from one or more dishes
app.post('/admin/unlink-restaurant', async (req, res) => {
  try {
    const { restaurantId, dishIds } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId is required' });
    }

    if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
      return res.status(400).json({ error: 'dishIds array is required' });
    }

    const placeholders = dishIds.map(() => '?').join(',');
    const query = `
      DELETE FROM dish_restaurants 
      WHERE restaurant_id = ? 
      AND dish_id IN (${placeholders})
    `;

    const values = [restaurantId, ...dishIds];
    const [result] = await pool.query(query, values);

    res.json({
      success: true,
      message: `Successfully unlinked restaurant ${restaurantId} from ${result.affectedRows} dish(es)`,
      unlinkedCount: result.affectedRows,
      restaurantId,
      dishIds
    });

  } catch (error) {
    console.error('❌ Error unlinking restaurant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink restaurant',
      details: error.message
    });
  }
});

// DELETE /admin/remove-all-dish-links/:dishId - Remove all links for a dish
app.delete('/admin/remove-all-dish-links/:dishId', async (req, res) => {
  try {
    const dishId = req.params.dishId;

    const [result] = await pool.query(
      'DELETE FROM dish_restaurants WHERE dish_id = ?',
      [dishId]
    );

    res.json({
      success: true,
      message: `Removed all ${result.affectedRows} restaurant links for dish ${dishId}`,
      removedCount: result.affectedRows,
      dishId
    });

  } catch (error) {
    console.error('❌ Error removing all dish links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove dish links',
      details: error.message
    });
  }
});

app.delete('/admin/remove-all-restaurant-links/:restaurantId', async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId;

    const [result] = await pool.query(
      'DELETE FROM dish_restaurants WHERE restaurant_id = ?',
      [restaurantId]
    );

    res.json({
      success: true,
      message: `Removed all ${result.affectedRows} dish links for restaurant ${restaurantId}`,
      removedCount: result.affectedRows,
      restaurantId
    });

  } catch (error) {
    console.error('❌ Error removing all restaurant links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove restaurant links',
      details: error.message
    });
  }
});



app.get('/admin/test-unlinking', async (req, res) => {
  try {
    // Test data fetch
    const [dishes] = await pool.query(`
      SELECT id, name, category 
      FROM dishes 
      ORDER BY name 
      LIMIT 10
    `);

    const [restaurants] = await pool.query(`
      SELECT id, name, address 
      FROM restaurants 
      ORDER BY name 
      LIMIT 10
    `);

    const [links] = await pool.query(`
      SELECT 
        dr.dish_id,
        dr.restaurant_id,
        d.name as dish_name,
        r.name as restaurant_name
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      JOIN restaurants r ON dr.restaurant_id = r.id
      ORDER BY dr.created_at DESC
      LIMIT 5
    `);

    res.json({

      success: true,
      message: 'Unlinking test data fetched successfully',
      data: {
        sampleDishes: dishes,
        sampleRestaurants: restaurants,
        sampleLinks: links
      }
    });

  } catch (error) {
    console.error('❌ Error in unlinking test:', error);
    res.status(500).json({
      success: false,
      error: 'Unlinking test failed',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`🚀 Unified API running at http://localhost:${PORT}`));
