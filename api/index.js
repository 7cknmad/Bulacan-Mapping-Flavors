// api/index.js
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();

// ---------- CORS (must allow credentials) ----------
const allowed = new Set([
  "http://localhost:5173",                 // Vite dev
  "http://127.0.0.1:5173",
  "https://7cknmad.github.io",             // GitHub Pages origin
]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);           // Postman/cURL
    if (allowed.has(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser());

// ---------- DB Pool ----------
const cfg = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "bulacan_flavors",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
};
let pool;
(async () => {
  pool = mysql.createPool(cfg);
  const [[{ db }]] = await pool.query("SELECT DATABASE() AS db");
  console.log("✅ Connected to DB:", db);
})().catch(e => {
  console.error("❌ DB init error:", e);
  process.exit(1);
});

// ---------- Sessions (cookie) ----------
const isProd = process.env.NODE_ENV === "production";
app.set("trust proxy", 1); // behind tunnel/proxy
app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret_change_me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,                 // true on https (GitHub Pages -> tunnel)
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// ---------- Helpers ----------
const normalizeDish = (row) => ({
  ...row,
  flavor_profile: Array.isArray(row.flavor_profile)
    ? row.flavor_profile
    : (row.flavor_profile ? JSON.parse(row.flavor_profile) : []),
  ingredients: Array.isArray(row.ingredients)
    ? row.ingredients
    : (row.ingredients ? JSON.parse(row.ingredients) : []),
});

const normalizeRestaurant = (row) => ({
  ...row,
  cuisine_types: Array.isArray(row.cuisine_types)
    ? row.cuisine_types
    : (row.cuisine_types ? JSON.parse(row.cuisine_types) : []),
});

// ---------- Public API ----------
app.get("/api/health", async (_req, res) => {
  try {
    const [[row]] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: row.ok === 1, db: cfg.database });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/municipalities", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, description, province, lat, lng, image_url
       FROM municipalities
       ORDER BY name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch municipalities", detail: String(e?.message || e) });
  }
});

app.get("/api/dishes", async (req, res) => {
  try {
    const { municipalityId, category, q } = req.query;
    const where = [];
    const params = [];

    if (municipalityId) { where.push("d.municipality_id = ?"); params.push(Number(municipalityId)); }
    if (category)       { where.push("c.code = ?"); params.push(String(category)); }
    if (q) {
      where.push("(MATCH(d.name, d.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR d.name LIKE ?)");
      params.push(String(q), `%${String(q)}%`);
    }

    const sql = `
      SELECT
        d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
        d.flavor_profile, d.ingredients, d.municipality_id, m.name AS municipality_name,
        c.code AS category, d.featured, d.featured_rank
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY d.popularity DESC, d.name ASC
      LIMIT 500
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalizeDish));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch dishes", detail: String(e?.message || e) });
  }
});

app.get("/api/restaurants", async (req, res) => {
  try {
    const { municipalityId, dishId, kind, q } = req.query;
    const where = [];
    const params = [];

    const joinDish = dishId ? "INNER JOIN dish_restaurants dr ON dr.restaurant_id = r.id AND dr.dish_id = ?" : "";
    if (dishId) params.push(Number(dishId));
    if (municipalityId) { where.push("r.municipality_id = ?"); params.push(Number(municipalityId)); }
    if (kind)           { where.push("r.kind = ?"); params.push(String(kind)); }
    if (q) {
      where.push("(MATCH(r.name, r.description) AGAINST(? IN NATURAL LANGUAGE MODE) OR r.name LIKE ?)");
      params.push(String(q), `%${String(q)}%`);
    }

    const sql = `
      SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
             r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
             r.rating, r.lat, r.lng, r.signature, r.signature_rank
      FROM restaurants r
      ${joinDish}
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.rating DESC, r.name ASC
      LIMIT 500
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalizeRestaurant));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch restaurants", detail: String(e?.message || e) });
  }
});

// ---------- Admin Auth ----------
const requireAdmin = (req, res, next) => {
  if (req.session?.user?.role === "admin") return next();
  return res.status(401).json({ error: "Unauthorized" });
};

app.post("/api/admin/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
  const ADMIN_PASS  = process.env.ADMIN_PASSWORD || "admin123";

  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    req.session.user = { email, role: "admin" };
    return res.json({ ok: true, user: { email } });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

app.get("/api/admin/auth/me", (req, res) => {
  if (req.session?.user?.role === "admin") return res.json({ user: { email: req.session.user.email } });
  return res.status(401).json({ error: "Unauthorized" });
});

app.post("/api/admin/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------- Admin CRUD: Dishes ----------
app.get("/api/admin/dishes", requireAdmin, async (req, res) => {
  try {
    const { municipalityId, q } = req.query;
    const where = [];
    const params = [];
    if (municipalityId) { where.push("d.municipality_id = ?"); params.push(Number(municipalityId)); }
    if (q) { where.push("(d.name LIKE ? OR d.description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }

    const sql = `
      SELECT d.id, d.name, d.slug, d.description, d.image_url, d.rating, d.popularity,
             d.flavor_profile, d.ingredients, d.municipality_id, m.name AS municipality_name,
             c.code AS category, d.featured, d.featured_rank
      FROM dishes d
      JOIN municipalities m ON m.id = d.municipality_id
      JOIN dish_categories c ON c.id = d.category_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY d.id DESC
      LIMIT 1000
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalizeDish));
  } catch (e) {
    res.status(500).json({ error: "Admin list dishes failed", detail: String(e?.message || e) });
  }
});

app.post("/api/admin/dishes", requireAdmin, async (req, res) => {
  try {
    const {
      municipality_id, category = "food", name, slug,
      description = null, flavor_profile = [], ingredients = [],
      history = null, image_url = null, popularity = 0, rating = 0
    } = req.body;
    if (!municipality_id || !name || !slug) return res.status(400).json({ error: "Missing required fields" });

    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [category]);
    if (!cat) return res.status(400).json({ error: "Unknown category" });

    const [r] = await pool.query(`
      INSERT INTO dishes
        (municipality_id, category_id, name, slug, description, flavor_profile, ingredients, history, image_url, popularity, rating)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [municipality_id, cat.id, name, slug, description, JSON.stringify(flavor_profile), JSON.stringify(ingredients),
       history, image_url, popularity, rating]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    res.status(500).json({ error: "Create dish failed", detail: String(e?.message || e) });
  }
});

app.put("/api/admin/dishes/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      municipality_id, category = "food", name, slug,
      description = null, flavor_profile = [], ingredients = [],
      history = null, image_url = null, popularity = 0, rating = 0
    } = req.body;
    if (!municipality_id || !name || !slug) return res.status(400).json({ error: "Missing required fields" });

    const [[cat]] = await pool.query(`SELECT id FROM dish_categories WHERE code=?`, [category]);
    if (!cat) return res.status(400).json({ error: "Unknown category" });

    await pool.query(`
      UPDATE dishes SET
        municipality_id=?, category_id=?, name=?, slug=?, description=?, flavor_profile=?, ingredients=?,
        history=?, image_url=?, popularity=?, rating=?
      WHERE id=?`,
      [municipality_id, cat.id, name, slug, description, JSON.stringify(flavor_profile), JSON.stringify(ingredients),
       history, image_url, popularity, rating, id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Update dish failed", detail: String(e?.message || e) });
  }
});

app.delete("/api/admin/dishes/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM dishes WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Delete dish failed", detail: String(e?.message || e) });
  }
});

// Feature/Rank (Top 3)
app.post("/api/admin/dishes/:id/feature", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { featured = 0, rank = null } = req.body;
    await pool.query(`UPDATE dishes SET featured=?, featured_rank=? WHERE id=?`,
      [Number(!!featured), rank, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Set dish featured failed", detail: String(e?.message || e) });
  }
});

// ---------- Admin CRUD: Restaurants ----------
app.get("/api/admin/restaurants", requireAdmin, async (req, res) => {
  try {
    const { municipalityId, q } = req.query;
    const where = [];
    const params = [];
    if (municipalityId) { where.push("r.municipality_id = ?"); params.push(Number(municipalityId)); }
    if (q) { where.push("(r.name LIKE ? OR r.description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }

    const sql = `
      SELECT r.id, r.name, r.slug, r.kind, r.description, r.address, r.phone, r.website,
             r.facebook, r.instagram, r.opening_hours, r.price_range, r.cuisine_types,
             r.rating, r.lat, r.lng, r.municipality_id, r.image_url, r.signature, r.signature_rank
      FROM restaurants r
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.id DESC
      LIMIT 1000
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalizeRestaurant));
  } catch (e) {
    res.status(500).json({ error: "Admin list restaurants failed", detail: String(e?.message || e) });
  }
});

app.post("/api/admin/restaurants", requireAdmin, async (req, res) => {
  try {
    const {
      municipality_id, name, slug, kind = "restaurant",
      address, lat, lng, description = null,
      price_range = "moderate", cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0, image_url = null
    } = req.body;

    if (!municipality_id || !name || !slug || !address || lat == null || lng == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    await pool.query(
      `INSERT INTO restaurants
        (name, slug, kind, description, municipality_id, address,
         phone, email, website, facebook, instagram, opening_hours,
         price_range, cuisine_types, rating, lat, lng, location_pt, image_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
         ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326), ?)`,
      [name, slug, kind, description, municipality_id, address,
       phone, email, website, facebook, instagram, opening_hours,
       price_range, JSON.stringify(cuisine_types), rating, lat, lng, lng, lat, image_url]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Create restaurant failed", detail: String(e?.message || e) });
  }
});

app.put("/api/admin/restaurants/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      municipality_id, name, slug, kind = "restaurant",
      address, lat, lng, description = null,
      price_range = "moderate", cuisine_types = [],
      phone = null, email = null, website = null,
      facebook = null, instagram = null, opening_hours = null,
      rating = 0, image_url = null
    } = req.body;

    if (!municipality_id || !name || !slug || !address || lat == null || lng == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await pool.query(
      `UPDATE restaurants SET
        name=?, slug=?, kind=?, description=?, municipality_id=?, address=?,
        phone=?, email=?, website=?, facebook=?, instagram=?, opening_hours=?,
        price_range=?, cuisine_types=?, rating=?, lat=?, lng=?, location_pt=ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326),
        image_url=?
       WHERE id=?`,
      [name, slug, kind, description, municipality_id, address,
       phone, email, website, facebook, instagram, opening_hours,
       price_range, JSON.stringify(cuisine_types), rating, lat, lng, lng, lat, image_url, id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Update restaurant failed", detail: String(e?.message || e) });
  }
});

app.delete("/api/admin/restaurants/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM restaurants WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Delete restaurant failed", detail: String(e?.message || e) });
  }
});

// Signature/Rank (Top 3)
app.post("/api/admin/restaurants/:id/signature", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { signature = 0, rank = null } = req.body;
    await pool.query(`UPDATE restaurants SET signature=?, signature_rank=? WHERE id=?`,
      [Number(!!signature), rank, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Set restaurant signature failed", detail: String(e?.message || e) });
  }
});

// ---------- Linking ----------
app.get("/api/admin/links", requireAdmin, async (req, res) => {
  try {
    const { dishId, restaurantId } = req.query;
    if (!dishId && !restaurantId) return res.json([]);
    const where = [];
    const params = [];
    if (dishId)        { where.push("dr.dish_id = ?"); params.push(Number(dishId)); }
    if (restaurantId)  { where.push("dr.restaurant_id = ?"); params.push(Number(restaurantId)); }

    const [rows] = await pool.query(
      `SELECT dr.dish_id, dr.restaurant_id, dr.price_note, dr.availability
         , d.name AS dish_name, r.name AS restaurant_name
       FROM dish_restaurants dr
       JOIN dishes d ON d.id = dr.dish_id
       JOIN restaurants r ON r.id = dr.restaurant_id
       ${where.length ? "WHERE "+ where.join(" AND ") : ""}`,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "List links failed", detail: String(e?.message || e) });
  }
});

app.post("/api/admin/links", requireAdmin, async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note = null, availability = "regular" } = req.body;
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: "dish_id and restaurant_id are required" });

    await pool.query(
      `INSERT INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE price_note=VALUES(price_note), availability=VALUES(availability)`,
      [dish_id, restaurant_id, price_note, availability]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Link dish/restaurant failed", detail: String(e?.message || e) });
  }
});

app.delete("/api/admin/links", requireAdmin, async (req, res) => {
  try {
    const { dish_id, restaurant_id } = req.body;
    if (!dish_id || !restaurant_id) return res.status(400).json({ error: "dish_id and restaurant_id are required" });

    await pool.query(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dish_id, restaurant_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Unlink failed", detail: String(e?.message || e) });
  }
});

// ---------- Analytics (simple) ----------
app.get("/api/admin/analytics/summary", requireAdmin, async (_req, res) => {
  try {
    const [[{ cnt: dishCount }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM dishes`);
    const [[{ cnt: restCount }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM restaurants`);
    const [[{ cnt: muniCount }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM municipalities`);

    const [topRestaurants] = await pool.query(
      `SELECT id, name, rating, signature, signature_rank
       FROM restaurants ORDER BY signature DESC, signature_rank ASC, rating DESC LIMIT 5`
    );
    const [topFoods] = await pool.query(
      `SELECT d.id, d.name, d.featured, d.featured_rank
         FROM dishes d
         JOIN dish_categories c ON c.id=d.category_id
        WHERE c.code='food'
        ORDER BY d.featured DESC, d.featured_rank ASC, d.popularity DESC
        LIMIT 5`
    );
    const [topDelicacies] = await pool.query(
      `SELECT d.id, d.name, d.featured, d.featured_rank
         FROM dishes d
         JOIN dish_categories c ON c.id=d.category_id
        WHERE c.code='delicacy'
        ORDER BY d.featured DESC, d.featured_rank ASC, d.popularity DESC
        LIMIT 5`
    );

    res.json({
      totals: { dishes: dishCount, restaurants: restCount, municipalities: muniCount },
      topRestaurants,
      topFoods,
      topDelicacies
    });
  } catch (e) {
    res.status(500).json({ error: "Analytics failed", detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
