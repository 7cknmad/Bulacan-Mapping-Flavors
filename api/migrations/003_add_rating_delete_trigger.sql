-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS after_rating_delete;

CREATE TRIGGER after_rating_delete AFTER DELETE ON ratings 
FOR EACH ROW 
BEGIN 
    IF OLD.rateable_type = 'dish' THEN 
        UPDATE dishes SET 
            total_ratings = (SELECT COUNT(*) FROM ratings WHERE rateable_type = 'dish' AND rateable_id = OLD.rateable_id),
            avg_rating = (SELECT AVG(rating * weight) FROM ratings WHERE rateable_type = 'dish' AND rateable_id = OLD.rateable_id)
        WHERE id = OLD.rateable_id;
    ELSE 
        UPDATE restaurants SET 
            total_ratings = (SELECT COUNT(*) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = OLD.rateable_id),
            avg_rating = (SELECT AVG(rating * weight) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = OLD.rateable_id)
        WHERE id = OLD.rateable_id;
    END IF;
END;