import 'dotenv/config';
import mysql from 'mysql2/promise';
// Usage: node create-user.mjs email password "Display Name"

const [,, email, password, displayName='User'] = process.argv;
if (!email || !password) {
  console.error('Usage: node create-user.mjs email password "Display Name"');
  process.exit(2);
}

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'bulacan_flavors',
};

(async ()=>{
  const conn = await mysql.createConnection(cfg);
  try {
  // Insert plain-text password (per request)
  const [res] = await conn.query('INSERT INTO users (email, password, display_name, created_at, role) VALUES (?, ?, ?, NOW(), ?)', [email, password, displayName, 'user']);
    console.log('Created user id=', res.insertId, 'email=', email);
  } catch (e) {
    console.error('Error creating user:', e.message || e);
  } finally {
    await conn.end();
  }
})();
