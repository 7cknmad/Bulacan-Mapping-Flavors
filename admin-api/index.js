import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import morgan from 'morgan';

/* --------------------------------------------------------------------------
   App setup
----------------------------------------------------------------------------*/
const app = express();
app.set('trust proxy', 1); // so Secure cookies work behind proxies (Cloudflare)
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('tiny'));
app.get('/whoami', (_req, res) => res.json({ service: 'admin-api', hasAuth: true }));

/* --------------------------------------------------------------------------
   CORS — allow GH Pages + local dev + optional extra origins via env
   - Your frontend uses credentials: 'include', so we must return
     Access-Control-Allow-Credentials: true and a specific origin.
----------------------------------------------------------------------------*/
const DEFAULT_FRONTEND = process.env.GH_PAGES_ORIGIN || 'https://7cknmad.github.io';
const allowOrigins = new Set([
  DEFAULT_FRONTEND,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173', // vite preview
]);
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => allowOrigins.add(o));
}

const corsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true); // curl/health checks
  try {
    const url = new URL(origin);
    const ok = allowOrigins.has(origin) || url.hostname.endsWith('.trycloudflare.com');
    return cb(ok ? null : new Error(`Not allowed by CORS: ${origin}`), ok);
  } catch {
    return cb(new Error('Invalid Origin'), false);
  }
};

const corsConfig = {
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsConfig));
app.options('*', cors(corsConfig));

/* --------------------------------------------------------------------------
   Health (quick sanity endpoint)
----------------------------------------------------------------------------*/
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* --------------------------------------------------------------------------
   Auth (JWT in HttpOnly cookie) — /auth/login, /auth/me, /auth/logout
----------------------------------------------------------------------------*/
const {
  ADMIN_JWT_SECRET = 'dev-secret-change-me',
  ADMIN_EMAIL = 'admin@example.com',
  ADMIN_PASSWORD_HASH = '',
  ADMIN_PASSWORD, 
} = process.env;

function sign(user) {
  return jwt.sign({ uid: user.id, email: user.email, role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '7d' });
}
function setAuthCookie(res, token) {
  res.cookie('bmf_admin', token, {
  httpOnly: true,
  secure: true,      // required with SameSite=None
  sameSite: 'none',  // cross-site (GH Pages -> tunnel)
  partitioned: true, // <-- IMPORTANT on modern Chrome
  path: '/',
  maxAge: 7 * 24 * 3600 * 1000,
});
}
function authRequired(req, res, next) {
  const t = req.cookies?.bmf_admin;
  if (!t) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(t, ADMIN_JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });
  if (String(email).toLowerCase() !== String(ADMIN_EMAIL).toLowerCase()) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  if (ADMIN_PASSWORD_HASH) {
    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  } else if (ADMIN_PASSWORD) {
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid_credentials' });
  } else {
    return res.status(500).json({ error: 'server_not_configured' });
  }
  const token = sign({ id: 'admin', email });
  setAuthCookie(res, token);
  res.json({ ok: true, user: { id: 'admin', email, name: 'Administrator', role: 'admin' } });
});

app.post('/auth/logout', (_req, res) => {
  res.clearCookie('bmf_admin', { path: '/', sameSite: 'none', secure: true });
  res.json({ ok: true });
});

app.get('/auth/me', (req, res) => {
  const t = req.cookies?.bmf_admin;
  if (!t) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = jwt.verify(t, ADMIN_JWT_SECRET);
    res.json({ user: { id: p.uid || 'admin', email: p.email, name: 'Administrator', role: 'admin' } });
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
});

/* --------------------------------------------------------------------------
   Public routes — keep these OPEN
   Paste your existing /api/* endpoints below (unchanged)
----------------------------------------------------------------------------*/
// Example:
// app.get('/api/municipalities', async (req, res) => { ... });
// app.get('/api/dishes', async (req, res) => { ... });
// app.get('/api/restaurants', async (req, res) => { ... });

/* --------------------------------------------------------------------------
   Protect ALL /admin/* routes
   Put this BEFORE you define or mount your /admin handlers.
----------------------------------------------------------------------------*/
app.use('/admin', authRequired);

/* --------------------------------------------------------------------------
   Admin routes — keep your existing handlers here
----------------------------------------------------------------------------*/
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

// New: the endpoints your UI was callinga
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_credentials" });
  if (String(email).toLowerCase() !== String(ADMIN_EMAIL).toLowerCase())
    return res.status(401).json({ error: "invalid_credentials" });

  if (!ADMIN_PASSWORD_HASH) {
    // temporary bootstrap path (set ADMIN_PASSWORD in env if you want to use this)
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
  } else {
    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  }

  const token = sign({ id: "admin", email });
  setAuthCookie(res, token);
  res.json({ ok: true, user: { id: "admin", email, name: "Administrator", role: "admin" } });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie('bmf_admin', {
  path: '/',
  sameSite: 'none',
  secure: true,
  partitioned: true, // keep attributes consistent
});
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  const t = req.cookies?.bmf_admin;
  if (!t) return res.status(401).json({ error: "unauthorized" });
  try {
    const p = jwt.verify(t, ADMIN_JWT_SECRET);
    res.json({ user: { id: p.uid || "admin", email: p.email, name: "Administrator", role: "admin" } });
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
});
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

/* --------------------------------------------------------------------------
   404 + server start
----------------------------------------------------------------------------*/
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Admin API listening on ${PORT}`);
  console.log(`Allowed origins: ${[...allowOrigins].join(', ')}`);
});
