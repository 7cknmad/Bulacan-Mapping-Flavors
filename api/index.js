// api/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://7cknmad.github.io',
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

/* ----------------------- Public endpoints ----------------------- */

// Municipalities
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

// Dishes (now supports signature & limit)
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
      where.push('(MATCH(d.name,d.description) AGAINST(? IN NATURAL LANGUAGE MODE))');
      params.push(String(q));
    }
    if (String(signature || '') === '1') {
      // Either explicitly marked as signature or ranked for panel
      where.push('(d.is_signature = 1 OR d.panel_rank IS NOT NULL)');
    }

    const lim = Math.min(Number(limit) || 200, 500);

    const sql = `
      SELECT
        d.id, d.name, d.slug, d.description, d.image_url,
        d.rating, d.popularity, d.is_signature, d.panel_rank,
        d.flavor_profile, d.ingredients,
        m.id AS municipality_id, m.name AS municipality_name,
        c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        (d.is_signature = 1 OR d.panel_rank IS NOT NULL) DESC,
        d.panel_rank IS NULL, d.panel_rank ASC,
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

// Restaurants (now supports featured & dishId & limit)
app.get('/api/restaurants', async (req, res) => {
  try {
    const { municipalityId, dishId, kind, q, featured, limit } = req.query;

    const where = [];
    const params = [];
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
    if (String(featured || '') === '1') {
      where.push('(r.featured = 1 OR r.featured_rank IS NOT NULL)');
    }

    const lim = Math.min(Number(limit) || 200, 500);

    const sql = `
      SELECT
        r.id, r.name, r.slug, r.kind,
        r.description, r.address, r.phone, r.website,
        r.facebook, r.instagram, r.opening_hours,
        r.price_range, r.cuisine_types, r.rating, r.lat, r.lng,
        r.featured, r.featured_rank
      FROM restaurants r
      ${joinDish}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        (r.featured = 1 OR r.featured_rank IS NOT NULL) DESC,
        r.featured_rank IS NULL, r.featured_rank ASC,
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

app.get('/api/municipalities/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid municipality id' });

    const [rows] = await pool.query(
      `SELECT
         d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
         d.is_signature, d.panel_rank, d.flavor_profile, d.ingredients,
         m.id AS municipality_id, m.name AS municipality_name,
         c.code AS category
       FROM dishes d
       JOIN municipalities m ON m.id = d.municipality_id
       JOIN dish_categories c ON c.id = d.category_id
       WHERE d.municipality_id = ?
       ORDER BY
         (d.is_signature = 1 OR d.panel_rank IS NOT NULL) DESC,
         d.panel_rank IS NULL, d.panel_rank ASC,
         d.popularity DESC, d.name ASC
       LIMIT 200`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/municipalities/:id/dishes ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch municipality dishes', detail: String(e?.message || e) });
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
       ORDER BY
         (r.featured = 1 OR r.featured_rank IS NOT NULL) DESC,
         r.featured_rank IS NULL, r.featured_rank ASC,
         r.rating DESC, r.name ASC`,
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
              d.is_signature, d.panel_rank,
              JSON_EXTRACT(d.flavor_profile, '$') AS flavor_profile,
              JSON_EXTRACT(d.ingredients, '$')     AS ingredients,
              dc.code AS category, d.municipality_id
       FROM dish_restaurants dr
       INNER JOIN dishes d        ON d.id = dr.dish_id
       INNER JOIN dish_categories dc ON dc.id = d.category_id
       WHERE dr.restaurant_id = ?
       ORDER BY
         d.panel_rank IS NULL, d.panel_rank ASC,
         d.popularity DESC, d.name ASC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('RESTO DISHES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes for restaurant', detail: String(e?.message || e) });
  }
});

/* ----------------------- Admin endpoints ----------------------- */

// minimal auth stub (replace with real auth/JWT if needed)
app.get('/api/admin/auth/me', (req, res) => res.json({ ok: true, user: { id: 1, name: 'Admin' } }));

// Create/Update/Delete Dish
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
         image_url=VALUES(image_url), popularity=VALUES(popularity), rating=VALUES(rating),
         is_signature=VALUES(is_signature), panel_rank=VALUES(panel_rank)`,
      [municipality_id, cat.id, name, slug, description,
       JSON.stringify(flavor_profile), JSON.stringify(ingredients), history,
       image_url, popularity, rating, is_signature ? 1 : 0, panel_rank]
    );
    const id = r.insertId || (await pool.query(`SELECT id FROM dishes WHERE slug=?`, [slug]))[0][0]?.id;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save dish', detail: String(e.message || e) });
  }
});

app.patch('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });

    const fields = [];
    const params = [];

    const allow = [
      'name','slug','description','image_url','popularity','rating',
      'history','flavor_profile','ingredients','municipality_id',
      'is_signature','panel_rank'
    ];
    for (const key of allow) {
      if (req.body[key] !== undefined) {
        if (['flavor_profile','ingredients'].includes(key)) {
          fields.push(`${key}=?`); params.push(JSON.stringify(req.body[key]));
        } else if (key === 'is_signature') {
          fields.push(`${key}=?`); params.push(req.body[key] ? 1 : 0);
        } else {
          fields.push(`${key}=?`); params.push(req.body[key]);
        }
      }
    }
    if (fields.length === 0) return res.json({ ok: true });

    const sql = `UPDATE dishes SET ${fields.join(', ')} WHERE id=?`;
    params.push(id);
    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update dish', detail: String(e.message || e) });
  }
});

app.delete('/api/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid dish id' });
    await pool.query(`DELETE FROM dishes WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete dish', detail: String(e.message || e) });
  }
});

// Create/Update/Delete Restaurant
app.post('/api/admin/restaurants', async (req, res) => {
  try {
    const {
      municipality_id, name, slug, kind = 'restaurant',
      address, lat, lng, description = null,
      price_range = 'moderate', cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0, image_url = null, featured = 0, featured_rank = null
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
    res.status(500).json({ error: 'Failed to create restaurant', detail: String(e.message || e) });
  }
});

app.patch('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid restaurant id' });

    const fields = [];
    const params = [];
    const allow = [
      'name','slug','kind','description','address','phone','email',
      'website','facebook','instagram','opening_hours','price_range','cuisine_types',
      'rating','lat','lng','image_url','featured','featured_rank','municipality_id'
    ];
    for (const key of allow) {
      if (req.body[key] !== undefined) {
        if (key === 'cuisine_types') {
          fields.push(`${key}=?`); params.push(JSON.stringify(req.body[key]));
        } else if (key === 'featured') {
          fields.push(`${key}=?`); params.push(req.body[key] ? 1 : 0);
        } else {
          fields.push(`${key}=?`); params.push(req.body[key]);
        }
      }
    }
    // refresh point if lat/lng present
    if (req.body.lat != null && req.body.lng != null) {
      fields.push(`location_pt = ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)`);
      params.push(req.body.lng, req.body.lat);
    }

    if (fields.length === 0) return res.json({ ok: true });
    const sql = `UPDATE restaurants SET ${fields.join(', ')} WHERE id=?`;
    params.push(id);
    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update restaurant', detail: String(e.message || e) });
  }
});

app.delete('/api/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid restaurant id' });
    await pool.query(`DELETE FROM restaurants WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete restaurant', detail: String(e.message || e) });
  }
});

// Linking
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
    console.error(e);
    res.status(500).json({ error: 'Failed to link dish & restaurant', detail: String(e.message || e) });
  }
});

app.delete('/api/admin/dish-restaurants', async (req, res) => {
  try {
    const { dish_id, restaurant_id } = req.query;
    const d = Number(dish_id), r = Number(restaurant_id);
    if (!Number.isFinite(d) || !Number.isFinite(r)) return res.status(400).json({ error: 'dish_id and restaurant_id required' });
    await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [d, r]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to unlink dish & restaurant', detail: String(e.message || e) });
  }
});

// Admin convenience lookups used by dashboard
app.get('/api/admin/dishes/:dishId/restaurants', async (req, res) => {
  try {
    const dishId = Number(req.params.dishId);
    if (!Number.isFinite(dishId)) return res.status(400).json({ error: 'Invalid dish id' });
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.slug, r.address, r.price_range, r.rating,
              dr.price_note, dr.availability
       FROM dish_restaurants dr
       JOIN restaurants r ON r.id = dr.restaurant_id
       WHERE dr.dish_id = ?
       ORDER BY r.name`, [dishId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch restaurants for dish', detail: String(e.message || e) });
  }
});

app.get('/api/admin/restaurants/:restId/dishes', async (req, res) => {
  try {
    const restId = Number(req.params.restId);
    if (!Number.isFinite(restId)) return res.status(400).json({ error: 'Invalid restaurant id' });
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.slug, d.category_id, dc.code AS category,
              dr.price_note, dr.availability
       FROM dish_restaurants dr
       JOIN dishes d ON d.id = dr.dish_id
       JOIN dish_categories dc ON dc.id = d.category_id
       WHERE dr.restaurant_id = ?
       ORDER BY d.name`, [restId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch dishes for restaurant', detail: String(e.message || e) });
  }
});

// Analytics (simple summary for charts)
app.get('/api/admin/analytics/summary', async (_req, res) => {
  try {
    const [[totals]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM municipalities) AS municipalities,
        (SELECT COUNT(*) FROM dishes) AS dishes,
        (SELECT COUNT(*) FROM dishes d JOIN dish_categories c ON c.id=d.category_id WHERE c.code='food') AS dishes_food,
        (SELECT COUNT(*) FROM dishes d JOIN dish_categories c ON c.id=d.category_id WHERE c.code='delicacy') AS dishes_delicacy,
        (SELECT COUNT(*) FROM dishes d JOIN dish_categories c ON c.id=d.category_id WHERE c.code='drink') AS dishes_drink,
        (SELECT COUNT(*) FROM restaurants) AS restaurants
    `);

    const [byMuni] = await pool.query(`
      SELECT
        m.id, m.name, m.slug,
        COUNT(DISTINCT d.id) AS dish_count,
        SUM(CASE WHEN d.is_signature=1 OR d.panel_rank IS NOT NULL THEN 1 ELSE 0 END) AS signature_count,
        COUNT(DISTINCT r.id) AS restaurant_count,
        SUM(CASE WHEN r.featured=1 OR r.featured_rank IS NOT NULL THEN 1 ELSE 0 END) AS featured_restaurant_count
      FROM municipalities m
      LEFT JOIN dishes d ON d.municipality_id = m.id
      LEFT JOIN restaurants r ON r.municipality_id = m.id
      GROUP BY m.id
      ORDER BY m.name
    `);

    res.json({ totals, byMuni });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to compute analytics', detail: String(e.message || e) });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: row.ok === 1, db: cfg.database });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
