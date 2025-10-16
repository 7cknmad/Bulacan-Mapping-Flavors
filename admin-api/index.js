import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

/* ------------------------- Env & DB ------------------------- */
const PORT = Number(process.env.PORT ?? 3002);
const DB_HOST = process.env.DB_HOST ?? '127.0.0.1';
const DB_USER = process.env.DB_USER ?? 'root';          // if you don’t use a user, root/"" is common locally
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';      // blank password supported
const DB_NAME = process.env.DB_NAME ?? 'bulacan_flavors';

// Admin app origins (no credentials used → simple CORS)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://7cknmad.github.io')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedSet = new Set(ALLOWED_ORIGINS);

const pool = mysql.createPool({
  host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  waitForConnections: true, connectionLimit: 10, namedPlaceholders: true
});

/* ---- Introspect columns so we never write a non-existent column ---- */
const tableCols = new Map(); // table -> Set(columns)
async function getCols(table) {
  if (tableCols.has(table)) return tableCols.get(table);
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  const set = new Set(rows.map(r => r.Field));
  tableCols.set(table, set);
  return set;
}
function onlyKnown(table, obj, colsSet) {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (colsSet.has(k)) out[k] = v;
  }
  return out;
}

// Normalize array-like fields to JSON strings (DB often stores as text)
// skip if value is null/undefined
function toDbJSON(val) {
  if (val == null) return val;
  if (Array.isArray(val)) return JSON.stringify(val);
  // accept already-json string; otherwise split CSV
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t) return null;
    try { const parsed = JSON.parse(t); if (Array.isArray(parsed)) return JSON.stringify(parsed); } catch {}
    return JSON.stringify(t.split(',').map(s => s.trim()).filter(Boolean));
  }
  return JSON.stringify([String(val)]);
}

/* ------------------------- App & CORS ------------------------- */
const app = express();
app.use(express.json({ limit: '1mb' }));

app.use(cors({
  origin(origin, cb) {
    // Allow same-origin/non-browser and allowed list
    if (!origin) return cb(null, true);
    if (allowedSet.has('*') || allowedSet.has(origin)) return cb(null, true);
    return cb(new Error(`CORS: Origin not allowed: ${origin}`), false);
  }
  // We do NOT use credentials here on purpose.
}));

/* ------------------------- Health ------------------------- */
app.get('/admin/health', (req, res) => {
  res.json({ ok: true, service: 'admin-api' });
});

/* ------------------------- Analytics ------------------------- */
app.get('/admin/analytics/summary', async (req, res) => {
  try {
    const [[{ cDishes }]] = await pool.query('SELECT COUNT(*) AS cDishes FROM dishes');
    const [[{ cRestaurants }]] = await pool.query('SELECT COUNT(*) AS cRestaurants FROM restaurants');

    const [perMunicipality] = await pool.query(`
      SELECT m.id, m.name, m.slug,
        (SELECT COUNT(*) FROM dishes d WHERE d.municipality_id=m.id) AS dishes,
        (SELECT COUNT(*) FROM restaurants r WHERE r.municipality_id=m.id) AS restaurants
      FROM municipalities m
      ORDER BY m.slug ASC
    `);

    const [topDishes] = await pool.query(`
      SELECT id, name, panel_rank
      FROM dishes
      WHERE is_signature=1
      ORDER BY (panel_rank IS NULL), panel_rank ASC
      LIMIT 5
    `);

    const [topRestaurants] = await pool.query(`
      SELECT id, name, featured_rank
      FROM restaurants
      WHERE featured=1
      ORDER BY (featured_rank IS NULL), featured_rank ASC
      LIMIT 5
    `);

    res.json({
      counts: { dishes: cDishes, restaurants: cRestaurants },
      perMunicipality,
      topDishes,
      topRestaurants
    });
  } catch (e) {
    res.status(500).json({ error: 'analytics_failed', detail: String(e) });
  }
});

/* ------------------------- Dishes CRUD ------------------------- */
// CREATE
app.post('/admin/dishes', async (req, res) => {
  try {
    const cols = await getCols('dishes');
    // normalize array fields if present
    const body = { ...req.body };
    if ('flavor_profile' in body) body.flavor_profile = toDbJSON(body.flavor_profile);
    if ('ingredients' in body) body.ingredients = toDbJSON(body.ingredients);

    const row = onlyKnown('dishes', body, cols);
    if (!Object.keys(row).length) return res.status(400).json({ error: 'no_valid_fields' });

    const keys = Object.keys(row);
    const placeholders = keys.map(k => `:${k}`).join(', ');
    await pool.query(`INSERT INTO dishes (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`, row);
    const [[{ id }]] = await pool.query('SELECT LAST_INSERT_ID() AS id');
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'create_dish_failed', detail: String(e) });
  }
});

// UPDATE
app.patch('/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cols = await getCols('dishes');
    const body = { ...req.body };
    if ('flavor_profile' in body) body.flavor_profile = toDbJSON(body.flavor_profile);
    if ('ingredients' in body) body.ingredients = toDbJSON(body.ingredients);
    const row = onlyKnown('dishes', body, cols);
    if (!Object.keys(row).length) return res.json({ ok: true, updated: 0 });

    const setSql = Object.keys(row).map(k => `\`${k}\`=:${k}`).join(', ');
    await pool.query(`UPDATE dishes SET ${setSql} WHERE id=:id`, { ...row, id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'update_dish_failed', detail: String(e) });
  }
});

// DELETE
app.delete('/admin/dishes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM dish_restaurants WHERE dish_id=?', [id]);
    await pool.query('DELETE FROM dishes WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'delete_dish_failed', detail: String(e) });
  }
});

/* ------------------------- Restaurants CRUD ------------------------- */
// CREATE
app.post('/admin/restaurants', async (req, res) => {
  try {
    const cols = await getCols('restaurants');
    const body = { ...req.body };
    if ('cuisine_types' in body) body.cuisine_types = toDbJSON(body.cuisine_types);
    const row = onlyKnown('restaurants', body, cols);
    if (!Object.keys(row).length) return res.status(400).json({ error: 'no_valid_fields' });

    const keys = Object.keys(row);
    const placeholders = keys.map(k => `:${k}`).join(', ');
    await pool.query(`INSERT INTO restaurants (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`, row);
    const [[{ id }]] = await pool.query('SELECT LAST_INSERT_ID() AS id');
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'create_restaurant_failed', detail: String(e) });
  }
});

// UPDATE
app.patch('/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cols = await getCols('restaurants');
    const body = { ...req.body };
    if ('cuisine_types' in body) body.cuisine_types = toDbJSON(body.cuisine_types);
    const row = onlyKnown('restaurants', body, cols);
    if (!Object.keys(row).length) return res.json({ ok: true, updated: 0 });

    const setSql = Object.keys(row).map(k => `\`${k}\`=:${k}`).join(', ');
    await pool.query(`UPDATE restaurants SET ${setSql} WHERE id=:id`, { ...row, id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'update_restaurant_failed', detail: String(e) });
  }
});

// DELETE
app.delete('/admin/restaurants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM dish_restaurants WHERE restaurant_id=?', [id]);
    await pool.query('DELETE FROM restaurants WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'delete_restaurant_failed', detail: String(e) });
  }
});

/* ------------------------- Linking (dish ↔ restaurants) ------------------------- */
// LIST restaurants linked to a dish
app.get('/admin/dishes/:id/restaurants', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`
      SELECT r.*
      FROM dish_restaurants dr
      JOIN restaurants r ON r.id=dr.restaurant_id
      WHERE dr.dish_id=?`, [id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'linked_restaurants_failed', detail: String(e) });
  }
});

// LIST dishes linked to a restaurant
app.get('/admin/restaurants/:id/dishes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`
      SELECT d.*
      FROM dish_restaurants dr
      JOIN dishes d ON d.id=dr.dish_id
      WHERE dr.restaurant_id=?`, [id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'linked_dishes_failed', detail: String(e) });
  }
});

// LINK (idempotent)
app.post('/admin/dish-restaurants', async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note = null, availability = 'regular' } = req.body ?? {};
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'dish_id_and_restaurant_id_required' });

    // ensure table & columns exist dynamically
    const cols = await getCols('dish_restaurants');
    const row = onlyKnown('dish_restaurants', { dish_id, restaurant_id, price_note, availability }, cols);
    const keys = Object.keys(row);
    const placeholders = keys.map(k => `:${k}`).join(', ');
    await pool.query(
      `INSERT IGNORE INTO dish_restaurants (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`,
      row
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'link_failed', detail: String(e) });
  }
});

// UNLINK
app.delete('/admin/dish-restaurants', async (req, res) => {
  try {
    const dish_id = Number(req.query.dish_id);
    const restaurant_id = Number(req.query.restaurant_id);
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: 'dish_id_and_restaurant_id_required' });
    await pool.query('DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?', [dish_id, restaurant_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'unlink_failed', detail: String(e) });
  }
});

/* ------------------------- 404 & Error ------------------------- */
app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}`);
  console.log(`Allowed CORS origins: ${[...allowedSet].join(', ')}`);
});
