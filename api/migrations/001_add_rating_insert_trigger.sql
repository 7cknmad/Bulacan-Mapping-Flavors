-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS after_rating_insert;

CREATE TRIGGER after_rating_insert AFTER INSERT ON ratings 
FOR EACH ROW 
BEGIN 
    IF NEW.rateable_type = 'dish' THEN 
        UPDATE dishes SET 
            total_ratings = (SELECT COUNT(*) FROM ratings WHERE rateable_type = 'dish' AND rateable_id = NEW.rateable_id),
            avg_rating = (SELECT AVG(rating * weight) FROM ratings WHERE rateable_type = 'dish' AND rateable_id = NEW.rateable_id)
        WHERE id = NEW.rateable_id;
    ELSE 
        UPDATE restaurants SET 
            total_ratings = (SELECT COUNT(*) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = NEW.rateable_id),
            avg_rating = (SELECT AVG(rating * weight) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = NEW.rateable_id)
        WHERE id = NEW.rateable_id;
    END IF;
END;