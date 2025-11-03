-- Add OSM relation ID column to municipalities table
ALTER TABLE municipalities 
ADD COLUMN osm_relation_id BIGINT UNSIGNED NULL AFTER id,
ADD INDEX idx_osm_relation_id (osm_relation_id);
