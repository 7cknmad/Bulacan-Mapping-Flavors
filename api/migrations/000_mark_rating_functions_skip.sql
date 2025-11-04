-- Skip rating functions migration since functions already exist

INSERT IGNORE INTO migrations (name) VALUES ('20251032_add_rating_functions.sql');
