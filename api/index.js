// api/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors({
  origin: '*',                // allow anyone (safe since we only expose GET)
  methods: ['GET'],           // main site only does reads
  allowedHeaders: ['Content-Type']
}));
/* ---------------------------
   CORS (credentialed) setup
   --------------------------- */
const baseAllowed = new Set([
  'http://localhost:5173',            // Vite dev
  'http://127.0.0.1:5173',
  'http://localhost:4173',            // Vite preview
  'https://7cknmad.github.io',        // GitHub Pages origin
]);

// Optional: add extra comma-separated origins via env
if (process.env.ALLOWED_ORIGINS) {
  for (const o of process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) {
    baseAllowed.add(o);
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // allow curl/postman
  if (baseAllowed.has(origin)) return true;
  try {
    // allow any Cloudflare Tunnel like https://something.trycloudflare.com
    const u = new URL(origin);
    if (u.hostname.endsWith('.trycloudflare.com')) return true;
  } catch {}
  return false;
}

const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // ok for admin later; public fetches can still use credentials: 'omit'
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(express.json());

/* ---------------------------
   MySQL pool + schema probe
   --------------------------- */
const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
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

  console.log('🧭 Schema detected:',
    { restaurants: [...schema.restaurants], dishes: [...schema.dishes] });
}

const hasR = (col) => schema.restaurants.has(col);
const hasD = (col) => schema.dishes.has(col);

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

/* ---------------------------
   Public endpoints
   --------------------------- */

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
    console.error('MUNICIPALITIES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipalities', detail: String(e?.message || e) });
  }
});

/** GET /api/dishes?municipalityId=&category=&q=&signature=&limit= */
app.get('/api/dishes', async (req, res) => {
  try {
    const { municipalityId, category, q, signature, limit } = req.query;

    const where = [];
    const params = [];

    if (municipalityId) {
      const id = Number(municipalityId);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'municipalityId must be a number' });
      where.push('d.municipality_id = ?'); params.push(id);
    }
    if (category) { where.push('c.code = ?'); params.push(String(category)); }
    if (q) {
      where.push('(MATCH(d.name, d.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR d.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }
    if (signature != null && hasD('is_signature')) {
      where.push('d.is_signature = ?'); params.push(Number(signature) ? 1 : 0);
    }

    const selectCols = [
      'd.id', 'd.name', 'd.slug', 'd.description', 'd.image_url',
      'd.rating', 'd.popularity',
      "JSON_EXTRACT(d.flavor_profile, '$') AS flavor_profile",
      "JSON_EXTRACT(d.ingredients, '$') AS ingredients",
      'm.id AS municipality_id', 'm.name AS municipality_name',
      'c.code AS category',
    ];
    if (hasD('is_signature')) selectCols.push('d.is_signature');
    if (hasD('panel_rank')) selectCols.push('d.panel_rank');

    const sql = `
      SELECT ${selectCols.join(', ')}
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        ${hasD('panel_rank') ? 'COALESCE(d.panel_rank, 999),' : ''}
        d.popularity DESC, d.name ASC
      LIMIT ${Number(limit) > 0 ? Number(limit) : 200}
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('DISHES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes', detail: String(e?.message || e) });
  }
});

/** GET /api/restaurants?municipalityId=&dishId=&q=&featured=&limit=&kind= */
app.get('/api/restaurants', async (req, res) => {
  try {
    const { municipalityId, dishId, q, featured, limit, kind } = req.query;

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
    if (kind) { where.push('r.kind = ?'); params.push(String(kind)); }
    if (q) {
      where.push('(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }
    if (featured != null && hasR('featured')) {
      where.push('r.featured = ?'); params.push(Number(featured) ? 1 : 0);
    }

    const selectCols = [
      'r.id', 'r.name', 'r.slug', 'r.kind',
      'r.description', 'r.address', 'r.phone', 'r.website',
      'r.facebook', 'r.instagram', 'r.opening_hours',
      'r.price_range',
      "JSON_EXTRACT(r.cuisine_types, '$') AS cuisine_types",
      'r.rating', 'r.lat', 'r.lng',
    ];
    if (hasR('image_url')) selectCols.push('r.image_url');
    if (hasR('featured')) selectCols.push('r.featured');
    if (hasR('featured_rank')) selectCols.push('r.featured_rank');

    const sql = `
      SELECT ${selectCols.join(', ')}
      FROM restaurants r
      ${joinDish}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        ${hasR('featured_rank') ? 'COALESCE(r.featured_rank, 999),' : ''}
        r.rating DESC, r.name ASC
      LIMIT ${Number(limit) > 0 ? Number(limit) : 200}
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('RESTAURANTS ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch restaurants', detail: String(e?.message || e) });
  }
});

/* ---------------------------
   Start server
   --------------------------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
