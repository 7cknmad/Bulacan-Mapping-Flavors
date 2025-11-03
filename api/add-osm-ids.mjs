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

async function addOsmIds() {
  const pool = mysql.createPool(cfg);
  console.log('Adding OSM relation IDs to municipalities table...');
  
  try {
    // Add the column
    await pool.query(`
      ALTER TABLE municipalities 
      ADD COLUMN osm_relation_id BIGINT UNSIGNED NULL AFTER id,
      ADD INDEX idx_osm_relation_id (osm_relation_id)
    `);
    console.log('Added osm_relation_id column');

    // Update existing municipalities with OSM IDs
    const updates = [
      [379803, 'Angat'],
      [379810, 'Balagtas'],
      [379811, 'Baliuag'],
      [379812, 'Bocaue'],
      [379813, 'Bulakan'],
      [379814, 'Bustos'],
      [379816, 'Calumpit'],
      [379817, 'Doña Remedios Trinidad'],
      [379818, 'Guiguinto'],
      [379819, 'Hagonoy'],
      [379820, 'Malolos'],
      [379821, 'Marilao'],
      [379822, 'Meycauayan'],
      [379823, 'Norzagaray'],
      [379824, 'Obando'],
      [379825, 'Pandi'],
      [379827, 'Plaridel'],
      [379828, 'Pulilan'],
      [379829, 'San Ildefonso'],
      [379830, 'San Jose del Monte'],
      [379831, 'San Miguel'],
      [379832, 'San Rafael'],
      [379833, 'Santa Maria'],
      [379834, 'Paombong']
    ];

    for (const [osmId, name] of updates) {
      await pool.query(
        'UPDATE municipalities SET osm_relation_id = ? WHERE name = ?',
        [osmId, name]
      );
    }
    console.log('Updated municipality OSM relation IDs');

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

addOsmIds();