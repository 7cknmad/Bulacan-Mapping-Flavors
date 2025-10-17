// admin-api/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

/* ---------------- CORS ---------------- */
const baseAllowed = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'https://7cknmad.github.io'
]);
if (process.env.ALLOWED_ORIGINS) {
  for (const o of process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) {
    baseAllowed.add(o);
  }
}
function isAllowedOrigin(origin) {
  if (!origin) return true; // curl/postman
  if (baseAllowed.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith('.trycloudflare.com')) return true;
  } catch {}
  return false;
}
const corsOptions = {
  origin: (origin, cb) => isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`)),
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

/* --------------- DB ------------------- */
const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'bulacan_flavors',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
};

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

  console.log('🧭 Admin schema:', { dishes: [...schema.dishes], restaurants: [...schema.restaurants] });
}

(async () => {
  pool = mysql.createPool(cfg);
  const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
  console.log('✅ Admin API connected to DB:', db);
  await loadSchemaInfo();
})().catch(e => console.error('❌ Admin API DB init error:', e));

/* ------------- helpers --------------- */
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

/* ------------- health + lookups ------ */
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

/* ------------- analytics ------------- */
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

// New: the endpoints your UI was calling
app.get('/admin/analytics/municipality-counts', async (_req, res) => {
  try { res.json(await buildPerMunicipalityCounts()); }
  catch (e) { res.status(500).json({ error: 'Failed per-municipality', detail: String(e?.message || e) }); }
});
app.get('/admin/analytics/per-municipality', async (req, res) => {
  try { res.json(await buildPerMunicipalityCounts()); }
  catch (e) { res.status(500).json({ error: 'Failed per-municipality', detail: String(e?.message || e) }); }
});
app.get('/admin/analytics/per_municipality', async (req, res) => {
  try { res.json(await buildPerMunicipalityCounts()); }
  catch (e) { res.status(500).json({ error: 'Failed per_municipality', detail: String(e?.message || e) }); }
});

/* ------------- dishes (CRUD) --------- */
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
    ORDER BY ${hasD('panel_rank')?'COALESCE(d.panel_rank,999),':''} d.name ASC
    LIMIT ${Number(limit)||500}`;
  const [rows] = await pool.query(sql, p);
  res.json(rows);
});

app.post('/admin/dishes', async (req, res) => {
  try {
    const {
      municipality_id, name, slug, description, image_url,
      category, flavor_profile, ingredients, popularity, rating,
      is_signature, panel_rank,
    } = req.body;

    if (!municipality_id || !name || !category) {
      return res.status(400).json({ error: 'municipality_id, name, category are required' });
    }
    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [String(category)]);
    if (!cat) return res.status(400).json({ error: 'Invalid category code' });

    const payload = {
      municipality_id: Number(municipality_id),
      category_id: cat.id,
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

    const fields = Object.keys(payload);
    const placeholders = fields.map(()=>'?').join(',');
    const values = fields.map(k => payload[k]);
    const [result] = await pool.query(
      `INSERT INTO dishes (${fields.join(',')}) VALUES (${placeholders})`, values);
    res.json({ id: result.insertId, ...payload });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create dish', detail: String(e?.message || e) });
  }
});

app.patch('/admin/dishes/:id', async (req, res) => {
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
    if ('category' in req.body && req.body.category) {
      const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [String(req.body.category)]);
      if (!cat) return res.status(400).json({ error: 'Invalid category code' });
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

/* ---------- linking & curation ------ */
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
app.patch('/admin/curate/dishes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { is_signature, panel_rank } = req.body || {};
  const up = {};
  if (hasD('is_signature') && is_signature != null) up.is_signature = is_signature ? 1 : 0;
  if (hasD('panel_rank')) up.panel_rank = panel_rank == null ? null : Number(panel_rank);
  const sets = Object.keys(up).map(k => `${k}=?`); const vals = Object.keys(up).map(k => up[k]);
  if (!sets.length) return res.json({ ok: true });
  await pool.query(`UPDATE dishes SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
  res.json({ ok: true });
});
app.patch('/admin/curate/restaurants/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { featured, featured_rank } = req.body || {};
  const up = {};
  if (hasR('featured') && featured != null) up.featured = featured ? 1 : 0;
  if (hasR('featured_rank')) up.featured_rank = featured_rank == null ? null : Number(featured_rank);
  const sets = Object.keys(up).map(k => `${k}=?`); const vals = Object.keys(up).map(k => up[k]);
  if (!sets.length) return res.json({ ok: true });
  await pool.query(`UPDATE restaurants SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
  res.json({ ok: true });
});

/* ------------- start ----------------- */
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`🛠️ Admin API running at http://localhost:${PORT}`));
