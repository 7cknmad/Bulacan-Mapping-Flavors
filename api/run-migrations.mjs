import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

// Migration runner: executes all .sql files in api/migrations in filename order.
// Usage: node run-migrations.mjs

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'bulacan_flavors',
  multipleStatements: true,
  charset: 'utf8mb4'
};

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.resolve(__dirname, 'migrations');
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    if (sqlFiles.length === 0) {
      console.log('No .sql files found in', migrationsDir);
      return;
    }

    console.log('Connecting to DB', cfg.host, cfg.database);
    const conn = await mysql.createConnection(cfg);
    
    // Create migrations table if it doesn't exist
    await conn.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const f of sqlFiles) {
      const p = path.join(migrationsDir, f);
      
      // Check if migration has already been executed
      const [rows] = await conn.query('SELECT * FROM migrations WHERE name = ?', [f]);
      if (rows.length > 0) {
        console.log('Skipping already executed migration:', f);
        continue;
      }
      
      console.log('Running migration:', f);
      let sqlContent = String(await fs.readFile(p, 'utf8'));
      // Normalize line endings
      sqlContent = sqlContent.replace(/\r\n/g, '\n');
      // Remove DELIMITER directives often used in .sql files (mysql client only)
      sqlContent = sqlContent.replace(/^\s*DELIMITER\s+.*$/gmi, '');
      // Replace end-of-block '//' delimiters with ';'
      sqlContent = sqlContent.replace(/\s*\/\/\s*$/gm, ';');
      
      try {
        // Execute the whole file at once; multipleStatements is enabled
        console.log('Executing file content (truncated):', sqlContent.substring(0, 120).replace(/\n/g, ' ') + '...');
        await conn.query(sqlContent);
        await conn.query('INSERT INTO migrations (name) VALUES (?)', [f]);
        console.log('OK:', f);
      } catch (e) {
        console.error('FAILED:', f, e.message || e);
        // stop on error
        await conn.end();
        process.exitCode = 1;
        return;
      }
    }

    await conn.end();
    console.log('All migrations applied successfully.');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('Migrations directory not found. Expected:', path.resolve('.', 'migrations'));
    } else {
      console.error('Migration runner error:', err.message || err);
    }
    process.exitCode = 1;
  }
}

run();
