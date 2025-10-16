// api/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

/* =========================
   CORS (credentialed) setup
   ========================= */
const allowedOrigins = new Set([
  'http://localhost:5173', // Vite dev
  'https://7cknmad.github.io', // GitHub Pages origin (path is ignored)
  'https://pollution-spatial-thumbzilla-basketball.trycloudflare.com',
]);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl/postman
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // <— so cookies work
};

app.use(cors(corsOptions));
app.options('/api/*', cors(corsOptions));       // Express 5: avoid bare "*"
app.options('/api/admin/*', cors(corsOptions)); // preflight for admin
app.options('/*', cors(corsOptions));

app.use(express.json());

/* =========================
   MySQL pool + schema probe
   ========================= */
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
const schema = {
  restaurants: new Set(),
  dishes: new Set(),
};

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

/* =========================
   Small helpers
   ========================= */
const hasR = (col) => schema.restaurants.has(col);
const hasD = (col) => schema.dishes.has(col);

/* =========================
   Public endpoints
   ========================= */

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
      where.push('d.municipality_id = ?');
      params.push(id);
    }

    if (category) {
      where.push('c.code = ?');
      params.push(String(category));
    }

    if (q) {
      where.push('(MATCH(d.name, d.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR d.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }

    if (signature != null && hasD('is_signature')) {
      where.push('d.is_signature = ?');
      params.push(Number(signature) ? 1 : 0);
    }

    const selectCols = [
      'd.id', 'd.name', 'd.slug', 'd.description', 'd.image_url',
      'd.rating', 'd.popularity',
      // ensure arrays even if stored as JSON text
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

    // optional join by dish
    const joinDish = dishId
      ? 'INNER JOIN dish_restaurants dr ON dr.restaurant_id = r.id AND dr.dish_id = ?'
      : '';
    if (dishId) params.push(Number(dishId));

    if (municipalityId) {
      const id = Number(municipalityId);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'municipalityId must be a number' });
      where.push('r.municipality_id = ?');
      params.push(id);
    }

    if (kind) {
      where.push('r.kind = ?');
      params.push(String(kind));
    }

    if (q) {
      where.push('(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }

    if (featured != null && hasR('featured')) {
      where.push('r.featured = ?');
      params.push(Number(featured) ? 1 : 0);
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

app.get('/api/municipalities/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid municipality id' });

    const selectCols = [
      'd.id','d.name','d.slug','d.description','d.image_url','d.rating','d.popularity',
      "JSON_EXTRACT(d.flavor_profile, '$') AS flavor_profile",
      "JSON_EXTRACT(d.ingredients, '$') AS ingredients",
      'm.id AS municipality_id','m.name AS municipality_name',
      'c.code AS category'
    ];
    if (hasD('is_signature')) selectCols.push('d.is_signature');
    if (hasD('panel_rank')) selectCols.push('d.panel_rank');

    const [rows] = await pool.query(
      `SELECT ${selectCols.join(', ')}
       FROM dishes d
       JOIN municipalities m ON m.id = d.municipality_id
       JOIN dish_categories c ON c.id = d.category_id
       WHERE d.municipality_id = ?
       ORDER BY ${hasD('panel_rank') ? 'COALESCE(d.panel_rank, 999),' : ''} d.popularity DESC, d.name ASC
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

    const selectCols = [
      'r.id','r.name','r.slug','r.kind','r.description','r.address','r.phone','r.website',
      'r.facebook','r.instagram','r.opening_hours','r.price_range',
      "JSON_EXTRACT(r.cuisine_types, '$') AS cuisine_types",
      'r.rating','r.lat','r.lng'
    ];
    if (hasR('image_url')) selectCols.push('r.image_url');
    if (hasR('featured')) selectCols.push('r.featured');
    if (hasR('featured_rank')) selectCols.push('r.featured_rank');

    const [rows] = await pool.query(
      `SELECT ${selectCols.join(', ')}
       FROM restaurants r
       WHERE r.municipality_id = ?
       ORDER BY ${hasR('featured_rank') ? 'COALESCE(r.featured_rank, 999),' : ''} r.rating DESC, r.name ASC
       LIMIT 200`,
      [id]
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

    const selectCols = [
      'r.id','r.name','r.slug','r.kind','r.description','r.address','r.phone','r.website',
      'r.facebook','r.instagram','r.opening_hours','r.price_range',
      "JSON_EXTRACT(r.cuisine_types, '$') AS cuisine_types",
      'r.rating','r.lat','r.lng',
      'dr.price_note','dr.availability'
    ];
    if (hasR('image_url')) selectCols.push('r.image_url');

    const [rows] = await pool.query(
      `SELECT ${selectCols.join(', ')}
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

    const selectCols = [
      'd.id','d.slug','d.name','d.description','d.image_url','d.rating','d.popularity',
      "JSON_EXTRACT(d.flavor_profile, '$') AS flavor_profile",
      "JSON_EXTRACT(d.ingredients, '$') AS ingredients",
      'dc.code AS category','d.municipality_id'
    ];
    if (hasD('is_signature')) selectCols.push('d.is_signature');

    const [rows] = await pool.query(
      `SELECT ${selectCols.join(', ')}
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

/* =========================
   Admin (auth stub + CRUD)
   ========================= */

// Minimal “me” to unblock UI (replace with real session later)
app.get('/api/admin/auth/me', (_req, res) => {
  res.json({ ok: true, user: { email: 'admin@local' } });
});

/** Create dish */
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
    console.error(e);
    res.status(500).json({ error: 'Failed to save dish', detail: String(e?.message || e) });
  }
});

/** Update dish */
app.patch('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });

    const fields = [];
    const params = [];

    const allowed = [
      'municipality_id','name','slug','description','image_url',
      'popularity','rating'
    ];
    for (const k of allowed) {
      if (k in req.body) { fields.push(`${k}=?`); params.push(req.body[k]); }
    }
    if ('flavor_profile' in req.body) { fields.push('flavor_profile=?'); params.push(JSON.stringify(req.body.flavor_profile)); }
    if ('ingredients'    in req.body) { fields.push('ingredients=?');    params.push(JSON.stringify(req.body.ingredients)); }
    if ('category_code'  in req.body) {
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
    console.error(e);
    res.status(500).json({ error: 'Failed to update dish', detail: String(e?.message || e) });
  }
});

/** Delete dish */
app.delete('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });
    await pool.query('DELETE FROM dishes WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete dish', detail: String(e?.message || e) });
  }
});

/** Create restaurant */
app.post('/api/admin/restaurants', async (req, res) => {
  try {
    const {
      municipality_id, name, slug, kind = 'restaurant',
      address, lat, lng, description = null,
      price_range = 'moderate', cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0, image_url = null,
      featured = null, featured_rank = null
    } = req.body;

    if (!municipality_id || !name || !slug || !address || lat == null || lng == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cols = [
      'name','slug','kind','description','municipality_id','address',
      'phone','email','website','facebook','instagram','opening_hours',
      'price_range','cuisine_types','rating','lat','lng','location_pt'
    ];
    const vals = [
      name, slug, kind, description, municipality_id, address,
      phone, email, website, facebook, instagram, opening_hours,
      price_range, JSON.stringify(cuisine_types), rating, lat, lng,
      // location point (lng lat)
      // (use ST_GeomFromText to avoid the ST_SRID signature mismatch on some MySQL versions)
      // We pass as values after the main placeholders:
    ];

    if (hasR('image_url')) { cols.push('image_url'); vals.push(image_url); }
    if (hasR('featured')) { cols.push('featured'); vals.push(featured ?? 0); }
    if (hasR('featured_rank')) { cols.push('featured_rank'); vals.push(featured_rank ?? null); }

    const placeholders = cols.map(() => '?').join(',');
    const sql = `
      INSERT INTO restaurants (${cols.join(',')})
      VALUES (${placeholders.substring(0, placeholders.lastIndexOf('?'))}, ?, ?,
        ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326))
      ON DUPLICATE KEY UPDATE
        description=VALUES(description), address=VALUES(address), kind=VALUES(kind),
        opening_hours=VALUES(opening_hours), price_range=VALUES(price_range),
        cuisine_types=VALUES(cuisine_types), rating=VALUES(rating),
        lat=VALUES(lat), lng=VALUES(lng), location_pt=VALUES(location_pt)
        ${hasR('image_url') ? ', image_url=VALUES(image_url)' : ''}
        ${hasR('featured') ? ', featured=VALUES(featured)' : ''}
        ${hasR('featured_rank') ? ', featured_rank=VALUES(featured_rank)' : ''}
    `;
    // build final params with lat/lng twice for ST_GeomFromText
    const geomParams = [...vals, lat, lng, lng, lat];
    const [r] = await pool.query(sql, geomParams);

    const id = r.insertId || (await pool.query(`SELECT id FROM restaurants WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create restaurant', detail: String(e?.message || e) });
  }
});

/** Update restaurant */
app.patch('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid restaurant id' });

    const fields = [];
    const params = [];
    const allowed = [
      'municipality_id','name','slug','kind','description','address',
      'phone','email','website','facebook','instagram','opening_hours',
      'price_range','rating','lat','lng'
    ];

    for (const k of allowed) {
      if (k in req.body) { fields.push(`${k}=?`); params.push(req.body[k]); }
    }
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
    console.error(e);
    res.status(500).json({ error: 'Failed to update restaurant', detail: String(e?.message || e) });
  }
});

/** Delete restaurant */
app.delete('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid restaurant id' });
    await pool.query('DELETE FROM restaurants WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete restaurant', detail: String(e?.message || e) });
  }
});

/** Linking: dish <-> restaurant */
app.get('/api/admin/dishes/:dishId/restaurants', async (req, res) => {
  try {
    const dishId = Number(req.params.dishId);
    if (!Number.isFinite(dishId)) return res.status(400).json({ error: 'Invalid dish id' });

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug,
              dr.price_note, dr.availability
       FROM dish_restaurants dr
       JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = ?
       ORDER BY r.name ASC`, [dishId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch restaurants for dish', detail: String(e?.message || e) });
  }
});

app.get('/api/admin/restaurants/:restId/dishes', async (req, res) => {
  try {
    const restId = Number(req.params.restId);
    if (!Number.isFinite(restId)) return res.status(400).json({ error: 'Invalid restaurant id' });

    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.slug,
              dc.code AS category
       FROM dish_restaurants dr
       JOIN dishes d ON d.id = dr.dish_id
       JOIN dish_categories dc ON dc.id = d.category_id
       WHERE dr.restaurant_id = ?
       ORDER BY d.name ASC`, [restId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch dishes for restaurant', detail: String(e?.message || e) });
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
    console.error(e);
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
    await pool.query(
      `DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`,
      [dishId, restId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to unlink dish & restaurant', detail: String(e?.message || e) });
  }
});

/** Analytics */
app.get('/api/admin/analytics/summary', async (_req, res) => {
  try {
    // totals
    const [[{ c: muniCount }]] = await pool.query('SELECT COUNT(*) c FROM municipalities');
    const [[{ c: dishCount }]] = await pool.query('SELECT COUNT(*) c FROM dishes');
    const [[{ c: restCount }]] = await pool.query('SELECT COUNT(*) c FROM restaurants');
    const [[{ c: linkCount }]] = await pool.query('SELECT COUNT(*) c FROM dish_restaurants');

    // by municipality (signature dishes / featured restaurants if columns exist)
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
      totals: {
        municipalities: muniCount,
        dishes: dishCount,
        restaurants: restCount,
        links: linkCount,
      },
      byMunicipality: byMuni,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed analytics', detail: String(e?.message || e) });
  }
});

/* =========================
   Start server
   ========================= */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
