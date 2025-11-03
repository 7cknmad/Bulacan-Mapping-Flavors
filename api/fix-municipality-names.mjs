import mysql from 'mysql2/promise';
import 'dotenv/config';

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'bulacan_flavors',
  waitForConnections: true,
  connectionLimit: 10,
};

async function fixMunicipalityNames() {
  const pool = mysql.createPool(cfg);
  console.log('Fixing municipality name mismatches...');
  
  try {
    await pool.query(`
      UPDATE municipalities 
      SET osm_relation_id = CASE
        WHEN name = 'Baliwag' THEN 379811
        WHEN name = 'Malolos City' THEN 379820
        WHEN name = 'Meycauayan City' THEN 379822
      END
      WHERE name IN ('Baliwag', 'Malolos City', 'Meycauayan City')
    `);
    console.log('Updated municipality OSM IDs');

    // Verify updates
    const [rows] = await pool.query('SELECT id, name, osm_relation_id FROM municipalities ORDER BY name');
    console.log('\nMunicipalities with OSM IDs:');
    console.log(rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixMunicipalityNames();