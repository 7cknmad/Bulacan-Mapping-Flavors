-- Add new columns to ratings table for enhanced rating system
ALTER TABLE ratings
ADD COLUMN helpfulness_votes INT DEFAULT 0,
ADD COLUMN is_verified_visit BOOLEAN DEFAULT FALSE,
ADD COLUMN reported_count INT DEFAULT 0,
ADD COLUMN response_text TEXT,
ADD COLUMN response_date TIMESTAMP NULL,
ADD COLUMN response_by INT,
ADD COLUMN last_vote_date TIMESTAMP NULL,
ADD COLUMN weight DECIMAL(4,3) DEFAULT 1.0,
ADD INDEX idx_helpfulness_votes (helpfulness_votes),
ADD INDEX idx_reported_count (reported_count),
ADD INDEX idx_is_verified (is_verified_visit),
ADD FOREIGN KEY (response_by) REFERENCES users(id);

-- Add table for review votes
CREATE TABLE review_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    user_id INT NOT NULL,
    vote_type ENUM('helpful', 'report') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vote (review_id, user_id, vote_type),
    FOREIGN KEY (review_id) REFERENCES ratings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add trigger to update helpfulness_votes and weight
DELIMITER //

CREATE TRIGGER after_vote_insert
AFTER INSERT ON review_votes
FOR EACH ROW
BEGIN
    -- Update helpfulness_votes count
    IF NEW.vote_type = 'helpful' THEN
        UPDATE ratings 
        SET helpfulness_votes = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = NEW.review_id 
            AND vote_type = 'helpful'
        ),
        last_vote_date = NOW()
        WHERE id = NEW.review_id;
    END IF;
    
    -- Update reported_count
    IF NEW.vote_type = 'report' THEN
        UPDATE ratings 
        SET reported_count = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = NEW.review_id 
            AND vote_type = 'report'
        )
        WHERE id = NEW.review_id;
    END IF;
END //

CREATE TRIGGER after_vote_delete
AFTER DELETE ON review_votes
FOR EACH ROW
BEGIN
    -- Update helpfulness_votes count
    IF OLD.vote_type = 'helpful' THEN
        UPDATE ratings 
        SET helpfulness_votes = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = OLD.review_id 
            AND vote_type = 'helpful'
        ),
        last_vote_date = NOW()
        WHERE id = OLD.review_id;
    END IF;
    
    -- Update reported_count
    IF OLD.vote_type = 'report' THEN
        UPDATE ratings 
        SET reported_count = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = OLD.review_id 
            AND vote_type = 'report'
        )
        WHERE id = OLD.review_id;
    END IF;
END //

DELIMITER ;

-- Add function to calculate weighted rating
DELIMITER //

CREATE FUNCTION calculate_weighted_rating(
    base_rating DECIMAL(3,2),
    helpfulness_votes INT,
    total_ratings INT,
    days_since_review INT,
    is_verified BOOLEAN
) RETURNS DECIMAL(4,3)
DETERMINISTIC
BEGIN
    DECLARE weight DECIMAL(4,3);
    
    -- Start with base weight of 1.0
    SET weight = 1.0;
    
    -- Add weight for helpfulness votes (up to 0.3 extra)
    SET weight = weight + LEAST(helpfulness_votes * 0.1, 0.3);
    
    -- Add weight for total ratings (up to 0.2 extra)
    SET weight = weight + LEAST(total_ratings * 0.05, 0.2);
    
    -- Reduce weight for old reviews (up to -0.3)
    SET weight = weight - LEAST(days_since_review / 365, 0.3);
    
    -- Add weight for verified visits
    IF is_verified THEN
        SET weight = weight + 0.2;
    END IF;
    
    -- Ensure weight stays between 0.5 and 2.0
    RETURN GREATEST(0.5, LEAST(2.0, weight));
END //

DELIMITER ;

-- Create stored procedure to update weights
DELIMITER //

CREATE PROCEDURE update_rating_weights()
BEGIN
    UPDATE ratings r
    SET weight = calculate_weighted_rating(
        r.rating,
        r.helpfulness_votes,
        (SELECT COUNT(*) FROM ratings r2 WHERE r2.rateable_id = r.rateable_id AND r2.rateable_type = r.rateable_type),
        DATEDIFF(CURRENT_DATE, r.created_at),
        r.is_verified_visit
    )
    WHERE r.id > 0;
END //

DELIMITER ;

-- Create event to periodically update weights
CREATE EVENT IF NOT EXISTS update_weights_daily
ON SCHEDULE EVERY 1 DAY
DO CALL update_rating_weights();

-- Update the recalcAggregatesFor function to use weighted ratings
DROP FUNCTION IF EXISTS calculate_aggregate_rating;
DELIMITER //

CREATE FUNCTION calculate_aggregate_rating(
    p_rateable_type VARCHAR(20),
    p_rateable_id INT
) RETURNS DECIMAL(3,2)
DETERMINISTIC
BEGIN
    DECLARE avg_rating DECIMAL(3,2);
    
    SELECT 
        COALESCE(
            SUM(rating * weight) / SUM(weight),
            0
        ) INTO avg_rating
    FROM ratings
    WHERE rateable_type = p_rateable_type
    AND rateable_id = p_rateable_id;
    
    RETURN avg_rating;
END //

DELIMITER ;