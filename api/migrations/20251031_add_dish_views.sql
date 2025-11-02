CREATE TABLE dish_views (
    id SERIAL PRIMARY KEY,
    dish_id INTEGER NOT NULL REFERENCES dishes(id),
    user_id INTEGER REFERENCES users(id),
    ip_address VARCHAR(45),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255),
    CONSTRAINT unique_view_per_session UNIQUE (dish_id, session_id)
);

CREATE INDEX idx_dish_views_dish_id ON dish_views(dish_id);
CREATE INDEX idx_dish_views_viewed_at ON dish_views(viewed_at);

-- Add view_count to dishes table
ALTER TABLE dishes ADD COLUMN view_count INTEGER DEFAULT 0;

-- Update view counts based on existing views
CREATE OR REPLACE FUNCTION update_dish_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE dishes
    SET view_count = view_count + 1
    WHERE id = NEW.dish_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_dish_view_count
AFTER INSERT ON dish_views
FOR EACH ROW
EXECUTE FUNCTION update_dish_view_count();
