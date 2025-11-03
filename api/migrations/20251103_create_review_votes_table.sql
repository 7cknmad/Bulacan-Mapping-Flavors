-- Create ratings table if it doesn't exist first
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
    response_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (response_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create review_votes table if it doesn't exist
CREATE TABLE IF NOT EXISTS review_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    user_id INT NOT NULL,
    vote_type ENUM('helpful', 'report') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vote (review_id, user_id, vote_type),
    FOREIGN KEY (review_id) REFERENCES ratings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add helpful_votes column to ratings if it doesn't exist
ALTER TABLE ratings 
ADD COLUMN IF NOT EXISTS helpful_votes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS report_votes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified_visit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS helpfulness_score DECIMAL(10,2) GENERATED ALWAYS AS 
    ((helpful_votes * 1.0) / NULLIF(helpful_votes + report_votes, 0)) STORED;