import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import initReviewsRoutes from './routes/reviews.js';
import dishesRouter from './routes/dishes.js';
import adminRouter from './routes/admin.js';
import restaurantsRouter from './routes/restaurants.js';
import topRatedRouter from './routes/top-rated.js';
import initRestaurantViewsRoutes from './routes/restaurant-views.js';
import { adminAuthRequired } from './middleware/adminAuth.js';

const app = express();
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
  if (!origin) return true; 
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
  credentials: true, 
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.set('trust proxy', 1);
app.get('/admin/dish-recommendation-check', async (req, res) => {
  try {
    const [rankedDishes] = await pool.query(`
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
    const [recommendedDishes] = await pool.query(`
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
      const [mismatches] = await pool.query(`
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

    // Log detailed results
    console.log('\n[dish-check] Dishes with panel_rank=1:', rankedDishes);
    console.log('\n[dish-check] Municipalities with recommended dishes:', recommendedDishes);
    console.log('\n[dish-check] Mismatches found:', mismatches);    res.json({
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
    res.status(500).json({ error: 'Failed to check recommendations', details: error.message });
  }
});

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
// Increment dish popularity (view/click)
app.post('/api/dishes/:id/view', async (req, res) => {
  try {
    const dishId = Number(req.params.id);
    if (!Number.isFinite(dishId)) return res.status(400).json({ error: 'Invalid dish id' });
    await pool.query('UPDATE dishes SET popularity = COALESCE(popularity, 0) + 1 WHERE id = ?', [dishId]);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to increment dish popularity:', e);
    res.status(500).json({ error: 'Failed to increment dish popularity' });
  }
});

// Increment restaurant popularity (view/click)
app.post('/api/restaurants/:id/view', async (req, res) => {
  try {
    const restId = Number(req.params.id);
    if (!Number.isFinite(restId)) return res.status(400).json({ error: 'Invalid restaurant id' });
    await pool.query('UPDATE restaurants SET popularity = COALESCE(popularity, 0) + 1 WHERE id = ?', [restId]);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to increment restaurant popularity:', e);
    res.status(500).json({ error: 'Failed to increment restaurant popularity' });
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
  
  // Check URL path to determine which type of token to expect
  const isAdminRoute = req.path.startsWith('/admin/');
  
  try {
    if (isAdminRoute) {
      // Admin routes require admin token
      req.user = jwt.verify(token, ADMIN_JWT_SECRET);
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'forbidden', message: 'Admin access required' });
      }
    } else {
      // Regular routes require user token
      req.user = jwt.verify(token, JWT_SECRET);
      // Optionally reject admin tokens for regular user routes if needed
      if (req.user.role === 'admin' || req.user.role === 'owner') {
        // Allow admin users to access regular routes too, or return error if you prefer:
        // return res.status(403).json({ error: 'forbidden', message: 'Please use regular user account for this feature' });
      }
    }
    return next();
  } catch (error) {
    console.error('Token verification failed:', error);
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

// Initialize MySQL connection pool
const pool = mysql.createPool(cfg);
console.log('🔄 Created MySQL connection pool');

// Initialize schema tracking
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
  try {
    // Verify database connection first
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log('✅ Connected to DB:', db);

    // Load schema info
    await loadSchemaInfo();

    // Initialize routes that require database access
    app.use('/api', adminRouter);
    app.use('/admin', adminAuthRequired);
    app.use(restaurantsRouter);
    app.use(topRatedRouter);
    
    // Initialize restaurant views routes with error handling
    const restaurantViewsRouter = initRestaurantViewsRoutes(pool);
    app.use((req, res, next) => {
      if (req.path.includes('/municipalities') && req.path.includes('/top-restaurants')) {
        console.log('🔄 Processing top restaurants request:', req.method, req.path);
      }
      next();
    });
    app.use(restaurantViewsRouter);

    console.log('✅ All routes initialized');
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1);
  }

  // Continue with database connection verification
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

  // Add connection error handler
  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.');
    }
  });

  // Mount review routes after pool is initialized
  const reviewRouter = initReviewsRoutes(pool);
  app.use(reviewRouter);
  
  console.log('✅ Review routes initialized');

  // Mount dishes router after pool is initialized
  app.use(dishesRouter);
  console.log('✅ Dishes routes initialized');


  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
      console.log('Closed out remaining connections');
      process.exit(0);
    });
  });
})().catch(e => {
  console.error('❌ DB init error:', e);
  process.exit(1);
});

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

    // Use different secrets for admin and regular users
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    const tokenSecret = isAdmin ? ADMIN_JWT_SECRET : JWT_SECRET;
    
    const token = jwt.sign({ 
      uid: user.id, 
      email: user.email, 
      displayName: user.display_name,
      role: user.role || 'user'
    }, tokenSecret, { expiresIn: '7d' });
    
    // issue a refresh token as httpOnly cookie for optional cookie-based session
    try {
      const refresh = jwt.sign({ uid: user.id }, tokenSecret, { expiresIn: '30d' });
      res.cookie('refresh_token', refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    } catch (e) { console.error('Failed to set refresh cookie', e); }
    
    // For admin users, send both tokens
    if (isAdmin) {
      return res.json({ 
        ok: true, 
        token: token, // This will be used as admin token
        userToken: jwt.sign({ ...user, role: 'user' }, JWT_SECRET, { expiresIn: '7d' }), // Regular user token
        user: { id: user.id, email: user.email, name: user.display_name, role: user.role || 'user' }
      });
    }

    return res.json({ 
      ok: true, 
      token, 
      user: { id: user.id, email: user.email, name: user.display_name, role: user.role || 'user' } 
    });
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


app.get('/api/auth/me', authRequired, (req, res) => {
  console.log('[/api/auth/me] User from token:', req.user);
  // Check if this was an admin token
  const isAdminToken = req.user.role === 'admin' || req.user.role === 'owner';
  
  res.json({ 
    user: { 
      id: req.user.uid, 
      email: req.user.email, 
      name: req.user.displayName || (isAdminToken ? 'Administrator' : req.user.email),
      role: req.user.role || 'user'
    } 
  });
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
// Regular user logout
app.post('/api/auth/logout', (req, res) => {
  try {
    // Clear all auth-related cookies with different paths
    res.cookie('refresh_token', '', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      path: '/api', 
      maxAge: 0 
    });
    res.cookie('refresh_token', '', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      path: '/', 
      maxAge: 0 
    });
    // Set a temporary logout flag to prevent auto-login
    res.cookie('logging_out', '1', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      maxAge: 2000 // 2 seconds
    });
  } catch (e) {
    console.error('Error clearing cookies:', e);
  }
  res.json({ ok: true });
});

// Admin logout endpoint
app.post('/api/auth/admin/logout', (req, res) => {
  try {
    // Clear all auth-related cookies with different paths
    res.cookie('refresh_token', '', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      path: '/api', 
      maxAge: 0 
    });
    res.cookie('refresh_token', '', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      path: '/', 
      maxAge: 0 
    });
    // Set a temporary logout flag to prevent auto-login
    res.cookie('logging_out', '1', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      maxAge: 2000 // 2 seconds
    });
  } catch (e) {
    console.error('Error clearing cookies:', e);
  }
  res.json({ ok: true });
});

app.get('/api/health', async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT 1 AS ok');

    // Also check municipalities table
    const [municipalities] = await pool.query('SELECT id, name FROM municipalities ORDER BY id LIMIT 5');
    
    res.json({ 
      ok: row.ok === 1, 
      db: cfg.database,
      dbCheck: {
        hasMunicipalities: municipalities.length > 0,
        firstFewMunicipalities: municipalities
      }
    });
  } catch (e) {
    console.error('Health check error:', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Debug endpoint to check dish data
app.get('/api/debug/dish/:id', async (req, res) => {
  try {
    const dishId = Number(req.params.id);
    const [[dish]] = await pool.query(`
      SELECT d.*, m.name as municipality_name, m.recommended_dish_id
      FROM dishes d 
      JOIN municipalities m ON d.municipality_id = m.id
      WHERE d.id = ?
    `, [dishId]);

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    // Check if this dish is recommended for its municipality
    const isRecommended = dish.recommended_dish_id === dish.id;
    
    // Check if any other dish is recommended for this municipality
    const [[otherRecommended]] = await pool.query(`
      SELECT d.id, d.name, d.panel_rank
      FROM dishes d
      WHERE d.municipality_id = ? AND d.panel_rank = 1 AND d.id != ?
    `, [dish.municipality_id, dish.id]);

    res.json({
      dish,
      isRecommended,
      otherRecommendedDish: otherRecommended || null,
      summary: {
        id: dish.id,
        name: dish.name,
        municipality: dish.municipality_name,
        panel_rank: dish.panel_rank,
        isRecommendedForMunicipality: isRecommended
      }
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Debug route to check all municipalities and their recommended dishes
app.get('/api/debug/municipalities', async (_req, res) => {
  try {
    const [municipalities] = await pool.query(`
      SELECT 
        m.id, 
        m.name, 
        m.recommended_dish_id,
        d.name as dish_name,
        d.panel_rank,
        d.municipality_id as dish_municipality_id
      FROM municipalities m
      LEFT JOIN dishes d ON m.recommended_dish_id = d.id
      ORDER BY m.id
    `);

    const [dishes] = await pool.query(`
      SELECT 
        id,
        name,
        municipality_id,
        panel_rank
      FROM dishes 
      WHERE panel_rank = 1
      ORDER BY municipality_id
    `);

    res.json({
      municipalities,
      dishesWithPanelRank1: dishes
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
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

// Debug endpoint to check dish data
app.get('/api/debug/dish/:id', async (req, res) => {
  try {
    console.log(`[debug-dish] Checking dish ID ${req.params.id}`);
    const dishId = Number(req.params.id);
    
    // Get dish and its municipality info
    const [[dish]] = await pool.query(`
      SELECT d.*, m.name as municipality_name, m.recommended_dish_id
      FROM dishes d 
      JOIN municipalities m ON d.municipality_id = m.id
      WHERE d.id = ?
    `, [dishId]);

    if (!dish) {
      console.log(`[debug-dish] Dish ${dishId} not found`);
      return res.status(404).json({ error: 'Dish not found' });
    }

    console.log(`[debug-dish] Found dish:`, dish);

    // Get municipality's current recommended dish
    const [[muni]] = await pool.query(`
      SELECT m.*, d.name as current_recommended_dish_name, d.panel_rank as current_recommended_dish_rank
      FROM municipalities m
      LEFT JOIN dishes d ON m.recommended_dish_id = d.id
      WHERE m.id = ?
    `, [dish.municipality_id]);

    // Get all dishes with panel_rank = 1 for this municipality
    const [rankedDishes] = await pool.query(`
      SELECT id, name, panel_rank
      FROM dishes
      WHERE municipality_id = ? AND panel_rank = 1
      ORDER BY id
    `, [dish.municipality_id]);

    res.json({
      dish: {
        id: dish.id,
        name: dish.name,
        municipality_id: dish.municipality_id,
        municipality_name: dish.municipality_name,
        panel_rank: dish.panel_rank,
      },
      municipality: {
        id: muni.id,
        name: muni.name,
        recommended_dish_id: muni.recommended_dish_id,
        recommended_dish_name: muni.current_recommended_dish_name,
        recommended_dish_rank: muni.current_recommended_dish_rank
      },
      otherRankedDishes: rankedDishes,
      analysis: {
        isRecommended: dish.id === muni.recommended_dish_id,
        hasRank1: dish.panel_rank === 1,
        totalRank1Dishes: rankedDishes.length,
        needsSync: (dish.panel_rank === 1 && dish.id !== muni.recommended_dish_id) ||
                  (dish.panel_rank !== 1 && dish.id === muni.recommended_dish_id)
      }
    });
  } catch (e) {
    console.error('[debug-dish] Error:', e);
    res.status(500).json({ error: String(e?.message || e) });
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
// Admin: Set recommended dish for a municipality 
app.patch('/admin/municipalities/:id/recommend-dish', async (req, res) => {
  try {
    const osmRelationId = Number(req.params.id);
    const { dish_id } = req.body;
    if (!osmRelationId || !dish_id) {
      return res.status(400).json({ error: 'OSM relation ID and dish_id are required' });
    }

    // First get municipality by OSM ID
    const [[municipality]] = await pool.query(
      'SELECT id, name FROM municipalities WHERE osm_relation_id = ? LIMIT 1',
      [osmRelationId]
    );

    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' }); 
    }

    // Check if dish exists and belongs to this municipality
    const [dishRows] = await pool.query(
      'SELECT id FROM dishes WHERE id = ? AND municipality_id = ?',
      [dish_id, municipality.id]
    );

    if (dishRows.length === 0) {
      return res.status(404).json({ error: 'Dish not found in this municipality' });
    }

    await pool.query(
      'UPDATE municipalities SET recommended_dish_id = ? WHERE id = ?',
      [dish_id, municipality.id]
    );

    res.json({ 
      success: true, 
      municipalityId: municipality.id,
      osmRelationId,
      recommended_dish_id: dish_id 
    });
  } catch (error) {
    console.error('Error setting recommended dish:', error);
    res.status(500).json({ error: 'Failed to set recommended dish', details: error.message });
  }
});
// Public: Get recommended and top-rated dish for a municipality
app.get('/api/municipalities/:id/dishes-summary', async (req, res) => {
  try {
    console.log('\n[dishes-summary] Starting request for municipality dishes summary');
    console.log('[dishes-summary] Request params:', req.params);
    console.log('[dishes-summary] Raw ID:', req.params.id);

    const osmRelationId = Number(req.params.id);
    console.log('[dishes-summary] Parsed OSM relation ID:', osmRelationId);
    
    if (!osmRelationId || !Number.isFinite(osmRelationId)) {
      console.log('[dishes-summary] Invalid OSM relation ID');
      return res.status(400).json({ error: 'municipalityId is required and must be a number' });
    }

    // First verify municipality exists with simpler query
    // Try both internal ID and OSM relation ID
    const [[municipalityCheck]] = await pool.query(
      'SELECT id, name, osm_relation_id FROM municipalities WHERE id = ? OR osm_relation_id = ? LIMIT 1',
      [osmRelationId, osmRelationId]
    );

    if (!municipalityCheck) {
      console.log(`[dishes-summary] Municipality with ID/OSM ID ${osmRelationId} not found in simple check`);
      return res.status(404).json({ error: 'Municipality not found' });
    }

    console.log(`[dishes-summary] Found municipality in simple check:`, municipalityCheck);
    
    // Now get full data with joins
    const [muniRows] = await pool.query(`
      SELECT m.*, 
             d.id as dish_id, 
             d.name as dish_name, 
             d.panel_rank,
             d.municipality_id as dish_municipality_id
      FROM municipalities m
      LEFT JOIN dishes d ON m.recommended_dish_id = d.id
      WHERE m.id = ? OR m.osm_relation_id = ?`, 
      [osmRelationId, osmRelationId]
    );

    console.log('[dishes-summary] Municipality full data:', JSON.stringify(muniRows, null, 2));
    
    // If no municipality found
    if (!muniRows.length) {
      console.log(`[dishes-summary] Municipality with OSM ID ${osmRelationId} not found`);
      return res.status(404).json({ error: 'Municipality not found' });
    }

    const municipality = muniRows[0];
    console.log(`[dishes-summary] Found municipality: ${municipality.name} (ID: ${municipality.id})`);
    console.log(`[dishes-summary] Recommended dish ID: ${municipality.recommended_dish_id}`);
    
    let recommendedDish = null;
    
    // First try to get the recommended dish
    if (muniRows.length && muniRows[0].recommended_dish_id) {
      console.log(`[dishes-summary] Municipality with OSM ID ${osmRelationId} (${muniRows[0].name}) has recommended_dish_id: ${muniRows[0].recommended_dish_id}`);
      
      const [dishRows] = await pool.query(`
        SELECT d.*, m.name as municipality_name 
        FROM dishes d 
        JOIN municipalities m ON d.municipality_id = m.id 
        WHERE d.id = ?
      `, [muniRows[0].recommended_dish_id]);
      
      if (dishRows.length) {
        recommendedDish = dishRows[0];
        console.log(`[dishes-summary] Found recommended dish: ${recommendedDish.name} (panel_rank=${recommendedDish.panel_rank})`);
      } else {
        console.log(`[dishes-summary] Warning: recommended_dish_id ${muniRows[0].recommended_dish_id} not found in dishes table`);
      }
    }
    
    // If no recommended dish found, look for a dish with panel_rank = 1
    if (!recommendedDish) {
      const [rankedDishes] = await pool.query(`
        SELECT d.*, m.name as municipality_name 
        FROM dishes d 
        JOIN municipalities m ON d.municipality_id = m.id
        WHERE m.id = ? AND d.panel_rank = 1 
        ORDER BY d.avg_rating DESC, d.total_ratings DESC
        LIMIT 1`, [municipality.id]);
        
      if (rankedDishes.length) {
        recommendedDish = rankedDishes[0];
        console.log(`[dishes-summary] Using highest rated panel_rank=1 dish as recommended: ${recommendedDish.name}`);
      }
    }

    // Get top 3 rated dishes (by avg_rating, total_ratings, then name)
    const [topDishes] = await pool.query(`
      SELECT d.*, m.name as municipality_name,
             ROW_NUMBER() OVER (ORDER BY d.avg_rating DESC, d.total_ratings DESC, d.name ASC) as rank
      FROM dishes d 
      JOIN municipalities m ON d.municipality_id = m.id
      WHERE m.id = ?
      ORDER BY 
        COALESCE(d.panel_rank, 999), -- First priority to panel-ranked dishes
        d.avg_rating DESC, -- Then by rating
        d.total_ratings DESC, -- Then by number of ratings 
        d.popularity DESC, -- Then by popularity/views
        d.name ASC -- Finally alphabetically
      LIMIT 3 -- Always get at least 3 dishes
    `, [municipality.id]);
    
    const topRatedDishes = topDishes || [];
    if (topRatedDishes.length) {
      console.log(`[dishes-summary] Found ${topRatedDishes.length} top rated dishes`);
      topRatedDishes.forEach((dish, i) => {
        console.log(`[dishes-summary] #${i + 1}: ${dish.name} (rating=${dish.avg_rating}, total_ratings=${dish.total_ratings})`);
      });
    }

    res.json({ 
      recommendedDish, 
      topRatedDishes,
      summary: {
        totalRecommended: recommendedDish ? 1 : 0,
        totalTopRated: topRatedDishes.length
      }
    });
  } catch (error) {
    console.error('Error fetching dishes summary:', error);
    res.status(500).json({ error: 'Failed to fetch dishes summary', details: error.message });
  }
});

app.get('/api/dishes', async (req, res) => {
  try {
    const { municipalityId, q, limit = 500, category, sort = 'ranking' } = req.query;
    const where = []; const p = [];
    
    // Handle filters
    if (municipalityId) {
      const munId = Number(municipalityId);
      if (!Number.isFinite(munId)) {
        return res.status(400).json({ error: 'municipalityId must be a number' });
      }
      if (munId > 1000) { // It's an OSM relation ID
        // First verify the municipality exists
        const [[muni]] = await pool.query(
          'SELECT id, name FROM municipalities WHERE osm_relation_id = ? LIMIT 1',
          [munId]
        );
        if (!muni) {
          console.log(`[API] Municipality with OSM ID ${munId} not found`);
          return res.status(404).json({ error: 'Municipality not found' });
        }
        where.push('m.osm_relation_id = ?');
        p.push(munId);
      } else { // It's an internal municipality ID
        // Verify internal ID exists
        const [[muni]] = await pool.query(
          'SELECT id, name FROM municipalities WHERE id = ? LIMIT 1',
          [munId]
        );
        if (!muni) {
          console.log(`[API] Municipality with internal ID ${munId} not found`);
          return res.status(404).json({ error: 'Municipality not found' });
        }
        where.push('d.municipality_id = ?');
        p.push(munId);
      }
    }
    if (q) {
      where.push('(d.name LIKE ? OR d.description LIKE ?)');
      p.push(`%${String(q)}%`, `%${String(q)}%`);
    }
    if (category) {
      where.push('d.category = ?');
      p.push(String(category));
    }

    // Build ORDER BY clause based on sort parameter
    const sortKey = String(sort).toLowerCase();
    let orderClause = '';

    switch (sortKey) {
      case 'ranking':
        // Complex ranking based on multiple factors
        orderClause = `
          COALESCE(d.is_signature, 0) DESC,
          COALESCE(d.featured, 0) DESC,
          COALESCE(NULLIF(d.panel_rank, 0), 999),
          COALESCE(d.avg_rating, 0) DESC,
          COALESCE(d.total_ratings, 0) DESC,
          COALESCE(d.popularity, 0) DESC,
          d.name ASC
        `;
        break;
      case 'popularity':
        orderClause = 'COALESCE(d.popularity, 0) DESC, d.name ASC';
        break;
      case 'rating':
        orderClause = 'COALESCE(d.avg_rating, 0) DESC, COALESCE(d.total_ratings, 0) DESC, d.name ASC';
        break;
      case 'name':
        orderClause = 'd.name ASC';
        break;
      default:
        // Default to ranking
        orderClause = `
          COALESCE(d.is_signature, 0) DESC,
          COALESCE(d.featured, 0) DESC,
          COALESCE(NULLIF(d.panel_rank, 0), 999),
          COALESCE(d.avg_rating, 0) DESC,
          d.name ASC
        `;
    }

    const sql = `
      SELECT 
        d.id, 
        d.municipality_id,
        d.name,
        d.slug,
        d.description,
        d.image_url,
        d.category,
        COALESCE(d.is_signature, 0) as is_signature,
        d.panel_rank,
        COALESCE(d.featured, 0) as featured,
        d.featured_rank,
        COALESCE(d.popularity, 0) as popularity,
        COALESCE(d.rating, 0) as rating,
        COALESCE(d.avg_rating, 0) as avg_rating,
        COALESCE(d.total_ratings, 0) as total_ratings,
        d.flavor_profile,
        d.ingredients,
        m.name as municipality_name
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${orderClause}
      LIMIT ${Number(limit) || 500}
    `;

    console.log('[API] Executing dishes query:', {
      municipalityId,
      category,
      sort: sortKey,
      where,
      parameters: p
    });

    const [rows] = await pool.query(sql, p);

    // Format response to ensure boolean values
    const formattedRows = rows.map(row => ({
      ...row,
      is_signature: Boolean(row.is_signature),
      featured: Boolean(row.featured),
      featured_rank: row.featured_rank,
      flavor_profile: row.flavor_profile ? JSON.parse(row.flavor_profile) : [],
      ingredients: row.ingredients ? JSON.parse(row.ingredients) : []
    }));
    
    console.log(`[API] Found ${formattedRows.length} dishes for municipality ${municipalityId || 'all'}`);
    res.json(formattedRows);
  } catch (err) {
    console.error('[API] Error fetching dishes:', err);
    res.status(500).json({ error: 'Failed to fetch dishes', details: err.message });
  }
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
      if (id > 1000) {
        where.push('r.municipality_id IN (SELECT id FROM municipalities WHERE osm_relation_id = ?)');
      } else {
        where.push('r.municipality_id = ?');
      }
      params.push(id);
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
      params.push(featured ? 1 : 0);
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
        // params to append: lng, lat for select; lng, lat, radius (meters) for where
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

// Admin: list dishes (admin UI expects this at /admin/dishes)
app.get('/admin/dishes', async (req, res) => {
  try {
    const { municipality_id, municipalityId, q, limit = 500, category, category_id, sort = 'ranking' } = req.query;
    const muni = municipality_id ?? municipalityId;
    const cat = category ?? category_id;

    const where = [];
    const p = [];
    if (muni) { where.push('d.municipality_id = ?'); p.push(Number(muni)); }
    if (q) { where.push('(d.name LIKE ? OR d.description LIKE ?)'); p.push(`%${String(q)}%`, `%${String(q)}%`); }
    if (cat) { where.push('d.category = ?'); p.push(String(cat)); }

    const sortKey = String(sort || 'ranking').toLowerCase();
    let orderClause = 'COALESCE(d.is_signature, 0) DESC, COALESCE(d.featured, 0) DESC, COALESCE(NULLIF(d.panel_rank,0),999), COALESCE(d.avg_rating,0) DESC, COALESCE(d.total_ratings,0) DESC, COALESCE(d.popularity,0) DESC, d.name ASC';
    if (sortKey === 'rating') orderClause = 'COALESCE(d.avg_rating, 0) DESC, COALESCE(d.total_ratings, 0) DESC, d.name ASC';
    if (sortKey === 'popularity') orderClause = 'COALESCE(d.popularity, 0) DESC, d.name ASC';
    if (sortKey === 'name') orderClause = 'd.name ASC';

    const sql = `
      SELECT d.id, d.municipality_id, d.name, d.slug, d.description, d.image_url, d.category,
             COALESCE(d.is_signature,0) as is_signature, d.panel_rank, COALESCE(d.featured,0) as featured, d.featured_rank,
             COALESCE(d.popularity,0) as popularity, COALESCE(d.rating,0) as rating, COALESCE(d.avg_rating,0) as avg_rating, COALESCE(d.total_ratings,0) as total_ratings,
             d.flavor_profile, d.ingredients, m.name as municipality_name
      FROM dishes d
      LEFT JOIN municipalities m ON d.municipality_id = m.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${orderClause}
      LIMIT ${Number(limit) || 500}
    `;

    const [rows] = await pool.query(sql, p);
    const formatted = rows.map(r => ({
      ...r,
      is_signature: Boolean(r.is_signature),
      featured: Boolean(r.featured),
      flavor_profile: r.flavor_profile ? JSON.parse(r.flavor_profile) : [],
      ingredients: r.ingredients ? JSON.parse(r.ingredients) : []
    }));
    res.json(formatted);
  } catch (e) {
    console.error('ADMIN /admin/dishes error:', e);
    res.status(500).json({ error: 'Failed to fetch admin dishes', detail: String(e?.message || e) });
  }
});

// Admin: list restaurants (admin UI expects this at /admin/restaurants)
app.get('/admin/restaurants', async (req, res) => {
  try {
    const { municipality_id, municipalityId, q, kind, limit = 1000 } = req.query;
    const muni = municipality_id ?? municipalityId;

    const where = [];
    const params = [];
    if (muni) { where.push('r.municipality_id = ?'); params.push(Number(muni)); }
    if (kind) { where.push('r.kind = ?'); params.push(String(kind)); }
    if (q) { where.push('(r.name LIKE ? OR r.description LIKE ?)'); params.push(`%${String(q)}%`, `%${String(q)}%`); }

    const selectCols = [
      'r.id', 'r.name', 'r.slug', 'r.kind', 'r.description', 'r.address', 'r.phone', 'r.website',
      'r.facebook', 'r.instagram', 'r.opening_hours', 'r.price_range', "JSON_EXTRACT(r.cuisine_types, '$') AS cuisine_types",
      'r.rating', 'r.lat', 'r.lng', 'r.avg_rating', 'r.total_ratings'
    ];
    if (hasR('image_url')) selectCols.push('r.image_url');
    if (hasR('featured')) selectCols.push('r.featured');
    if (hasR('featured_rank')) selectCols.push('r.featured_rank');

    const sql = `SELECT ${selectCols.join(', ')} FROM restaurants r ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.avg_rating DESC, r.total_ratings DESC, r.name ASC LIMIT ${Number(limit) || 1000}`;
    const [rows] = await pool.query(sql, params);

    // Parse cuisine_types JSON if present
    const formatted = rows.map(r => ({
      ...r,
      cuisine_types: r.cuisine_types ? JSON.parse(r.cuisine_types) : [],
    }));
    res.json(formatted);
  } catch (e) {
    console.error('ADMIN /admin/restaurants error:', e);
    res.status(500).json({ error: 'Failed to fetch admin restaurants', detail: String(e?.message || e) });
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
app.post('/admin/variants', async (req, res) => {
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
app.put('/admin/variants/:id', async (req, res) => {
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
app.delete('/admin/variants/:id', async (req, res) => {
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

// Admin: create a restaurant
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


// Admin: create a dish
// Admin: update a dish
app.patch('/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });

    // Accept all updatable fields
    const allowed = [
      'name', 'slug', 'municipality_id', 'category', 'category_id', 'description', 'image_url',
      'flavor_profile', 'ingredients', 'is_signature', 'panel_rank', 'featured', 'featured_rank',
      'rating', 'popularity', 'history'
    ];
    const up = {};
    for (const k of allowed) {
      if (k in req.body) {
        if (k === 'flavor_profile' || k === 'ingredients') up[k] = jsonOrNull(parseMaybeJsonArray(req.body[k]));
        else if (k === 'is_signature' || k === 'featured') up[k] = req.body[k] ? 1 : 0;
        else up[k] = req.body[k];
      }
    }
    if ('name' in req.body && !('slug' in req.body)) up.slug = slugify(req.body.name);

    // Handle category/category_id
    if ('category' in req.body && !('category_id' in req.body)) {
      const [[catRow]] = await pool.query(
        'SELECT id FROM dish_categories WHERE code = ? OR display_name = ? LIMIT 1',
        [req.body.category, req.body.category]
      );
      if (catRow && catRow.id) {
        up.category_id = catRow.id;
      } else {
        return res.status(400).json({ error: 'Invalid category', details: `Category '${req.body.category}' does not exist.` });
      }
    } else if ('category_id' in req.body) {
      up.category_id = req.body.category_id;
    }

    const sets = Object.keys(up).map(k => `${k}=?`);
    const values = Object.keys(up).map(k => up[k]);
    if (!sets.length) return res.json({ ok: true, id });

    await pool.query(`UPDATE dishes SET ${sets.join(', ')} WHERE id=?`, [...values, id]);
    const [[row]] = await pool.query('SELECT * FROM dishes WHERE id = ? LIMIT 1', [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message || e) });
  }
});

// Admin: delete a dish
app.delete('/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });
    // Remove links to restaurants first
    await pool.query('DELETE FROM dish_restaurants WHERE dish_id=?', [id]);
    await pool.query('DELETE FROM dishes WHERE id=?', [id]);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete dish', detail: String(e?.message || e) });
  }
});

app.post('/admin/dishes', async (req, res) => {
  try {
    console.log('📝 CREATE DISH REQUEST BODY:', req.body);

    // Accept all fields, set defaults if missing
    const {
      name,
      slug,
      municipality_id,
      category,
      category_id,
      description = null,
      image_url = null,
      flavor_profile = null,
      ingredients = null,
      is_signature = false,
      panel_rank = null,
      featured = false,
      featured_rank = null,
      rating = null,
      popularity = null,
      history = null
    } = req.body;

    // Use category_id if provided, otherwise resolve category name/code to id
    let finalCategoryId = category_id;
    if (!finalCategoryId && category) {
      // Try to resolve category name/code to id
      const [[catRow]] = await pool.query(
        'SELECT id FROM dish_categories WHERE code = ? OR display_name = ? LIMIT 1',
        [category, category]
      );
      if (catRow && catRow.id) {
        finalCategoryId = catRow.id;
      } else {
        // If not found, return error
        return res.status(400).json({
          error: 'Invalid category',
          details: `Category '${category}' does not exist in dish_categories table.`
        });
      }
    }

    // Enhanced validation with detailed messages
    const errors = [];
    if (!name) errors.push('name is required');
    if (!municipality_id) errors.push('municipality_id is required');
    if (!finalCategoryId) errors.push('category_id is required');

    if (errors.length > 0) {
      console.log('❌ VALIDATION ERRORS:', errors);
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        received: req.body
      });
    }

    // Check if municipality exists
    const [[municipality]] = await pool.query(
      'SELECT id FROM municipalities WHERE id = ?',
      [municipality_id]
    );

    if (!municipality) {
      return res.status(400).json({
        error: 'Invalid municipality_id',
        details: `Municipality with id ${municipality_id} does not exist`
      });
    }

    // Generate slug from name if not provided
    const finalSlug = slug ? String(slug) : slugify(name);

    console.log('✅ VALIDATION PASSED - Creating dish...');

    // Insert all fields, using category_id
    const [result] = await pool.query(
      `INSERT INTO dishes (
        name, slug, municipality_id, category_id, description, image_url,
        flavor_profile, ingredients, is_signature, panel_rank, featured, featured_rank,
        rating, popularity, history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name),
        finalSlug,
        Number(municipality_id),
        Number(finalCategoryId),
        description,
        image_url,
        jsonOrNull(parseMaybeJsonArray(flavor_profile)),
        jsonOrNull(parseMaybeJsonArray(ingredients)),
        is_signature ? 1 : 0,
        panel_rank,
        featured ? 1 : 0,
        featured_rank,
        rating,
        popularity,
        history
      ]
    );

    // Return the created dish
    const [[newDish]] = await pool.query(
      `SELECT d.*, m.name as municipality_name 
       FROM dishes d 
       LEFT JOIN municipalities m ON d.municipality_id = m.id 
       WHERE d.id = ?`,
      [result.insertId]
    );

    // Format response
    const formattedDish = {
      ...newDish,
      is_signature: Boolean(newDish.is_signature),
      featured: Boolean(newDish.featured),
      flavor_profile: newDish.flavor_profile ? JSON.parse(newDish.flavor_profile) : [],
      ingredients: newDish.ingredients ? JSON.parse(newDish.ingredients) : []
    };

    console.log('✅ DISH CREATED SUCCESSFULLY:', formattedDish.id);
    res.status(201).json(formattedDish);
  } catch (error) {
    console.error('❌ Error creating dish:', error);
    res.status(500).json({
      error: 'Failed to create dish',
      details: error.message,
      sqlMessage: error.sqlMessage
    });
  }
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

app.patch('/admin/curate/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    console.log(`[curate-dish] Updating dish ${id} with:`, req.body);

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

    // Get the dish's current data first
    const [[currentDish]] = await pool.query('SELECT name, municipality_id, panel_rank FROM dishes WHERE id = ? LIMIT 1', [id]);
    console.log(`[curate-dish] Current dish state:`, currentDish);

    // If setting panel_rank = 1, clear it for all other dishes in the same municipality first
    if (Object.prototype.hasOwnProperty.call(up, 'panel_rank') && up.panel_rank === 1 && currentDish.municipality_id) {
      await pool.query(
        'UPDATE dishes SET panel_rank = NULL WHERE municipality_id = ? AND id != ? AND panel_rank = 1',
        [currentDish.municipality_id, id]
      );
    }

    // Update the dish
    await pool.query(`UPDATE dishes SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
    console.log(`[curate-dish] Updated dish ${id} - ${currentDish.name}`);

    // If panel_rank was part of the update, reflect "panel_rank == 1" as the municipality's recommended dish
    try {
      if (Object.prototype.hasOwnProperty.call(up, 'panel_rank')) {
        const newRank = up.panel_rank;
        const muniId = currentDish.municipality_id;
        console.log(`[curate-dish] Panel rank update for dish ${id} - old=${currentDish.panel_rank}, new=${newRank}`);

        if (muniId) {
          const [[muni]] = await pool.query('SELECT name, recommended_dish_id FROM municipalities WHERE id = ? LIMIT 1', [muniId]);
          console.log(`[curate-dish] Municipality ${muniId} (${muni?.name}) current recommended_dish_id: ${muni?.recommended_dish_id}`);

          if (newRank == 1) {
            // set as recommended dish
            await pool.query('UPDATE municipalities SET recommended_dish_id = ? WHERE id = ?', [id, muniId]);
            console.log(`[curate-dish] Set municipality ${muniId} (${muni?.name}) recommended_dish_id -> ${id}`);

            // Notify clients to refresh
            try {
              req.app.emit('dish-curation-updated', { municipalityId: muniId });
            } catch (e) { console.warn('Failed to emit update event:', e); }
          } else {
            // if municipality currently recommends this dish, clear it
            if (muni && muni.recommended_dish_id === id) {
              await pool.query('UPDATE municipalities SET recommended_dish_id = NULL WHERE id = ?', [muniId]);
              console.log(`[curate-dish] Cleared recommended_dish_id for municipality ${muniId} (${muni.name}) because panel_rank changed for dish ${id}`);
              // Check if another dish should become recommended (has panel_rank = 1)
              const [[newRecommended]] = await pool.query(
                'SELECT id, name FROM dishes WHERE municipality_id = ? AND panel_rank = 1 AND id != ? LIMIT 1',
                [muniId, id]
              );
              if (newRecommended) {
                console.log(`[curate-dish] Found new recommended dish for ${muniId}: ${newRecommended.name} (${newRecommended.id})`);
                await pool.query('UPDATE municipalities SET recommended_dish_id = ? WHERE id = ?', [newRecommended.id, muniId]);
              }

              // Notify clients to refresh
              try {
                req.app.emit('dish-curation-updated', { municipalityId: muniId });
              } catch (e) { console.warn('Failed to emit update event:', e); }
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to sync panel_rank to municipalities.recommended_dish_id:', e && e.message ? e.message : e);
    }

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
    // If panel_rank was part of the update, reflect "panel_rank == 1" as the municipality's recommended dish
    try {
      if (Object.prototype.hasOwnProperty.call(up, 'panel_rank')) {
        const newRank = up.panel_rank;
        // fetch the dish's municipality
        const [[dishRow]] = await pool.query('SELECT municipality_id FROM dishes WHERE id = ? LIMIT 1', [id]);
        const muniId = dishRow ? dishRow.municipality_id : null;
        if (muniId) {
          if (newRank == 1) {
            // set as recommended dish
            await pool.query('UPDATE municipalities SET recommended_dish_id = ? WHERE id = ?', [id, muniId]);
            console.log(`Set municipality ${muniId} recommended_dish_id -> ${id}`);
          } else {
            // if municipality currently recommends this dish, clear it
            const [[mrow]] = await pool.query('SELECT recommended_dish_id FROM municipalities WHERE id = ? LIMIT 1', [muniId]);
            if (mrow && mrow.recommended_dish_id === id) {
              await pool.query('UPDATE municipalities SET recommended_dish_id = NULL WHERE id = ?', [muniId]);
              console.log(`Cleared recommended_dish_id for municipality ${muniId} because panel_rank changed for dish ${id}`);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to sync panel_rank to municipalities.recommended_dish_id:', e && e.message ? e.message : e);
    }

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
    const { availability } = req.body;

    if (!availability) {
      return res.status(400).json({ error: 'availability is required' });
    }

    await pool.query(
      `UPDATE dish_restaurants 
       SET availability = ?
       WHERE restaurant_id = ? AND dish_id = ?`,
      [availability, restaurantId, dishId]
    );

    res.json({ success: true, message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Error updating dish availability:', error);
    res.status(500).json({ error: 'Failed to update dish availability' });
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
        m1.name as dish_municipality,
        m2.name as restaurant_municipality,
        dr.created_at
      FROM dish_restaurants dr
      JOIN dishes d ON dr.dish_id = d.id
      JOIN restaurants r ON dr.restaurant_id = r.id
      JOIN municipalities m1 ON d.municipality_id = m1.id
      JOIN municipalities m2 ON r.municipality_id = m2.id
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
      LIMIT 1000
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
        COUNT(dr.dish_id) as linked_dishes_count,
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
      ORDER BY linked_dishes_count DESC, r.name ASC
      LIMIT 1000
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
      GROUP BY r.id, r.name, r.address, m.name
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

import municipalitiesRouter from './routes/municipalities.js';

app.use('/api/municipalities', municipalitiesRouter);


  const port = process.env.PORT || 3002;
  const server = app.listen(port, () => {
    console.log(`✨ Server running on http://localhost:${port}`);
  });