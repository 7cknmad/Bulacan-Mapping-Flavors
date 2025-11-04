-- Create the restaurant_reviews table if it doesn't exist
CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_restaurant (user_id, restaurant_id)
);

-- Create index for faster lookups
CREATE INDEX idx_restaurant_reviews_restaurant ON restaurant_reviews(restaurant_id);

-- Create a view for restaurant rating summaries
CREATE OR REPLACE VIEW restaurant_rating_summaries AS
SELECT 
  restaurant_id,
  COUNT(*) as total_ratings,
  AVG(rating) as avg_rating,
  COUNT(CASE WHEN rating >= 4 THEN 1 END) as high_ratings,
  COUNT(CASE WHEN rating <= 2 THEN 1 END) as low_ratings
FROM restaurant_reviews
GROUP BY restaurant_id;