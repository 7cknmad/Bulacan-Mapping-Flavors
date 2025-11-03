-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS after_rating_insert;
DROP TRIGGER IF EXISTS after_rating_update;
DROP TRIGGER IF EXISTS after_rating_delete;

-- Add trigger for when a new rating is added
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

UPDATE restaurants r
SET 
    r.avg_rating = (
        SELECT calculate_aggregate_rating('restaurant', NEW.rateable_id)
    ),
    r.total_ratings = (
        SELECT COUNT(*) 
        FROM ratings 
        WHERE rateable_type = 'restaurant' 
        AND rateable_id = NEW.rateable_id
    )
WHERE r.id = NEW.rateable_id AND NEW.rateable_type = 'restaurant';

UPDATE ratings 
SET weight = calculate_weighted_rating(
    NEW.rating,
    0, -- initial helpfulness votes
    1, -- initial total ratings count
    0, -- days since review (it's new)
    NEW.is_verified_visit
)
WHERE id = NEW.id;

-- Recalculate all existing ratings
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

UPDATE restaurants r
SET 
    r.avg_rating = (
        SELECT calculate_aggregate_rating('restaurant', r.id)
    ),
    r.total_ratings = (
        SELECT COUNT(*) 
        FROM ratings 
        WHERE rateable_type = 'restaurant' 
        AND rateable_id = r.id
    );