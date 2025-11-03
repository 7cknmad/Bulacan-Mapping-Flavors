-- First, ensure the users table exists with proper structure for review features
ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS role ENUM('user', 'admin', 'owner') DEFAULT 'user';

-- Create or update the ratings table structure
CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    rateable_id INT NOT NULL,
    rateable_type ENUM('dish', 'restaurant') NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    weight DECIMAL(3,2) DEFAULT 1.0,
    helpful_votes INT DEFAULT 0,
    report_votes INT DEFAULT 0,
    is_verified_visit BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_by INT,
    response_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (response_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_rateable (rateable_type, rateable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the review_votes table
CREATE TABLE IF NOT EXISTS review_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    user_id INT NOT NULL,
    vote_type ENUM('helpful', 'report') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vote (review_id, user_id, vote_type),
    FOREIGN KEY (review_id) REFERENCES ratings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_review_votes (review_id, vote_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add review stats columns to dishes and restaurants if they don't exist
ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_ratings INT DEFAULT 0;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_ratings INT DEFAULT 0;

-- Create triggers to update avg_rating and total_ratings
DELIMITER //

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS after_rating_insert//
DROP TRIGGER IF EXISTS after_rating_update//
DROP TRIGGER IF EXISTS after_rating_delete//

-- Create trigger for new ratings
CREATE TRIGGER after_rating_insert AFTER INSERT ON ratings
FOR EACH ROW
BEGIN
    -- First calculate and set the initial weight for the new rating
    DECLARE total_count INT;
    SET total_count = (
        SELECT COUNT(*) 
        FROM ratings 
        WHERE rateable_type = NEW.rateable_type 
        AND rateable_id = NEW.rateable_id
    );
    
    -- Calculate initial weight (without helpful votes since it's new)
    UPDATE ratings 
    SET weight = GREATEST(0.5, LEAST(2.0,
        1.0 + -- base weight
        LEAST(total_count * 0.05, 0.2) + -- volume bonus
        IF(NEW.is_verified_visit, 0.2, 0.0) -- verification bonus
        -- Note: No age penalty for new reviews
    ))
    WHERE id = NEW.id;

    -- Then update the aggregate ratings
    IF NEW.rateable_type = 'dish' THEN
        UPDATE dishes SET
            total_ratings = total_count,
            avg_rating = (
                SELECT SUM(rating * weight) / SUM(weight)
                FROM ratings 
                WHERE rateable_type = 'dish' 
                AND rateable_id = NEW.rateable_id
            )
        WHERE id = NEW.rateable_id;
    ELSE
        UPDATE restaurants SET
            total_ratings = total_count,
            avg_rating = (
                SELECT SUM(rating * weight) / SUM(weight)
                FROM ratings 
                WHERE rateable_type = 'restaurant' 
                AND rateable_id = NEW.rateable_id
            )
        WHERE id = NEW.rateable_id;
    END IF;
END//

-- Create trigger for updated ratings
CREATE TRIGGER after_rating_update AFTER UPDATE ON ratings
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
END//

-- Create trigger for deleted ratings
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
END//

DELIMITER ;