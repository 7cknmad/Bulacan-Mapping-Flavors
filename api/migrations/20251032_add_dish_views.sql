-- Drop existing dish_views table if it exists
DROP TABLE IF EXISTS dish_views;

-- Create dish views table
CREATE TABLE dish_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dish_id INT NOT NULL,
    user_id INT,
    ip_address VARCHAR(45),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255),
    UNIQUE KEY unique_view_per_session (dish_id, session_id),
    INDEX idx_dish_views_dish_id (dish_id),
    INDEX idx_dish_views_viewed_at (viewed_at),
    CONSTRAINT fk_dish_views_dishes FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
    CONSTRAINT fk_dish_views_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
