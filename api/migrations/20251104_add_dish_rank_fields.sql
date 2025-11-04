-- Add featured and ranking fields to dishes
ALTER TABLE dishes 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS featured_rank INTEGER,
ADD COLUMN IF NOT EXISTS popularity INTEGER DEFAULT 0;

-- Create or replace trigger to update dish popularity based on views and ratings
CREATE OR REPLACE FUNCTION update_dish_popularity() RETURNS TRIGGER AS $$
BEGIN
    UPDATE dishes 
    SET popularity = COALESCE(view_count, 0) + (COALESCE(total_ratings, 0) * 3)
    WHERE id = COALESCE(NEW.dish_id, NEW.id, OLD.dish_id, OLD.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for dish_views
DROP TRIGGER IF EXISTS update_dish_popularity_on_view ON dish_views;
CREATE TRIGGER update_dish_popularity_on_view
    AFTER INSERT OR UPDATE OR DELETE ON dish_views
    FOR EACH ROW
    EXECUTE FUNCTION update_dish_popularity();

-- Trigger for dish rating changes
DROP TRIGGER IF EXISTS update_dish_popularity_on_rating_change ON dishes;
CREATE TRIGGER update_dish_popularity_on_rating_change
    AFTER UPDATE OF total_ratings ON dishes
    FOR EACH ROW
    EXECUTE FUNCTION update_dish_popularity();