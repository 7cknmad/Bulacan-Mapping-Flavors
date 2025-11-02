-- Add function to calculate weighted rating
CREATE FUNCTION calculate_weighted_rating(
    base_rating DECIMAL(3,2),
    helpfulness_votes INT,
    total_ratings INT,
    days_since_review INT,
    is_verified BOOLEAN
) RETURNS DECIMAL(4,3)
DETERMINISTIC
RETURN GREATEST(0.5, LEAST(2.0, 
    1.0 + 
    LEAST(helpfulness_votes * 0.1, 0.3) + 
    LEAST(total_ratings * 0.05, 0.2) - 
    LEAST(days_since_review / 365, 0.3) + 
    IF(is_verified, 0.2, 0.0)
));

-- Create stored procedure to update weights
CREATE PROCEDURE update_rating_weights()
UPDATE ratings r
SET weight = calculate_weighted_rating(
    r.rating,
    r.helpfulness_votes,
    (SELECT COUNT(*) FROM ratings r2 WHERE r2.rateable_id = r.rateable_id AND r2.rateable_type = r.rateable_type),
    DATEDIFF(CURRENT_DATE, r.created_at),
    r.is_verified_visit
)
WHERE r.id > 0;

-- Create function to calculate aggregate rating
CREATE FUNCTION calculate_aggregate_rating(
    p_rateable_type VARCHAR(20),
    p_rateable_id INT
) RETURNS DECIMAL(3,2)
DETERMINISTIC
RETURN (
    SELECT COALESCE(SUM(rating * weight) / SUM(weight), 0)
    FROM ratings
    WHERE rateable_type = p_rateable_type
    AND rateable_id = p_rateable_id
);

-- Create event to periodically update weights
CREATE EVENT IF NOT EXISTS update_weights_daily
ON SCHEDULE EVERY 1 DAY
DO CALL update_rating_weights();
