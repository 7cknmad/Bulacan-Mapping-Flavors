-- Migration: Add recommended_dish_id to municipalities
ALTER TABLE municipalities ADD COLUMN recommended_dish_id INT NULL;