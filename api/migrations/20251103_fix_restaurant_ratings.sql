-- Create separate trigger for restaurant ratings
CREATE TRIGGER after_rating_insert_restaurant AFTER INSERT ON ratings 
FOR EACH ROW 
UPDATE restaurants SET 
  total_ratings = (SELECT COUNT(*) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = NEW.rateable_id),
  avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = NEW.rateable_id), 0)
WHERE id = NEW.rateable_id;