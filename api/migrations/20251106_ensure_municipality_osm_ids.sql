-- Add OSM relation IDs to municipalities that don't have them

START TRANSACTION;

-- First verify municipalities table exists and has osm_relation_id
SET @dbname = DATABASE();
SET @tablename = "municipalities";
SET @columnname = "osm_relation_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE municipalities ADD COLUMN osm_relation_id INT UNSIGNED NULL UNIQUE"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Create temp table for OSM relation ID mapping
CREATE TEMPORARY TABLE municipality_osm_mapping (
  name VARCHAR(255) NOT NULL,
  osm_relation_id INT UNSIGNED NOT NULL
);

-- Insert known mappings for Bulacan municipalities
INSERT INTO municipality_osm_mapping (name, osm_relation_id) VALUES
  ('Angat', 379803),
  ('Balagtas', 379804),
  ('Baliwag', 379805),
  ('Bocaue', 379806),
  ('Bulakan', 379807),
  ('Bustos', 379808),
  ('Calumpit', 379809),
  ('Doña Remedios Trinidad', 379810),
  ('Guiguinto', 379811),
  ('Hagonoy', 379812),
  ('Malolos', 379813),
  ('Marilao', 379814),
  ('Meycauayan', 379815),
  ('Norzagaray', 379816),
  ('Obando', 379824),
  ('Pandi', 379817),
  ('Paombong', 379818),
  ('Plaridel', 379819),
  ('Pulilan', 379820),
  ('San Ildefonso', 379821),
  ('San Jose del Monte', 379830),
  ('San Miguel', 379822),
  ('San Rafael', 379823),
  ('Santa Maria', 379825);

-- Update municipalities table with OSM IDs
UPDATE municipalities m
JOIN municipality_osm_mapping map ON m.name = map.name
SET m.osm_relation_id = map.osm_relation_id
WHERE m.osm_relation_id IS NULL;

-- Add index on osm_relation_id if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = "municipalities";
SET @indexname = "idx_municipalities_osm_relation_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @indexname)
  ) > 0,
  "SELECT 1",
  "CREATE INDEX idx_municipalities_osm_relation_id ON municipalities (osm_relation_id)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verify all municipalities have OSM IDs
INSERT INTO municipalities (name, osm_relation_id)
SELECT map.name, map.osm_relation_id 
FROM municipality_osm_mapping map
LEFT JOIN municipalities m ON m.name = map.name
WHERE m.id IS NULL;

-- Report any municipalities missing OSM IDs
SELECT id, name, osm_relation_id 
FROM municipalities 
WHERE osm_relation_id IS NULL;

COMMIT;