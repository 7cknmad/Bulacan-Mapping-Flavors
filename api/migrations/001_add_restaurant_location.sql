-- Migration: add a POINT location column to restaurants and populate from lat/lng
-- NOTE: Review MySQL version compatibility for SPATIAL indexes on InnoDB (MySQL 8+ recommended).
-- Run this on a staging DB first and take a backup before running on production.

START TRANSACTION;

-- 1) Add nullable POINT column
-- Add location column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = "restaurants";
SET @columnname = "location";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE restaurants ADD COLUMN location POINT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2) Populate from existing lat/lng values (if present)
-- Uses WKT POINT(lng lat) — MySQL ST_GeomFromText expects 'POINT(lng lat)'
UPDATE restaurants SET location = ST_GeomFromText(CONCAT('POINT(', IFNULL(CAST(lng AS CHAR), '0'), ' ', IFNULL(CAST(lat AS CHAR), '0'), ')'))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 3) Create a spatial index to accelerate distance queries
-- For InnoDB this requires MySQL 8+. If your server doesn't support spatial indexes on InnoDB, skip this step
-- and rely on the Haversine fallback in the API.
-- Add spatial index if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = "restaurants";
SET @indexname = "idx_restaurants_location";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @indexname)
  ) > 0,
  "SELECT 1",
  "CREATE SPATIAL INDEX idx_restaurants_location ON restaurants (location)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

COMMIT;

-- If your MySQL version does not support creating SPATIAL indexes on InnoDB, consider:
--  * creating a duplicate MyISAM table for spatial queries, or
--  * using a separate geometry-enabled DB (PostGIS), or
--  * keep using the Haversine SQL fallback implemented in the API.
