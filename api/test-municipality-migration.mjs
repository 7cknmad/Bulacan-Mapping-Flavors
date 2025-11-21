// Test if the migration works properly
import pool from './db.js';

async function testMigration() {
  try {
    // Create connection
    const connection = pool;

    // Get all current municipalities before migration 
    console.log('Current municipalities:');
    const [rows] = await connection.execute('SELECT id, name, osm_relation_id FROM municipalities');
    console.log(rows);


    const migration = `
      -- 1) Add osm_relation_id column if it doesn't exist
      ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS osm_relation_id INT;

      -- 2) Update the OSM relation IDs for each municipality
      UPDATE municipalities 
      SET osm_relation_id = 
        CASE name
          WHEN 'San Jose del Monte' THEN 379830
          WHEN 'Obando' THEN 379824
          WHEN 'Doña Remedios Trinidad' THEN 379817
          WHEN 'San Rafael' THEN 379832
          -- Add all other municipalities here
        END
      WHERE osm_relation_id IS NULL;

      -- 3) Make osm_relation_id NOT NULL after updating 
      ALTER TABLE municipalities MODIFY COLUMN osm_relation_id INT NOT NULL;
    `;

    console.log('Running migration...');
    await connection.query(migration);

    // Check results
    console.log('\nUpdated municipalities:');
    const [updatedRows] = await connection.execute('SELECT id, name, osm_relation_id FROM municipalities');
    console.log(updatedRows);

    // Test queries still work
    console.log('\nTesting dishes query by municipality:');
    const [dishes] = await connection.execute(
      'SELECT d.* FROM dishes d JOIN municipalities m ON d.municipality_id = m.id WHERE m.osm_relation_id = ?',
      [379830] // San Jose del Monte
    );
    console.log(`Found ${dishes.length} dishes for San Jose del Monte`);

    await connection.end();
    console.log('Migration test complete');

  } catch (err) {
    console.error('Error running migration:', err);
  }
}

testMigration();