-- Ensure rating aggregates update correctly on insert/update/delete
-- Safe to re-run: drops then recreates helpers and triggers

DROP TRIGGER IF EXISTS ratings_after_insert;
DROP TRIGGER IF EXISTS ratings_after_update;
DROP TRIGGER IF EXISTS ratings_after_delete;
DROP PROCEDURE IF EXISTS recalc_entity_rating;

-- Helper procedure to recalculate avg_rating and total_ratings for a single entity
CREATE PROCEDURE recalc_entity_rating(
    IN p_type VARCHAR(20),
    IN p_id INT
)
BEGIN
    IF p_type = 'dish' THEN
        UPDATE dishes d
        SET d.avg_rating = (
                SELECT COALESCE(SUM(r.rating * r.weight) / NULLIF(SUM(r.weight), 0), 0)
                FROM ratings r
                WHERE r.rateable_type = 'dish' AND r.rateable_id = p_id
            ),
            d.total_ratings = (
                SELECT COUNT(*) FROM ratings r
                WHERE r.rateable_type = 'dish' AND r.rateable_id = p_id
            )
        WHERE d.id = p_id;
    ELSEIF p_type = 'restaurant' THEN
        UPDATE restaurants rtab
        SET rtab.avg_rating = (
                SELECT COALESCE(SUM(r.rating * r.weight) / NULLIF(SUM(r.weight), 0), 0)
                FROM ratings r
                WHERE r.rateable_type = 'restaurant' AND r.rateable_id = p_id
            ),
            rtab.total_ratings = (
                SELECT COUNT(*) FROM ratings r
                WHERE r.rateable_type = 'restaurant' AND r.rateable_id = p_id
            )
        WHERE rtab.id = p_id;
    END IF;
END;

-- When a new rating is added
CREATE TRIGGER ratings_after_insert
AFTER INSERT ON ratings
FOR EACH ROW
BEGIN
    CALL recalc_entity_rating(NEW.rateable_type, NEW.rateable_id);
END;

-- When a rating is updated (may also move between entities)
CREATE TRIGGER ratings_after_update
AFTER UPDATE ON ratings
FOR EACH ROW
BEGIN
    IF (OLD.rateable_id <> NEW.rateable_id) OR (OLD.rateable_type <> NEW.rateable_type) THEN
        CALL recalc_entity_rating(OLD.rateable_type, OLD.rateable_id);
    END IF;
    CALL recalc_entity_rating(NEW.rateable_type, NEW.rateable_id);
END;

-- When a rating is deleted
CREATE TRIGGER ratings_after_delete
AFTER DELETE ON ratings
FOR EACH ROW
BEGIN
    CALL recalc_entity_rating(OLD.rateable_type, OLD.rateable_id);
END;
