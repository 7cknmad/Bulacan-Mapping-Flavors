-- Migration: Add triggers to update avg_rating and total_ratings for dishes/restaurants after review insert, update, and delete
DROP TRIGGER IF EXISTS after_rating_insert;
DROP TRIGGER IF EXISTS after_rating_update;
DROP TRIGGER IF EXISTS after_rating_delete;

DELIMITER //

CREATE TRIGGER after_rating_insert AFTER INSERT ON ratings
FOR EACH ROW
BEGIN
    DECLARE total_count INT;
    DECLARE avg_rating DECIMAL(3,2);
    SET total_count = (
        SELECT COUNT(*) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id
    );
    SET avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id), 0);
    IF NEW.rateable_type = 'dish' THEN
        UPDATE dishes SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    ELSEIF NEW.rateable_type = 'restaurant' THEN
        UPDATE restaurants SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    END IF;
END//

CREATE TRIGGER after_rating_update AFTER UPDATE ON ratings
FOR EACH ROW
BEGIN
    DECLARE total_count INT;
    DECLARE avg_rating DECIMAL(3,2);
    SET total_count = (
        SELECT COUNT(*) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id
    );
    SET avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id), 0);
    IF NEW.rateable_type = 'dish' THEN
        UPDATE dishes SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    ELSEIF NEW.rateable_type = 'restaurant' THEN
        UPDATE restaurants SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    END IF;
END//

CREATE TRIGGER after_rating_delete AFTER DELETE ON ratings
FOR EACH ROW
BEGIN
    DECLARE total_count INT;
    DECLARE avg_rating DECIMAL(3,2);
    SET total_count = (
        SELECT COUNT(*) FROM ratings WHERE rateable_type = OLD.rateable_type AND rateable_id = OLD.rateable_id
    );
    SET avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = OLD.rateable_type AND rateable_id = OLD.rateable_id), 0);
    IF OLD.rateable_type = 'dish' THEN
        UPDATE dishes SET total_ratings = total_count, avg_rating = avg_rating WHERE id = OLD.rateable_id;
    ELSEIF OLD.rateable_type = 'restaurant' THEN
        UPDATE restaurants SET total_ratings = total_count, avg_rating = avg_rating WHERE id = OLD.rateable_id;
    END IF;
END//

DELIMITER ;