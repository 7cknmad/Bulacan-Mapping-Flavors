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

async function checkDb() {
  const pool = mysql.createPool(cfg);
  console.log('Checking database structure...');
  
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('Current tables:', tables.map(t => Object.values(t)[0]));

    // Check municipalities table structure
    const [cols] = await pool.query('DESCRIBE municipalities');
    console.log('\nmunicipalities table structure:', cols);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkDb();