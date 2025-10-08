// api/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
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

app.get('/api/dishes', async (req, res) => {
  try {
    const { municipalityId, category, q } = req.query;

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

    const sql = `
      SELECT
        d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
        d.flavor_profile, d.ingredients,
        m.id AS municipality_id, m.name AS municipality_name,
        c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY d.popularity DESC, d.name ASC
      LIMIT 200
    `;

    console.log('[GET] /api/dishes where=', where.join(' AND ') || '(none)', 'params=', params);
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('MUNICIPALITIES ERROR:', e);
    res.status(500).json({ error: 'Failed to fetch dishes', detail: String(e?.message || e) });
  }
});

app.get('/api/restaurants', async (req, res) => {
  try {
    const { municipalityId, dishId, kind, q } = req.query;

    const where = [];
    const params = [];

    // If filtering by dish, join via dish_restaurants
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
      // use FULLTEXT if available, fallback to LIKE
      where.push('(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)');
      params.push(String(q), `%${String(q)}%`);
    }

    const sql = `
      SELECT
        r.id, r.name, r.slug, r.kind,
        r.description, r.address, r.phone, r.website,
        r.facebook, r.instagram, r.opening_hours,
        r.price_range, r.cuisine_types, r.rating, r.lat, r.lng
      FROM restaurants r
      ${joinDish}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY r.rating DESC, r.name ASC
      LIMIT 200
    `;

    console.log('[GET] /api/restaurants where=', where.join(' AND ') || '(none)', 'params=', params);
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
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid municipality id' });
    }

    const sql = `
      SELECT
        d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
        d.flavor_profile, d.ingredients,
        m.id AS municipality_id, m.name AS municipality_name,
        c.code AS category
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      WHERE d.municipality_id = ?
      ORDER BY d.popularity DESC, d.name ASC
      LIMIT 200
    `;

    const [rows] = await pool.query(sql, [id]);
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
              r.rating, r.lat, r.lng
       FROM restaurants r
       WHERE r.municipality_id = ?
       ORDER BY r.rating DESC, r.name ASC
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
