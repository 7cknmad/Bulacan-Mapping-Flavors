-- First, ensure all dishes with panel_rank = 1 are properly set as recommended dishes
UPDATE municipalities m
INNER JOIN dishes d ON d.municipality_id = m.id
SET m.recommended_dish_id = d.id
WHERE d.panel_rank = 1 
AND (m.recommended_dish_id IS NULL OR m.recommended_dish_id != d.id);

-- Next, clear any invalid recommended_dish_id entries
UPDATE municipalities m
SET m.recommended_dish_id = NULL
WHERE m.recommended_dish_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM dishes d 
    WHERE d.id = m.recommended_dish_id 
    AND d.panel_rank = 1
);

-- Create a trigger to maintain this relationship
DELIMITER //

CREATE OR REPLACE TRIGGER after_dish_panel_rank_update
AFTER UPDATE ON dishes
FOR EACH ROW
BEGIN
    -- If panel_rank was set to 1, update municipality
    IF NEW.panel_rank = 1 THEN
        -- First clear any existing rank 1 dishes for this municipality
        UPDATE dishes 
        SET panel_rank = NULL
        WHERE municipality_id = NEW.municipality_id 
        AND id != NEW.id 
        AND panel_rank = 1;
        
        -- Then set this as the recommended dish
        UPDATE municipalities
        SET recommended_dish_id = NEW.id
        WHERE id = NEW.municipality_id;
    END IF;
    
    -- If panel_rank was removed from 1, clear municipality's recommendation if it was this dish
    IF OLD.panel_rank = 1 AND NEW.panel_rank != 1 THEN
        UPDATE municipalities
        SET recommended_dish_id = NULL
        WHERE id = NEW.municipality_id
        AND recommended_dish_id = NEW.id;
    END IF;
END //

-- Create a trigger to prevent multiple rank 1 dishes per municipality
CREATE OR REPLACE TRIGGER before_dish_panel_rank_update
BEFORE UPDATE ON dishes
FOR EACH ROW
BEGIN
    IF NEW.panel_rank = 1 THEN
        -- Check if another dish already has rank 1
        SET @existing := (
            SELECT id FROM dishes
            WHERE municipality_id = NEW.municipality_id
            AND panel_rank = 1
            AND id != NEW.id
            LIMIT 1
        );
        
        IF @existing IS NOT NULL THEN
            -- Clear the panel_rank of the other dish
            UPDATE dishes
            SET panel_rank = NULL
            WHERE id = @existing;
        END IF;
    END IF;
END //

DELIMITER ;