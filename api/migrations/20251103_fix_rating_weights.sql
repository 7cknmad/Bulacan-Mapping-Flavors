-- Drop existing triggers
DROP TRIGGER IF EXISTS after_rating_insert;
DROP TRIGGER IF EXISTS after_rating_update;
DROP TRIGGER IF EXISTS after_rating_delete;

-- Create the insert trigger
CREATE TRIGGER after_rating_insert AFTER INSERT ON ratings FOR EACH ROW
  UPDATE dishes d
  SET 
      d.avg_rating = (
          SELECT calculate_aggregate_rating('dish', NEW.rateable_id)
      ),
      d.total_ratings = (
          SELECT COUNT(*) 
          FROM ratings 
          WHERE rateable_type = 'dish' 
          AND rateable_id = NEW.rateable_id
      )
  WHERE d.id = NEW.rateable_id AND NEW.rateable_type = 'dish';

-- Create the update trigger  
CREATE TRIGGER after_rating_update AFTER UPDATE ON ratings FOR EACH ROW
  UPDATE dishes d
  SET 
      d.avg_rating = (
          SELECT calculate_aggregate_rating('dish', NEW.rateable_id)
      )
  WHERE d.id = NEW.rateable_id AND NEW.rateable_type = 'dish';

-- Create the delete trigger
CREATE TRIGGER after_rating_delete AFTER DELETE ON ratings FOR EACH ROW
  UPDATE dishes d
  SET 
      d.avg_rating = (
          SELECT calculate_aggregate_rating('dish', OLD.rateable_id)
      ),
      d.total_ratings = (
          SELECT COUNT(*) 
          FROM ratings 
          WHERE rateable_type = 'dish' 
          AND rateable_id = OLD.rateable_id
      )
  WHERE d.id = OLD.rateable_id AND OLD.rateable_type = 'dish';

-- Recalculate all existing ratings to sync
CALL update_rating_weights();

UPDATE dishes d
SET 
    d.avg_rating = (
        SELECT calculate_aggregate_rating('dish', d.id)
    ),
    d.total_ratings = (
        SELECT COUNT(*) 
        FROM ratings 
        WHERE rateable_type = 'dish' 
        AND rateable_id = d.id
    );