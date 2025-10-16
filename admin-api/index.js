// admin-api/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const PORT = Number(process.env.PORT || 3002);

const app = express();
// permissive CORS (no cookies; safe for GH Pages)
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "127.0.0.1",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "bulacan_flavors",
  waitForConnections: true,
  connectionLimit: 10,
});
const q = async (sql, params=[]) => (await pool.query(sql, params))[0];

/* ---------- health ---------- */
app.get("/admin/health", async (req, res) => {
  try {
    await q("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

/* ---------- public-style reads (admin UI needs these) ---------- */
app.get("/api/municipalities", async (req, res) => {
  try {
    const rows = await q(`SELECT id,name,slug FROM municipalities ORDER BY name`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error:"Failed to fetch municipalities", detail:String(e) }); }
});

app.get("/api/dishes", async (req, res) => {
  try {
    const { municipalityId, category, q:search, signature, limit } = req.query;
    const where = [], args = [];
    if (municipalityId) { where.push("d.municipality_id = ?"); args.push(Number(municipalityId)); }
    if (category)       { where.push("d.category = ?");       args.push(String(category)); }
    if (search)         { where.push("(d.name LIKE ? OR d.slug LIKE ?)"); const s = `%${search}%`; args.push(s, s); }
    if (signature != null) { where.push("COALESCE(d.is_signature,0) = ?"); args.push(Number(signature)); }
    const lim = Math.min(Number(limit || 200), 500);
    const rows = await q(
      `SELECT d.* FROM dishes d
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY COALESCE(d.panel_rank,999), d.name
       LIMIT ${lim}`, args
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error:"Failed to fetch dishes", detail:String(e) }); }
});

app.get("/api/restaurants", async (req, res) => {
  try {
    const { municipalityId, q:search, dishId, featured, limit } = req.query;
    const where = [], args = [];
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
       ORDER BY COALESCE(r.featured_rank,999), r.name
       LIMIT ${lim}`, args
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error:"Failed to fetch restaurants", detail:String(e) }); }
});

/* ---------- CRUD (KEEP your existing bodies or paste them back) ---------- */
// Dishes
app.post("/admin/dishes", async (req, res) => {
  try {
    const fields = [
      "municipality_id","name","slug","description","category","flavor_profile","ingredients",
      "popularity","rating","is_signature","panel_rank","image_url"
    ];
    const data = fields.reduce((acc,k)=>({...acc,[k]: req.body[k] ?? null}),{});
    const r = await q(
      `INSERT INTO dishes (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")})`,
      fields.map(f=>data[f])
    );
    const [row] = await q(`SELECT * FROM dishes WHERE id=?`, [r.insertId]);
    res.json(row);
  } catch(e){ res.status(500).json({ error:"Failed to create dish", detail:String(e) }); }
});

app.patch("/admin/dishes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const patchable = ["municipality_id","name","slug","description","category","flavor_profile","ingredients","popularity","rating","is_signature","panel_rank","image_url"];
    const updates = [], args=[];
    for (const k of patchable) if (k in req.body) { updates.push(`${k}=?`); args.push(req.body[k]); }
    if (!updates.length) return res.json({ ok:true });
    args.push(id);
    await q(`UPDATE dishes SET ${updates.join(",")} WHERE id=?`, args);
    const [row] = await q(`SELECT * FROM dishes WHERE id=?`, [id]);
    res.json(row);
  } catch(e){ res.status(500).json({ error:"Failed to update dish", detail:String(e) }); }
});

app.delete("/admin/dishes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await q(`DELETE FROM dish_restaurants WHERE dish_id=?`, [id]);
    await q(`DELETE FROM dishes WHERE id=?`, [id]);
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ error:"Failed to delete dish", detail:String(e) }); }
});

// Restaurants
app.post("/admin/restaurants", async (req, res) => {
  try {
    const fields = [
      "municipality_id","name","slug","kind","description","address","phone",
      "website","facebook","instagram","opening_hours","price_range","cuisine_types",
      "rating","lat","lng","image_url","featured","featured_rank"
    ];
    const data = fields.reduce((acc,k)=>({...acc,[k]: req.body[k] ?? null}),{});
    const r = await q(
      `INSERT INTO restaurants (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")})`,
      fields.map(f=>data[f])
    );
    const [row] = await q(`SELECT * FROM restaurants WHERE id=?`, [r.insertId]);
    res.json(row);
  } catch(e){ res.status(500).json({ error:"Failed to create restaurant", detail:String(e) }); }
});

app.patch("/admin/restaurants/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const patchable = ["municipality_id","name","slug","kind","description","address","phone","website","facebook","instagram","opening_hours","price_range","cuisine_types","rating","lat","lng","image_url","featured","featured_rank"];
    const updates = [], args=[];
    for (const k of patchable) if (k in req.body) { updates.push(`${k}=?`); args.push(req.body[k]); }
    if (!updates.length) return res.json({ ok:true });
    args.push(id);
    await q(`UPDATE restaurants SET ${updates.join(",")} WHERE id=?`, args);
    const [row] = await q(`SELECT * FROM restaurants WHERE id=?`, [id]);
    res.json(row);
  } catch(e){ res.status(500).json({ error:"Failed to update restaurant", detail:String(e) }); }
});

app.delete("/admin/restaurants/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await q(`DELETE FROM dish_restaurants WHERE restaurant_id=?`, [id]);
    await q(`DELETE FROM restaurants WHERE id=?`, [id]);
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ error:"Failed to delete restaurant", detail:String(e) }); }
});

/* ---------- Linking ---------- */
app.get("/admin/dishes/:id/restaurants", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(`SELECT r.* FROM restaurants r
                          JOIN dish_restaurants dr ON dr.restaurant_id=r.id
                          WHERE dr.dish_id=? ORDER BY r.name`, [id]);
    res.json(rows);
  } catch(e){ res.status(500).json({ error:"Failed to fetch linked restaurants", detail:String(e) }); }
});

app.get("/admin/restaurants/:id/dishes", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(`SELECT d.* FROM dishes d
                          JOIN dish_restaurants dr ON dr.dish_id=d.id
                          WHERE dr.restaurant_id=? ORDER BY d.name`, [id]);
    res.json(rows);
  } catch(e){ res.status(500).json({ error:"Failed to fetch linked dishes", detail:String(e) }); }
});

app.post("/admin/dish-restaurants", async (req, res) => {
  try {
    const { dish_id, restaurant_id, price_note=null, availability='regular' } = req.body;
    await q(`INSERT IGNORE INTO dish_restaurants (dish_id, restaurant_id, price_note, availability)
             VALUES (?,?,?,?)`, [dish_id, restaurant_id, price_note, availability]);
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ error:"Failed to link", detail:String(e) }); }
});

app.delete("/admin/dish-restaurants", async (req, res) => {
  try {
    const { dish_id, restaurant_id } = req.query;
    await q(`DELETE FROM dish_restaurants WHERE dish_id=? AND restaurant_id=?`, [Number(dish_id), Number(restaurant_id)]);
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ error:"Failed to unlink", detail:String(e) }); }
});

/* ---------- Curation ---------- */
app.patch("/admin/dishes/:id/curation", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_signature = null, panel_rank = null } = req.body;
    await q(`UPDATE dishes SET is_signature=?, panel_rank=? WHERE id=?`, [is_signature, panel_rank, id]);
    const [row] = await q(`SELECT * FROM dishes WHERE id=?`, [id]);
    res.json(row);
  } catch(e){ res.status(500).json({ error:"Failed to update dish curation", detail:String(e) }); }
});

app.patch("/admin/restaurants/:id/curation", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { featured = null, featured_rank = null } = req.body;
    await q(`UPDATE restaurants SET featured=?, featured_rank=? WHERE id=?`, [featured, featured_rank, id]);
    const [row] = await q(`SELECT * FROM restaurants WHERE id=?`, [id]);
    res.json(row);
  } catch(e){ res.status(500).json({ error:"Failed to update restaurant curation", detail:String(e) }); }
});

/* ---------- analytics (renamed to avoid adblock) ---------- */
app.get("/admin/stats/summary", async (req, res) => {
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
