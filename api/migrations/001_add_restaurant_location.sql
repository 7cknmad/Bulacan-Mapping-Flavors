-- Migration: add a POINT location column to restaurants and populate from lat/lng
-- NOTE: Review MySQL version compatibility for SPATIAL indexes on InnoDB (MySQL 8+ recommended).
-- Run this on a staging DB first and take a backup before running on production.

START TRANSACTION;

-- 1) Add nullable POINT column
ALTER TABLE restaurants
  ADD COLUMN location POINT NULL;

-- 2) Populate from existing lat/lng values (if present)
-- Uses WKT POINT(lng lat) — MySQL ST_GeomFromText expects 'POINT(lng lat)'
UPDATE restaurants SET location = ST_GeomFromText(CONCAT('POINT(', IFNULL(CAST(lng AS CHAR), '0'), ' ', IFNULL(CAST(lat AS CHAR), '0'), ')'))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 3) Create a spatial index to accelerate distance queries
-- For InnoDB this requires MySQL 8+. If your server doesn't support spatial indexes on InnoDB, skip this step
-- and rely on the Haversine fallback in the API.
CREATE SPATIAL INDEX idx_restaurants_location ON restaurants (location);

COMMIT;

-- If your MySQL version does not support creating SPATIAL indexes on InnoDB, consider:
--  * creating a duplicate MyISAM table for spatial queries, or
--  * using a separate geometry-enabled DB (PostGIS), or
--  * keep using the Haversine SQL fallback implemented in the API.
