-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS after_dish_view_insert;

DELIMITER //

-- Create trigger to update dish view count
CREATE TRIGGER after_dish_view_insert
AFTER INSERT ON dish_views
FOR EACH ROW
BEGIN
  UPDATE dishes 
  SET view_count = (
    SELECT COUNT(DISTINCT session_id) 
    FROM dish_views 
    WHERE dish_id = NEW.dish_id
  )
  WHERE id = NEW.dish_id;
END //

DELIMITER ;
