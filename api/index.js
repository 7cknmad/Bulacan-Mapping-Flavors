// api/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
dotenv.config();

const app = express();
app.set('trust proxy', 1);

// === CORS (GitHub Pages + Cloudflare tunnel) ===
const DEFAULT_ALLOWED = [
  'http://localhost:5173',
  'https://7cknmad.github.io',
];
// allow comma-separated origins via env
const extra = (process.env.ALLOW_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://7cknmad.github.io',                 // your Pages domain
];

app.use(cors({
  origin(origin, cb) {
    // allow non-browser tools (e.g. curl) and allowed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, origin ?? true);
    return cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true, // << allow cookies
}));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(cookieParser());

// === Admin cookie settings ===
const isProd = process.env.NODE_ENV === 'production'; // set to 'production' for tunnel + GHPages
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bulacan.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Always set cross-site cookie when not on localhost
const cookieOpts = {
  httpOnly: true,
  sameSite: isProd ? 'None' : 'Lax', // for cross-site (gh pages) set NODE_ENV=production
  secure: isProd,                    // required for SameSite=None
  path: '/',
  maxAge: 7 * 24 * 3600 * 1000,
};

function makeToken(email) {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(email + '|' + ts).digest('hex');
  return Buffer.from(JSON.stringify({ email, ts, sig })).toString('base64url');
}
function verifyToken(raw) {
  try {
    const { email, ts, sig } = JSON.parse(Buffer.from(raw, 'base64url').toString());
    const expect = crypto.createHmac('sha256', JWT_SECRET).update(email + '|' + ts).digest('hex');
    if (expect !== sig) return null;
    if (Date.now() - Number(ts) > 7 * 24 * 3600 * 1000) return null;
    return { email };
  } catch {
    return null;
  }
}

// === DB ===
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
const schema = { restaurants: new Set(), dishes: new Set() };

async function loadSchemaInfo() {
  const [rCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'restaurants'`,
    [cfg.database]
  );
  schema.restaurants = new Set(rCols.map(r => r.COLUMN_NAME));

  const [dCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dishes'`,
    [cfg.database]
  );
  schema.dishes = new Set(dCols.map(r => r.COLUMN_NAME));

  console.log('🧭 Schema detected:', {
    restaurants: [...schema.restaurants],
    dishes: [...schema.dishes],
  });
}

(async () => {
  try {
    pool = mysql.createPool(cfg);
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log('✅ Connected to DB:', db);
    await loadSchemaInfo();
  } catch (e) {
    console.error('❌ Failed to init DB pool:', e);
  }
})();

const hasR = (col) => schema.restaurants.has(col);
const hasD = (col) => schema.dishes.has(col);

// === Public ===
app.get('/api/health', async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: row.ok === 1, db: cfg.database });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
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
    res.status(500).json({ error: 'Failed to fetch municipalities', detail: String(e?.message || e) });
  }
});

app.get('/api/dishes', async (req, res) => {
  try {
    const { municipalityId, category, q, signature, limit } = req.query;
    const where = [];
    const params = [];
    if (municipalityId) { where.push('d.municipality_id = ?'); params.push(Number(municipalityId)); }
    if (category)        { where.push('c.code = ?');            params.push(String(category)); }
    if (signature != null) { where.push('d.is_signature = ?');  params.push(Number(signature) ? 1 : 0); }
    if (q) {
      where.push('(MATCH(d.name,d.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR d.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }
    const sql = `
      SELECT
        d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
        JSON_EXTRACT(d.flavor_profile,'$') AS flavor_profile,
        JSON_EXTRACT(d.ingredients,'$')     AS ingredients,
        ${hasD('is_signature') ? 'd.is_signature,' : 'NULL AS is_signature,'}
        ${hasD('panel_rank') ? 'd.panel_rank,' : 'NULL AS panel_rank,'}
        m.id AS municipality_id, m.name AS municipality_name,
        c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        ${hasD('panel_rank') ? 'CASE WHEN d.panel_rank IS NOT NULL THEN 0 ELSE 1 END, d.panel_rank ASC,' : ''}
        d.popularity DESC, d.name ASC
      LIMIT ${Number(limit) > 0 ? Number(limit) : 200}
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch dishes', detail: String(e?.message || e) });
  }
});

app.get('/api/restaurants', async (req, res) => {
  try {
    const { municipalityId, dishId, kind, q, featured, limit } = req.query;
    const where = [];
    const params = [];
    const joinDish = dishId
      ? 'INNER JOIN dish_restaurants dr ON dr.restaurant_id = r.id AND dr.dish_id = ?'
      : '';
    if (dishId) params.push(Number(dishId));
    if (municipalityId) { where.push('r.municipality_id = ?'); params.push(Number(municipalityId)); }
    if (kind)           { where.push('r.kind = ?');            params.push(String(kind)); }
    if (featured != null && hasR('featured')) { where.push('r.featured = ?'); params.push(Number(featured) ? 1 : 0); }
    if (q) {
      where.push('(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }
    const select = [
      'r.id','r.name','r.slug','r.kind',
      'r.description','r.address','r.phone','r.website',
      'r.facebook','r.instagram','r.opening_hours',
      'r.price_range', "JSON_EXTRACT(r.cuisine_types,'$') AS cuisine_types",
      'r.rating','r.lat','r.lng'
    ];
    if (hasR('image_url')) select.push('r.image_url');
    if (hasR('featured')) select.push('r.featured');
    if (hasR('featured_rank')) select.push('r.featured_rank');
    const sql = `
      SELECT ${select.join(',')}
      FROM restaurants r
      ${joinDish}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        ${hasR('featured_rank') ? 'CASE WHEN r.featured_rank IS NOT NULL THEN 0 ELSE 1 END, r.featured_rank ASC,' : ''}
        r.rating DESC, r.name ASC
      LIMIT ${Number(limit) > 0 ? Number(limit) : 200}
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch restaurants', detail: String(e?.message || e) });
  }
});

// === Admin auth ===
app.post('/api/admin/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  // TODO: validate against DB
  const ok = email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD;
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // create a signed token or session id; for demo, a simple string
  const token = 'session-'+Date.now();

  // Cookie MUST be SameSite=None and Secure for cross-site (GitHub Pages) requests
  res.cookie('admin_sess', token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,     // required when site is HTTPS (GitHub Pages)
    path: '/',
    maxAge: 7 * 24 * 3600 * 1000, // 7 days
  });
  res.json({ user: { id: 1, email } });
});

app.get('/api/admin/auth/me', (req, res) => {
  const token = req.cookies?.admin_sess;
  if (!token) return res.status(401).json({ user: null });
  // TODO: verify token, fetch user
  res.json({ user: { id: 1, email: process.env.ADMIN_EMAIL } });
});

app.post('/api/admin/auth/logout', (req, res) => {
  res.clearCookie('admin_sess', {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/',
  });
  res.json({ ok: true });
});

// === Admin CRUD (create/update/delete guarded for optional columns) ===
app.post('/api/admin/dishes', async (req, res) => {
  try {
    const {
      municipality_id, category_code, name, slug,
      description = null, flavor_profile = [], ingredients = [],
      history = null, image_url = null, popularity = 0, rating = 0,
      is_signature = null, panel_rank = null
    } = req.body;

    if (!municipality_id || !category_code || !name || !slug) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [category_code]);
    if (!cat) return res.status(400).json({ error: 'Unknown category_code' });

    const cols = [
      'municipality_id','category_id','name','slug','description',
      'flavor_profile','ingredients','history','image_url','popularity','rating'
    ];
    const vals = [
      municipality_id, cat.id, name, slug, description,
      JSON.stringify(flavor_profile), JSON.stringify(ingredients), history, image_url, popularity, rating
    ];
    if (hasD('is_signature')) { cols.push('is_signature'); vals.push(is_signature ?? 0); }
    if (hasD('panel_rank'))  { cols.push('panel_rank');  vals.push(panel_rank ?? null); }

    const sql = `
      INSERT INTO dishes (${cols.join(',')})
      VALUES (${cols.map(_ => '?').join(',')})
      ON DUPLICATE KEY UPDATE
        description=VALUES(description), flavor_profile=VALUES(flavor_profile),
        ingredients=VALUES(ingredients), history=VALUES(history),
        image_url=VALUES(image_url), popularity=VALUES(popularity), rating=VALUES(rating)
        ${hasD('is_signature') ? ', is_signature=VALUES(is_signature)' : ''}
        ${hasD('panel_rank')  ? ', panel_rank=VALUES(panel_rank)'     : ''}
    `;
    const [r] = await pool.query(sql, vals);
    const id = r.insertId || (await pool.query(`SELECT id FROM dishes WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save dish', detail: String(e?.message || e) });
  }
});

app.patch('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });

    const fields = [];
    const params = [];
    const allow = ['municipality_id','name','slug','description','image_url','popularity','rating'];
    for (const k of allow) if (k in req.body) { fields.push(`${k}=?`); params.push(req.body[k]); }
    if ('flavor_profile' in req.body) { fields.push('flavor_profile=?'); params.push(JSON.stringify(req.body.flavor_profile)); }
    if ('ingredients' in req.body)    { fields.push('ingredients=?');    params.push(JSON.stringify(req.body.ingredients)); }
    if ('category_code' in req.body) {
      const [[cat]] = await pool.query('SELECT id FROM dish_categories WHERE code=?', [req.body.category_code]);
      if (!cat) return res.status(400).json({ error: 'Unknown category_code' });
      fields.push('category_id=?'); params.push(cat.id);
    }
    if ('is_signature' in req.body) {
      if (!hasD('is_signature')) return res.status(400).json({ error: "Column 'is_signature' not in schema" });
      fields.push('is_signature=?'); params.push(req.body.is_signature ? 1 : 0);
    }
    if ('panel_rank' in req.body) {
      if (!hasD('panel_rank')) return res.status(400).json({ error: "Column 'panel_rank' not in schema" });
      fields.push('panel_rank=?'); params.push(req.body.panel_rank ?? null);
    }
    if (fields.length === 0) return res.json({ ok: true, changed: 0 });

    params.push(id);
    await pool.query(`UPDATE dishes SET ${fields.join(',')} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });
    await pool.query('DELETE FROM dishes WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete dish', detail: String(e?.message || e) });
  }
});

app.post('/api/admin/restaurants', async (req, res) => {
  try {
    const {
      municipality_id, name, slug, kind = 'restaurant',
      address, lat, lng, description = null,
      price_range = 'moderate', cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0, image_url = null, featured = null, featured_rank = null
    } = req.body;

    if (!municipality_id || !name || !slug || !address || lat == null || lng == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cols = [
      'name','slug','kind','description','municipality_id','address',
      'phone','email','website','facebook','instagram','opening_hours',
      'price_range','cuisine_types','rating','lat','lng'
    ];
    const vals = [
      name, slug, kind, description, municipality_id, address,
      phone, email, website, facebook, instagram, opening_hours,
      price_range, JSON.stringify(cuisine_types), rating, lat, lng
    ];
    if (hasR('image_url')) { cols.push('image_url'); vals.push(image_url); }
    if (hasR('featured')) { cols.push('featured'); vals.push(featured ?? 0); }
    if (hasR('featured_rank')) { cols.push('featured_rank'); vals.push(featured_rank ?? null); }

    const placeholders = cols.map(() => '?').join(',');
    const sql = `
      INSERT INTO restaurants (${cols.join(',')}, location_pt)
      VALUES (${placeholders}, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326))
      ON DUPLICATE KEY UPDATE
        description=VALUES(description), address=VALUES(address), kind=VALUES(kind),
        opening_hours=VALUES(opening_hours), price_range=VALUES(price_range),
        cuisine_types=VALUES(cuisine_types), rating=VALUES(rating),
        lat=VALUES(lat), lng=VALUES(lng), location_pt=VALUES(location_pt)
        ${hasR('image_url') ? ', image_url=VALUES(image_url)' : ''}
        ${hasR('featured') ? ', featured=VALUES(featured)' : ''}
        ${hasR('featured_rank') ? ', featured_rank=VALUES(featured_rank)' : ''}
    `;
    const params = [...vals, lng, lat];
    const [r] = await pool.query(sql, params);
    const id = r.insertId || (await pool.query(`SELECT id FROM restaurants WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create restaurant', detail: String(e?.message || e) });
  }
});

app.patch('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid restaurant id' });

    const fields = [];
    const params = [];
    const allow = ['municipality_id','name','slug','kind','description','address',
      'phone','email','website','facebook','instagram','opening_hours',
      'price_range','rating','lat','lng'];
    for (const k of allow) if (k in req.body) { fields.push(`${k}=?`); params.push(req.body[k]); }
    if ('cuisine_types' in req.body) { fields.push('cuisine_types=?'); params.push(JSON.stringify(req.body.cuisine_types)); }
    if ('image_url' in req.body) {
      if (!hasR('image_url')) return res.status(400).json({ error: "Column 'image_url' not in schema" });
      fields.push('image_url=?'); params.push(req.body.image_url);
    }
    if ('featured' in req.body) {
      if (!hasR('featured')) return res.status(400).json({ error: "Column 'featured' not in schema" });
      fields.push('featured=?'); params.push(req.body.featured ? 1 : 0);
    }
    if ('featured_rank' in req.body) {
      if (!hasR('featured_rank')) return res.status(400).json({ error: "Column 'featured_rank' not in schema" });
      fields.push('featured_rank=?'); params.push(req.body.featured_rank ?? null);
    }
    if (fields.length === 0) return res.json({ ok: true, changed: 0 });

    params.push(id);
    await pool.query(`UPDATE restaurants SET ${fields.join(',')} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update restaurant', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid restaurant id' });
    await pool.query('DELETE FROM restaurants WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete restaurant', detail: String(e?.message || e) });
  }
});

// Linking
app.get('/api/admin/dishes/:dishId/restaurants', async (req, res) => {
  try {
    const dishId = Number(req.params.dishId);
    if (!Number.isFinite(dishId)) return res.status(400).json({ error: 'Invalid dish id' });
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug, dr.price_note, dr.availability
       FROM dish_restaurants dr
       JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = ?
       ORDER BY r.name ASC`, [dishId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch restaurants for dish', detail: String(e?.message || e) });
  }
});

app.get('/api/admin/restaurants/:restId/dishes', async (req, res) => {
  try {
    const restId = Number(req.params.restId);
    if (!Number.isFinite(restId)) return res.status(400).json({ error: 'Invalid restaurant id' });
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.slug, dc.code AS category
       FROM dish_restaurants dr
       JOIN dishes d ON d.id = dr.dish_id
       JOIN dish_categories dc ON dc.id = d.category_id
       WHERE dr.restaurant_id = ?
       ORDER BY d.name ASC`, [restId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch dishes for restaurant', detail: String(e?.message || e) });
  }
});

app.post('/api/admin/dish-restaurants', async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note = null, availability = 'regular' } = req.body;
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'dish_id and restaurant_id are required' });
    await pool.query(
      `INSERT INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE price_note=VALUES(price_note), availability=VALUES(availability)`,
      [dish_id, restaurant_id, price_note, availability]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to link dish & restaurant', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/dish-restaurants', async (req, res) => {
  try {
    const dishId = Number(req.query.dish_id);
    const restId = Number(req.query.restaurant_id);
    if (!Number.isFinite(dishId) || !Number.isFinite(restId)) {
      return res.status(400).json({ error: 'dish_id and restaurant_id required' });
    }
    await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dishId, restId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to unlink dish & restaurant', detail: String(e?.message || e) });
  }
});

// Analytics
app.get('/api/admin/analytics/summary', async (_req, res) => {
  try {
    const [[{ c: muniCount }]] = await pool.query('SELECT COUNT(*) c FROM municipalities');
    const [[{ c: dishCount }]] = await pool.query('SELECT COUNT(*) c FROM dishes');
    const [[{ c: restCount }]] = await pool.query('SELECT COUNT(*) c FROM restaurants');
    const [[{ c: linkCount }]] = await pool.query('SELECT COUNT(*) c FROM dish_restaurants');

    const dishSelect = hasD('is_signature')
      ? `SUM(CASE WHEN d.is_signature=1 THEN 1 ELSE 0 END) AS signature_dishes`
      : `NULL AS signature_dishes`;

    const restSelect = hasR('featured')
      ? `SUM(CASE WHEN r.featured=1 THEN 1 ELSE 0 END) AS featured_restaurants`
      : `NULL AS featured_restaurants`;

    const [byMuni] = await pool.query(
      `SELECT m.id, m.name, m.slug,
              COUNT(DISTINCT d.id) AS total_dishes,
              COUNT(DISTINCT r.id) AS total_restaurants,
              ${dishSelect},
              ${restSelect}
       FROM municipalities m
       LEFT JOIN dishes d ON d.municipality_id = m.id
       LEFT JOIN restaurants r ON r.municipality_id = m.id
       GROUP BY m.id
       ORDER BY m.name`
    );

    res.json({
      totals: { municipalities: muniCount, dishes: dishCount, restaurants: restCount, links: linkCount },
      byMunicipality: byMuni,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed analytics', detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
