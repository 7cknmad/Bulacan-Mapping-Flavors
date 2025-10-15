import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

// ====== CORS (GitHub Pages + local + Cloudflare tunnel) ======
const ALLOWED = new Set([
  'http://localhost:5173',
  'https://7cknmad.github.io',
]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // Postman/curl
    if (ALLOWED.has(origin)) return cb(null, true);
    // allow any *.trycloudflare.com tunnel
    try {
      const { hostname, protocol } = new URL(origin);
      if (protocol === 'https:' && hostname.endsWith('.trycloudflare.com')) {
        return cb(null, true);
      }
    } catch {}
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // <-- IMPORTANT for cookies
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight

// ====== DB pool ======
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

// ====== Health ======
app.get('/api/health', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: row.ok === 1, db: cfg.database });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ====== Municipalities ======
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

// ====== Dishes (public) ======
app.get('/api/dishes', async (req, res) => {
  try {
    const { municipalityId, category, q, signature, limit } = req.query;

    const where = [];
    const params = [];

    if (municipalityId) { where.push('d.municipality_id = ?'); params.push(Number(municipalityId)); }
    if (category)       { where.push('c.code = ?');            params.push(String(category)); }
    if (signature != null) { where.push('d.is_signature = ?'); params.push(Number(signature) ? 1 : 0); }
    if (q) {
      where.push('(MATCH(d.name,d.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR d.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }

    const lim = Math.min(Number(limit || 200), 500);

    const sql = `
      SELECT
        d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
        JSON_EXTRACT(d.flavor_profile, '$') AS flavor_profile,
        JSON_EXTRACT(d.ingredients, '$')     AS ingredients,
        d.is_signature, d.panel_rank,
        m.id AS municipality_id, m.name AS municipality_name,
        c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        (d.panel_rank IS NULL), d.panel_rank ASC,
        d.popularity DESC, d.name ASC
      LIMIT ${lim}
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('DISHES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes', detail: String(e?.message || e) });
  }
});

// ====== Restaurants (public) ======
app.get('/api/restaurants', async (req, res) => {
  try {
    const { municipalityId, dishId, kind, q, featured, limit } = req.query;

    const where = [];
    const params = [];

    // join on dish if given
    const joinDish = dishId ? 'INNER JOIN dish_restaurants dr ON dr.restaurant_id = r.id AND dr.dish_id = ?' : '';
    if (dishId) params.push(Number(dishId));

    if (municipalityId) { where.push('r.municipality_id = ?'); params.push(Number(municipalityId)); }
    if (kind)           { where.push('r.kind = ?');            params.push(String(kind)); }
    if (featured != null) { where.push('r.featured = ?');      params.push(Number(featured) ? 1 : 0); }

    if (q) {
      where.push('(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }

    const lim = Math.min(Number(limit || 200), 500);

    const sql = `
      SELECT
        r.id, r.name, r.slug, r.kind,
        r.description, r.address, r.phone, r.website,
        r.facebook, r.instagram, r.opening_hours,
        r.price_range, r.cuisine_types, r.rating, r.lat, r.lng,
        r.image_url, r.featured, r.featured_rank
      FROM restaurants r
      ${joinDish}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        (r.featured_rank IS NULL), r.featured_rank ASC,
        r.rating DESC, r.name ASC
      LIMIT ${lim}
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('RESTAURANTS ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch restaurants', detail: String(e?.message || e) });
  }
});

// ====== Municipality scoped helpers ======
app.get('/api/municipalities/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid municipality id' });

    const [rows] = await pool.query(
      `SELECT
         d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
         JSON_EXTRACT(d.flavor_profile, '$') AS flavor_profile,
         JSON_EXTRACT(d.ingredients, '$')     AS ingredients,
         d.is_signature, d.panel_rank,
         m.id AS municipality_id, m.name AS municipality_name,
         c.code AS category
       FROM dishes d
       JOIN municipalities m ON m.id = d.municipality_id
       JOIN dish_categories c ON c.id = d.category_id
       WHERE d.municipality_id = ?
       ORDER BY (d.panel_rank IS NULL), d.panel_rank ASC, d.popularity DESC, d.name ASC
       LIMIT 200`,
      [id]
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
              r.rating, r.lat, r.lng, r.image_url, r.featured, r.featured_rank
       FROM restaurants r
       WHERE r.municipality_id = ?
       ORDER BY (r.featured_rank IS NULL), r.featured_rank ASC, r.rating DESC, r.name ASC
       LIMIT 200`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('MUNI RESTAURANTS ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipality restaurants', detail: String(e?.message || e) });
  }
});

// ====== Linking (public fallback) ======
app.get('/api/restaurants/by-dish/:dishId', async (req, res) => {
  try {
    const dishId = Number(req.params.dishId);
    if (!Number.isFinite(dishId)) return res.status(400).json({ error: 'Invalid dish id' });

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
              r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
              r.rating, r.lat, r.lng, r.image_url,
              dr.price_note, dr.availability
       FROM dish_restaurants dr
       INNER JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = ?
       ORDER BY (r.featured_rank IS NULL), r.featured_rank ASC, r.rating DESC, r.name ASC`,
      [dishId]
    );
    res.json(rows);
  } catch (e) {
    console.error('RESTAURANTS BY DISH ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch restaurants for dish', detail: String(e?.message || e) });
  }
});

// ====== Admin endpoints (minimal) ======
// Auth “me” (you can replace with real JWT/cookie check)
app.get('/api/admin/auth/me', (req, res) => {
  // If you implement real auth, verify cookie/JWT here
  res.json({ ok: true, user: { email: 'admin@example.com' } });
});

// Admin linking lists (used by dashboard)
app.get('/api/admin/dishes/:id/restaurants', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug
       FROM dish_restaurants dr
       JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = ?
       ORDER BY r.name ASC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list restaurants for dish', detail: String(e?.message || e) });
  }
});

app.get('/api/admin/restaurants/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.slug
       FROM dish_restaurants dr
       JOIN dishes d ON d.id = dr.dish_id
       WHERE dr.restaurant_id = ?
       ORDER BY d.name ASC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list dishes for restaurant', detail: String(e?.message || e) });
  }
});

// Create / Update / Delete (admin) — keep your existing handlers if you have them
app.post('/api/admin/dishes', async (req, res) => {
  try {
    const {
      municipality_id, category_code, name, slug,
      description = null, flavor_profile = [], ingredients = [],
      history = null, image_url = null, popularity = 0, rating = 0,
      is_signature = 0, panel_rank = null
    } = req.body;

    if (!municipality_id || !category_code || !name || !slug) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [category_code]);
    if (!cat) return res.status(400).json({ error: 'Unknown category_code' });

    const [r] = await pool.query(
      `INSERT INTO dishes
        (municipality_id, category_id, name, slug, description,
         flavor_profile, ingredients, history, image_url, popularity, rating,
         is_signature, panel_rank)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         description=VALUES(description), flavor_profile=VALUES(flavor_profile),
         ingredients=VALUES(ingredients), history=VALUES(history),
         image_url=VALUES(image_url), popularity=VALUES(popularity),
         rating=VALUES(rating), is_signature=VALUES(is_signature), panel_rank=VALUES(panel_rank)`,
      [municipality_id, cat.id, name, slug, description,
       JSON.stringify(flavor_profile), JSON.stringify(ingredients), history,
       image_url, popularity, rating, is_signature ? 1 : 0, panel_rank]
    );
    const id = r.insertId || (await pool.query(`SELECT id FROM dishes WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create dish', detail: String(e?.message || e) });
  }
});

app.patch('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fields = [];
    const params = [];
    const up = (col, val) => { fields.push(`${col}=?`); params.push(val); };

    for (const [k, v] of Object.entries(req.body || {})) {
      if (['name','slug','description','image_url','popularity','rating','is_signature','panel_rank','category_id','municipality_id'].includes(k)) {
        up(k, v);
      }
      if (k === 'flavor_profile') up('flavor_profile', JSON.stringify(v ?? []));
      if (k === 'ingredients')    up('ingredients', JSON.stringify(v ?? []));
    }
    if (!fields.length) return res.json({ ok: true });
    params.push(id);

    await pool.query(`UPDATE dishes SET ${fields.join(', ')} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/dishes/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM dishes WHERE id=?`, [Number(req.params.id)]);
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
      rating = 0, image_url = null,
      featured = 0, featured_rank = null
    } = req.body;

    if (!municipality_id || !name || !slug || !address || lat == null || lng == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [r] = await pool.query(
      `INSERT INTO restaurants
        (name, slug, kind, description, municipality_id, address,
         phone, email, website, facebook, instagram, opening_hours,
         price_range, cuisine_types, rating, lat, lng, location_pt,
         image_url, featured, featured_rank)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
         ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326),
         ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         description=VALUES(description), address=VALUES(address), kind=VALUES(kind),
         opening_hours=VALUES(opening_hours), price_range=VALUES(price_range),
         cuisine_types=VALUES(cuisine_types), rating=VALUES(rating),
         lat=VALUES(lat), lng=VALUES(lng), location_pt=VALUES(location_pt),
         image_url=VALUES(image_url), featured=VALUES(featured), featured_rank=VALUES(featured_rank)`,
      [name, slug, kind, description, municipality_id, address,
       phone, email, website, facebook, instagram, opening_hours,
       price_range, JSON.stringify(cuisine_types), rating, lat, lng, lng, lat,
       image_url, featured ? 1 : 0, featured_rank]
    );
    const id = r.insertId || (await pool.query(`SELECT id FROM restaurants WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create restaurant', detail: String(e?.message || e) });
  }
});

app.patch('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fields = [];
    const params = [];
    const up = (col, val) => { fields.push(`${col}=?`); params.push(val); };

    for (const [k, v] of Object.entries(req.body || {})) {
      if ([
        'name','slug','kind','description','municipality_id','address','phone','email','website',
        'facebook','instagram','opening_hours','price_range','rating','lat','lng','image_url',
        'featured','featured_rank'
      ].includes(k)) up(k, v);
      if (k === 'cuisine_types') up('cuisine_types', JSON.stringify(v ?? []));
    }
    if (!fields.length) return res.json({ ok: true });
    params.push(id);

    await pool.query(`UPDATE restaurants SET ${fields.join(', ')} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update restaurant', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/restaurants/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM restaurants WHERE id=?`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete restaurant', detail: String(e?.message || e) });
  }
});

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
    res.status(500).json({ error: 'Failed to link dish & restaurant', detail: String(e?.message || e) });
  }
});

app.delete('/api/admin/dish-restaurants', async (req, res) => {
  try {
    const dish_id = Number(req.query.dish_id);
    const restaurant_id = Number(req.query.restaurant_id);
    await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dish_id, restaurant_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to unlink dish & restaurant', detail: String(e?.message || e) });
  }
});

// simple analytics stub
app.get('/api/admin/analytics/summary', async (req, res) => {
  try {
    const [[d]] = await pool.query(`SELECT COUNT(*) AS dishes FROM dishes`);
    const [[r]] = await pool.query(`SELECT COUNT(*) AS restaurants FROM restaurants`);
    const [[m]] = await pool.query(`SELECT COUNT(*) AS municipalities FROM municipalities`);
    res.json({ dishes: d.dishes, restaurants: r.restaurants, municipalities: m.municipalities });
  } catch (e) {
    res.status(500).json({ error: 'Failed analytics', detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
