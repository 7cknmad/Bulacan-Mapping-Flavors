-- Drop spatial index if it exists
DROP INDEX location_pt ON restaurants;

-- Update restaurants table
ALTER TABLE restaurants
  -- Rename columns to match new schema
  DROP COLUMN phone_number,
  ADD COLUMN phone VARCHAR(40),
  ADD COLUMN email VARCHAR(120),
  ADD COLUMN facebook VARCHAR(300),
  ADD COLUMN instagram VARCHAR(300),
  ADD COLUMN opening_hours VARCHAR(240),
  ADD COLUMN kind ENUM('restaurant', 'stall', 'store', 'dealer', 'market', 'home-based') DEFAULT 'restaurant',
  ADD COLUMN price_range ENUM('budget', 'moderate', 'expensive') DEFAULT 'moderate',
  ADD COLUMN cuisine_types JSON,
  ADD COLUMN lat DECIMAL(10,8),
  ADD COLUMN lng DECIMAL(11,8),
  ADD COLUMN featured TINYINT DEFAULT 0,
  ADD COLUMN featured_rank INT,
  ADD COLUMN panel_rank INT,
  ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active',
  ADD COLUMN metadata JSON,
  ADD COLUMN location POINT AFTER metadata,
  ADD COLUMN location_pt POINT AFTER location,
  ADD SPATIAL INDEX location_pt_idx (location_pt);

-- Migrate existing lat/lng to location and location_pt
UPDATE restaurants 
SET lat = latitude,
    lng = longitude,
    location = ST_GeomFromText(CONCAT('POINT(', longitude, ' ', latitude, ')')),
    location_pt = ST_GeomFromText(CONCAT('POINT(', longitude, ' ', latitude, ')'))
WHERE lat IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Drop old columns
ALTER TABLE restaurants
  DROP COLUMN latitude,
  DROP COLUMN longitude;