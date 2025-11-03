-- Check dishes with panel_rank = 1 (these should be recommended)
SELECT d.id as dish_id, d.name as dish_name, d.panel_rank, d.municipality_id,
       m.name as municipality_name, m.recommended_dish_id
FROM dishes d
LEFT JOIN municipalities m ON d.municipality_id = m.id
WHERE d.panel_rank = 1
   OR m.recommended_dish_id IS NOT NULL;

-- Check municipalities with recommended dishes
SELECT m.id as muni_id, m.name as municipality_name, 
       m.recommended_dish_id,
       d.name as recommended_dish_name,
       d.panel_rank as dish_panel_rank
FROM municipalities m
LEFT JOIN dishes d ON m.recommended_dish_id = d.id
WHERE m.recommended_dish_id IS NOT NULL
   OR EXISTS (SELECT 1 FROM dishes WHERE municipality_id = m.id AND panel_rank = 1);