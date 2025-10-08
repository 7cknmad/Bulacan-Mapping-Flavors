import pRetry from "p-retry";
import mysql from "mysql2/promise";

// EDIT these to your DB:
const pool = await mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "bulacan_flavors",
  multipleStatements: true,
});

const PLACEHOLDER = { lat: 14.8443, lng: 120.8104 }; // same as step 1

async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url, {
    headers: { "User-Agent": "BulacanFlavors/1.0 (admin@example.com)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function main() {
  // Fetch rows still on placeholders
  const [rows] = await pool.query(
    "SELECT id, name FROM municipalities WHERE ABS(lat-?)<1e-6 AND ABS(lng-?)<1e-6",
    [PLACEHOLDER.lat, PLACEHOLDER.lng]
  );

  for (const row of rows) {
    // Use a Bulacan-specific query to improve accuracy
    const q = `${row.name}, Bulacan, Philippines`;
    const result = await pRetry(() => geocode(q), { retries: 3 });

    if (!result) {
      console.warn(`No geocode result for: ${row.name}`);
      continue;
    }

    const { lat, lng } = result;
await pool.query(
  `UPDATE municipalities
     SET lat = ?, lng = ?,
         location_pt = ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326),
         updated_at = NOW()
   WHERE id = ?`,
  [lat, lng, lng, lat, row.id]   // note: lng first in POINT(wkt), then lat
);
    console.log(`Updated ${row.name}: ${lat}, ${lng}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
