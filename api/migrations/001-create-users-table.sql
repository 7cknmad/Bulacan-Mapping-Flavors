-- Migration: create or alter `users` table to store application users
-- Run this against your MySQL/MariaDB instance connected to the `bulacan_flavors` database.

-- 1) Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `salt` varchar(64) DEFAULT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` varchar(20) NOT NULL DEFAULT 'user',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) If your repository already has an existing `users` table with a different schema
-- (for example with a `password` column), you can keep it; the migration above will
-- create the new columns if missing. For MySQL/MariaDB versions that support
-- ADD COLUMN IF NOT EXISTS, the following statements will be no-ops when columns exist.

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password_hash` varchar(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `salt` varchar(64) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `role` varchar(20) DEFAULT 'user';

-- Notes:
-- - After running this migration, newly-registered users will have a bcrypt hash in
--   `password_hash` and a random `salt`. Existing legacy users (if any) will remain
--   in place; you can migrate them manually or require a password reset.
