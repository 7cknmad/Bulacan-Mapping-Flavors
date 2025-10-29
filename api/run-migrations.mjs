import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';

// Migration runner: executes all .sql files in api/migrations in filename order.
// Usage: node run-migrations.mjs

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'bulacan_flavors',
  multipleStatements: true,
};

async function run() {
  const migrationsDir = path.resolve('.', 'migrations');
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    if (sqlFiles.length === 0) {
      console.log('No .sql files found in', migrationsDir);
      return;
    }

    console.log('Connecting to DB', cfg.host, cfg.database);
    const conn = await mysql.createConnection(cfg);

    for (const f of sqlFiles) {
      const p = path.join(migrationsDir, f);
      console.log('Running migration:', f);
      const sql = String(await fs.readFile(p, 'utf8'));
      try {
        await conn.query(sql);
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
