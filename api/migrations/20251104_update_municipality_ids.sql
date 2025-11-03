-- Migration: Update municipalities to use OSM relation IDs

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

-- 4) Add unique index on osm_relation_id
ALTER TABLE municipalities ADD UNIQUE INDEX idx_municipality_osm_id (osm_relation_id);

-- 5) Update the dishes and restaurants tables to use osm_relation_id
-- First create temporary column
ALTER TABLE dishes ADD COLUMN temp_municipality_id INT;

-- Copy the OSM IDs
UPDATE dishes d
JOIN municipalities m ON d.municipality_id = m.id
SET d.temp_municipality_id = m.osm_relation_id;

-- Drop the old foreign key
ALTER TABLE dishes DROP FOREIGN KEY dishes_ibfk_1; -- You may need to change this constraint name

-- Drop the old column
ALTER TABLE dishes DROP COLUMN municipality_id;

-- Rename the temp column
ALTER TABLE dishes RENAME COLUMN temp_municipality_id TO municipality_id;

-- Add the new foreign key referencing osm_relation_id
ALTER TABLE dishes ADD CONSTRAINT dishes_ibfk_1 
FOREIGN KEY (municipality_id) REFERENCES municipalities(osm_relation_id);

-- 6) Do the same for restaurants table
ALTER TABLE restaurants ADD COLUMN temp_municipality_id INT;

UPDATE restaurants r
JOIN municipalities m ON r.municipality_id = m.id
SET r.temp_municipality_id = m.osm_relation_id;

ALTER TABLE restaurants DROP FOREIGN KEY restaurants_ibfk_1; -- You may need to change this constraint name

ALTER TABLE restaurants DROP COLUMN municipality_id;

ALTER TABLE restaurants RENAME COLUMN temp_municipality_id TO municipality_id;

ALTER TABLE restaurants ADD CONSTRAINT restaurants_ibfk_1
FOREIGN KEY (municipality_id) REFERENCES municipalities(osm_relation_id);