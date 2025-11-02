// Import the mysql2/promise module
import mysql from 'mysql2/promise';

// Create configuration object
const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'bulacan_flavors',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
};

// Create the connection pool
const pool = mysql.createPool(config);

// Export the pool directly
export default pool;