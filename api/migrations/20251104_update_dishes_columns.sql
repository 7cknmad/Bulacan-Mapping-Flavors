-- Add missing columns to dishes table
ALTER TABLE dishes 
  ADD COLUMN IF NOT EXISTS municipality_id INT,
  ADD COLUMN IF NOT EXISTS category_id INT,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(180),
  ADD COLUMN IF NOT EXISTS flavor_profile JSON,
  ADD COLUMN IF NOT EXISTS ingredients JSON,
  ADD COLUMN IF NOT EXISTS history TEXT,
  ADD COLUMN IF NOT EXISTS is_signature BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank INT,
  ADD COLUMN IF NOT EXISTS panel_rank INT,
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS popularity INT;

-- Add foreign key for municipality
ALTER TABLE dishes 
  ADD CONSTRAINT fk_dish_municipality 
  FOREIGN KEY (municipality_id) REFERENCES municipalities(id);

-- Add foreign key for category  
ALTER TABLE dishes 
  ADD CONSTRAINT fk_dish_category
  FOREIGN KEY (category_id) REFERENCES dish_categories(id);