// admin-api/index.js  — minimal admin server (no auth; CORS open; talks to same DB)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const PORT = Number(process.env.PORT || 3002);

const app = express();
// Permissive CORS for now (no cookies; front uses credentials: 'omit')
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// ---- DB POOL ----
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "127.0.0.1",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "bulacan_flavors",
  waitForConnections: true,
  connectionLimit: 10,
});
const q = async (sql, params=[]) => (await pool.query(sql, params))[0];

/* ========================= READS ========================= */

app.get("/api/municipalities", async (req, res) => {
  try {
    const rows = await q(`SELECT id, name, slug FROM municipalities ORDER BY name`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Failed to fetch municipalities", detail: String(e) }); }
});

app.get("/api/dishes", async (req, res) => {
  try {
    const { municipalityId, category, q:search, signature, limit } = req.query;
    const where = [];
    const args = [];
    if (municipalityId) { where.push("d.municipality_id = ?"); args.push(Number(municipalityId)); }
    if (category)       { where.push("d.category = ?");       args.push(String(category)); }
    if (search)         { where.push("(d.name LIKE ? OR d.slug LIKE ?)"); const s = `%${search}%`; args.push(s, s); }
    if (signature != null) { where.push("COALESCE(d.is_signature,0) = ?"); args.push(Number(signature)); }
    const lim = Math.min(Number(limit || 200), 500);
    const rows = await q(
      `SELECT d.* FROM dishes d
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY COALESCE(d.panel_rank, 999), d.name
       LIMIT ${lim}`, args);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Failed to fetch dishes", detail: String(e) }); }
});

app.get("/api/restaurants", async (req, res) => {
  try {
    const { municipalityId, q:search, dishId, featured, limit } = req.query;
    const where = [];
    const args = [];
    let join = "";
    if (dishId) { join = "JOIN dish_restaurants dr ON dr.restaurant_id = r.id"; where.push("dr.dish_id = ?"); args.push(Number(dishId)); }
    if (municipalityId) { where.push("r.municipality_id = ?"); args.push(Number(municipalityId)); }
    if (search) { where.push("(r.name LIKE ? OR r.slug LIKE ?)"); const s = `%${search}%`; args.push(s, s); }
    if (featured != null) { where.push("COALESCE(r.featured,0) = ?"); args.push(Number(featured)); }
    const lim = Math.min(Number(limit || 200), 500);
    const rows = await q(
      `SELECT r.* FROM restaurants r
       ${join}
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY COALESCE(r.featured_rank, 999), r.name
       LIMIT ${lim}`, args);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Failed to fetch restaurants", detail: String(e) }); }
});

/* ========================= CRUD: DISHES ========================= */

const DISH_COLUMNS = new Set([
  "municipality_id","name","slug","description","category",
  "flavor_profile","ingredients","popularity","rating","is_signature","panel_rank","image_url"
]);

app.post("/admin/dishes", async (req, res) => {
  try {
    const payload = req.body || {};
    const cols = Object.keys(payload).filter(k => DISH_COLUMNS.has(k));
    if (cols.length === 0) return res.status(400).json({ error: "No valid fields" });
    const placeholders = cols.map(()=>"?").join(",");
    const sql = `INSERT INTO dishes (${cols.join(",")}) VALUES (${placeholders})`;
    const args = cols.map(k => payload[k]);
    const r = await q(sql, args);
    const [row] = await q(`SELECT * FROM dishes WHERE id=?`, [r.insertId]);
    res.json(row);
  } catch (e) { res.status(500).json({ error:"Failed to create dish", detail:String(e) }); }
});

app.patch("/admin/dishes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = req.body || {};
    const cols = Object.keys(payload).filter(k => DISH_COLUMNS.has(k));
    if (cols.length === 0) return res.status(400).json({ error: "No valid fields" });
    const setSql = cols.map(c => `${c}=?`).join(",");
    const args = cols.map(k => payload[k]); args.push(id);
    await q(`UPDATE dishes SET ${setSql} WHERE id=?`, args);
    const [row] = await q(`SELECT * FROM dishes WHERE id=?`, [id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error:"Failed to update dish", detail:String(e) }); }
});

app.delete("/admin/dishes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await q(`DELETE FROM dish_restaurants WHERE dish_id=?`, [id]);
    await q(`DELETE FROM dishes WHERE id=?`, [id]);
    res.json({ ok:true });
  } catch (e) { res.status(500).json({ error:"Failed to delete dish", detail:String(e) }); }
});

/* ========================= CRUD: RESTAURANTS ========================= */

const REST_COLUMNS = new Set([
  "municipality_id","name","slug","kind","description","address","phone","website",
  "facebook","instagram","opening_hours","price_range","cuisine_types","rating","lat","lng",
  "image_url","featured","featured_rank"
]);

app.post("/admin/restaurants", async (req, res) => {
  try {
    const payload = req.body || {};
    const cols = Object.keys(payload).filter(k => REST_COLUMNS.has(k));
    if (cols.length === 0) return res.status(400).json({ error: "No valid fields" });
    const placeholders = cols.map(()=>"?").join(",");
    const sql = `INSERT INTO restaurants (${cols.join(",")}) VALUES (${placeholders})`;
    const args = cols.map(k => payload[k]);
    const r = await q(sql, args);
    const [row] = await q(`SELECT * FROM restaurants WHERE id=?`, [r.insertId]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error:"Failed to create restaurant", detail:String(e) });
  }
});

app.patch("/admin/restaurants/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = req.body || {};
    const cols = Object.keys(payload).filter(k => REST_COLUMNS.has(k));
    if (cols.length === 0) return res.status(400).json({ error: "No valid fields" });
    const setSql = cols.map(c => `${c}=?`).join(",");
    const args = cols.map(k => payload[k]); args.push(id);
    await q(`UPDATE restaurants SET ${setSql} WHERE id=?`, args);
    const [row] = await q(`SELECT * FROM restaurants WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error:"Failed to update restaurant", detail:String(e) });
  }
});

app.delete("/admin/restaurants/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await q(`DELETE FROM dish_restaurants WHERE restaurant_id=?`, [id]);
    await q(`DELETE FROM restaurants WHERE id=?`, [id]);
    res.json({ ok:true });
  } catch (e) { res.status(500).json({ error:"Failed to delete restaurant", detail:String(e) }); }
});

/* ========================= LINKING ========================= */

app.get("/admin/dishes/:id/restaurants", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(
      `SELECT r.* FROM dish_restaurants dr
       JOIN restaurants r ON r.id=dr.restaurant_id
       WHERE dr.dish_id=? ORDER BY r.name`, [id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error:"Failed to list restaurants for dish", detail:String(e) }); }
});

app.get("/admin/restaurants/:id/dishes", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(
      `SELECT d.* FROM dish_restaurants dr
       JOIN dishes d ON d.id=dr.dish_id
       WHERE dr.restaurant_id=? ORDER BY d.name`, [id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error:"Failed to list dishes for restaurant", detail:String(e) }); }
});

app.post("/admin/dish-restaurants", async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note=null, availability='regular' } = req.body || {};
    if (!dish_id || !restaurant_id) return res.status(400).json({ error:"dish_id and restaurant_id required" });
    await q(
      `INSERT IGNORE INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
       VALUES (?,?,?,?)`,
      [dish_id, restaurant_id, price_note, availability]
    );
    res.json({ ok:true });
  } catch (e) { res.status(500).json({ error:"Failed to link", detail:String(e) }); }
});

app.delete("/admin/dish-restaurants", async (req, res) => {
  try {
    const dish_id = Number(req.query.dish_id);
    const restaurant_id = Number(req.query.restaurant_id);
    if (!dish_id || !restaurant_id) return res.status(400).json({ error:"dish_id and restaurant_id required" });
    await q(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [dish_id, restaurant_id]);
    res.json({ ok:true });
  } catch (e) { res.status(500).json({ error:"Failed to unlink", detail:String(e) }); }
});

/* ========================= CURATION ========================= */
/** Helper: ensure ranks 1..3 are unique per municipality for dishes */
async function enforceDishRankUniqueness(municipality_id) {
  // If any municipality has duplicates, keep the smallest id for each rank; null the others.
  await q(
    `UPDATE dishes d
     JOIN (
       SELECT municipality_id, panel_rank, MIN(id) keep_id
       FROM dishes
       WHERE municipality_id=? AND panel_rank IN (1,2,3)
       GROUP BY municipality_id, panel_rank
     ) x ON x.municipality_id=d.municipality_id AND x.panel_rank=d.panel_rank
     SET d.panel_rank = IF(d.id = x.keep_id, d.panel_rank, NULL),
         d.is_signature = IF(d.id = x.keep_id, 1, d.is_signature)`,
    [municipality_id]
  );
}

/** Enforce only 3 rows max per municipality with is_signature=1 and panel_rank in 1..3 */
async function enforceDishTop3Cap(municipality_id) {
  // If more than 3 rows flagged, null ranks beyond 3 by rank order.
  await q(
    `UPDATE dishes d
     JOIN (
       SELECT id, ROW_NUMBER() OVER (PARTITION BY municipality_id ORDER BY COALESCE(panel_rank,999), name) AS rn
       FROM dishes
       WHERE municipality_id=? AND COALESCE(is_signature,0)=1
     ) x ON x.id=d.id
     SET d.panel_rank = IF(x.rn<=3, d.panel_rank, NULL),
         d.is_signature = IF(x.rn<=3, d.is_signature, 0)
    `, [municipality_id]
  );
}

/** PATCH dish curation */
app.patch("/admin/dishes/:id/curation", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_signature=null, panel_rank=null } = req.body || {};
    // update fields
    await q(`UPDATE dishes SET is_signature=?, panel_rank=? WHERE id=?`,
      [is_signature, panel_rank, id]);
    // fetch municipality_id to enforce uniqueness/scoping
    const [row] = await q(`SELECT municipality_id FROM dishes WHERE id=?`, [id]);
    if (row?.municipality_id) {
      await enforceDishRankUniqueness(row.municipality_id);
      await enforceDishTop3Cap(row.municipality_id);
    }
    const [dish] = await q(`SELECT * FROM dishes WHERE id=?`, [id]);
    res.json(dish);
  } catch (e) { res.status(500).json({ error:"Failed to set dish curation", detail:String(e) }); }
});

/** PATCH restaurant curation (optional columns) */
app.patch("/admin/restaurants/:id/curation", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { featured=null, featured_rank=null } = req.body || {};
    try {
      await q(`UPDATE restaurants SET featured=?, featured_rank=? WHERE id=?`,
        [featured, featured_rank, id]);

      // Enforce unique rank per municipality and cap 3 (if municipality_id exists)
      const [row] = await q(`SELECT municipality_id FROM restaurants WHERE id=?`, [id]);
      if (row?.municipality_id) {
        await q(
          `UPDATE restaurants r
           JOIN (
             SELECT municipality_id, featured_rank, MIN(id) keep_id
             FROM restaurants
             WHERE municipality_id=? AND featured_rank IN (1,2,3)
             GROUP BY municipality_id, featured_rank
           ) x ON x.municipality_id=r.municipality_id AND x.featured_rank=r.featured_rank
           SET r.featured_rank = IF(r.id = x.keep_id, r.featured_rank, NULL),
               r.featured = IF(r.id = x.keep_id, 1, r.featured)`,
          [row.municipality_id]
        );
        await q(
          `UPDATE restaurants r
           JOIN (
             SELECT id, ROW_NUMBER() OVER (PARTITION BY municipality_id ORDER BY COALESCE(featured_rank,999), name) AS rn
             FROM restaurants
             WHERE municipality_id=? AND COALESCE(featured,0)=1
           ) x ON x.id=r.id
           SET r.featured_rank = IF(x.rn<=3, r.featured_rank, NULL),
               r.featured = IF(x.rn<=3, r.featured, 0)
          `,[row.municipality_id]
        );
      }

      const [rest] = await q(`SELECT * FROM restaurants WHERE id=?`, [id]);
      res.json(rest);
    } catch (colErr) {
      // If columns don't exist, return a clear error
      return res.status(409).json({ error:"MISSING_COLUMNS", detail:"restaurants table needs featured TINYINT and featured_rank INT" });
    }
  } catch (e) { res.status(500).json({ error:"Failed to set restaurant curation", detail:String(e) }); }
});

/* ========================= ANALYTICS ========================= */
app.get("/admin/analytics/summary", async (req, res) => {
  try {
    const [[{ cD }]] = await Promise.all([q(`SELECT COUNT(*) cD FROM dishes`)]);
    const [[{ cR }]] = await Promise.all([q(`SELECT COUNT(*) cR FROM restaurants`)]);
    const perMunicipality = await q(
      `SELECT m.slug,
              (SELECT COUNT(*) FROM dishes d WHERE d.municipality_id=m.id) AS dishes,
              (SELECT COUNT(*) FROM restaurants r WHERE r.municipality_id=m.id) AS restaurants
       FROM municipalities m ORDER BY m.name`
    );
    let topDishes = [];
    try { topDishes = await q(`SELECT id,name,panel_rank FROM dishes WHERE COALESCE(is_signature,0)=1 ORDER BY COALESCE(panel_rank,999), name LIMIT 10`); } catch {}
    let topRestaurants = [];
    try { topRestaurants = await q(`SELECT id,name,featured_rank FROM restaurants WHERE COALESCE(featured,0)=1 ORDER BY COALESCE(featured_rank,999), name LIMIT 10`); } catch {}

    res.json({ counts: { dishes: cD, restaurants: cR }, perMunicipality, topDishes, topRestaurants });
  } catch (e) { res.status(500).json({ error:"Failed analytics", detail:String(e) }); }
});

app.listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}`);
});
