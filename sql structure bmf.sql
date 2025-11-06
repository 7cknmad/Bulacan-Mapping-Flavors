-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 06, 2025 at 03:55 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `bulacan_flavors`
--

-- --------------------------------------------------------

--
-- Table structure for table `dishes`
--

CREATE TABLE `dishes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `municipality_id` int(10) UNSIGNED NOT NULL,
  `category_id` tinyint(3) UNSIGNED NOT NULL,
  `name` varchar(160) NOT NULL,
  `slug` varchar(180) NOT NULL,
  `description` text DEFAULT NULL,
  `flavor_profile` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`flavor_profile`)),
  `ingredients` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ingredients`)),
  `history` text DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `category` enum('food','delicacy','drink') NOT NULL DEFAULT 'food',
  `popularity` tinyint(3) UNSIGNED DEFAULT 0,
  `rating` decimal(2,1) DEFAULT 0.0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_signature` tinyint(1) NOT NULL DEFAULT 0,
  `panel_rank` tinyint(3) UNSIGNED DEFAULT NULL,
  `featured` tinyint(1) NOT NULL DEFAULT 0,
  `featured_rank` tinyint(4) DEFAULT NULL,
  `avg_rating` float DEFAULT 0,
  `total_ratings` int(11) DEFAULT 0,
  `view_count` int(11) DEFAULT 0,
  `signature` tinyint(1) DEFAULT 0,
  `temp_municipality_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `dishes`
--
DELIMITER $$
CREATE TRIGGER `after_dish_panel_rank_update` AFTER UPDATE ON `dishes` FOR EACH ROW BEGIN
    -- If panel_rank was set to 1, update municipality
    IF NEW.panel_rank = 1 THEN
        -- First clear any existing rank 1 dishes for this municipality
        UPDATE dishes 
        SET panel_rank = NULL
        WHERE municipality_id = NEW.municipality_id 
        AND id != NEW.id 
        AND panel_rank = 1;
        
        -- Then set this as the recommended dish
        UPDATE municipalities
        SET recommended_dish_id = NEW.id
        WHERE id = NEW.municipality_id;
    END IF;
    
    -- If panel_rank was removed from 1, clear municipality's recommendation if it was this dish
    IF OLD.panel_rank = 1 AND NEW.panel_rank != 1 THEN
        UPDATE municipalities
        SET recommended_dish_id = NULL
        WHERE id = NEW.municipality_id
        AND recommended_dish_id = NEW.id;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `before_dish_panel_rank_update` BEFORE UPDATE ON `dishes` FOR EACH ROW BEGIN
    IF NEW.panel_rank = 1 THEN
        -- Check if another dish already has rank 1
        SET @existing := (
            SELECT id FROM dishes
            WHERE municipality_id = NEW.municipality_id
            AND panel_rank = 1
            AND id != NEW.id
            LIMIT 1
        );
        
        IF @existing IS NOT NULL THEN
            -- Clear the panel_rank of the other dish
            UPDATE dishes
            SET panel_rank = NULL
            WHERE id = @existing;
        END IF;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `dish_categories`
--

CREATE TABLE `dish_categories` (
  `id` tinyint(3) UNSIGNED NOT NULL,
  `code` varchar(32) NOT NULL,
  `display_name` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dish_restaurants`
--

CREATE TABLE `dish_restaurants` (
  `dish_id` bigint(20) UNSIGNED NOT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `price_note` varchar(120) DEFAULT NULL,
  `availability` enum('regular','seasonal','preorder') DEFAULT 'regular',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `featured_rank` tinyint(3) UNSIGNED DEFAULT NULL,
  `restaurant_specific_description` text DEFAULT NULL,
  `restaurant_specific_price` decimal(8,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dish_variants`
--

CREATE TABLE `dish_variants` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `dish_id` bigint(20) UNSIGNED NOT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `images`
--

CREATE TABLE `images` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `owner_type` enum('dish','restaurant','municipality') NOT NULL,
  `owner_id` bigint(20) UNSIGNED NOT NULL,
  `url` varchar(512) NOT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `municipalities`
--

CREATE TABLE `municipalities` (
  `id` int(10) UNSIGNED NOT NULL,
  `osm_relation_id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `slug` varchar(140) NOT NULL,
  `description` text DEFAULT NULL,
  `province` varchar(80) NOT NULL DEFAULT 'Bulacan',
  `lat` decimal(9,6) NOT NULL,
  `lng` decimal(9,6) NOT NULL,
  `location_pt` point NOT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `recommended_dish_id` int(11) DEFAULT NULL,
  `osm_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ratings`
--

CREATE TABLE `ratings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `rateable_id` int(11) NOT NULL,
  `rateable_type` varchar(50) NOT NULL,
  `rating` int(11) DEFAULT NULL CHECK (`rating` between 1 and 5),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `comment` text DEFAULT NULL,
  `helpfulness_votes` int(11) DEFAULT 0,
  `is_verified_visit` tinyint(1) DEFAULT 0,
  `reported_count` int(11) DEFAULT 0,
  `response_text` text DEFAULT NULL,
  `response_date` timestamp NULL DEFAULT NULL,
  `response_by` int(11) DEFAULT NULL,
  `last_vote_date` timestamp NULL DEFAULT NULL,
  `weight` decimal(4,3) DEFAULT 1.000,
  `helpful_votes` int(11) DEFAULT 0,
  `report_votes` int(11) DEFAULT 0,
  `helpfulness_score` decimal(10,2) GENERATED ALWAYS AS (`helpful_votes` * 1.0 / nullif(`helpful_votes` + `report_votes`,0)) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `ratings`
--
DELIMITER $$
CREATE TRIGGER `after_rating_delete` AFTER DELETE ON `ratings` FOR EACH ROW BEGIN
    DECLARE total_count INT;
    DECLARE avg_rating DECIMAL(3,2);
    SET total_count = (
        SELECT COUNT(*) FROM ratings WHERE rateable_type = OLD.rateable_type AND rateable_id = OLD.rateable_id
    );
    SET avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = OLD.rateable_type AND rateable_id = OLD.rateable_id), 0);
    IF OLD.rateable_type = 'dish' THEN
        UPDATE dishes SET total_ratings = total_count, avg_rating = avg_rating WHERE id = OLD.rateable_id;
    ELSEIF OLD.rateable_type = 'restaurant' THEN
        UPDATE restaurants SET total_ratings = total_count, avg_rating = avg_rating WHERE id = OLD.rateable_id;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_rating_insert` AFTER INSERT ON `ratings` FOR EACH ROW BEGIN
    DECLARE total_count INT;
    DECLARE avg_rating DECIMAL(3,2);
    SET total_count = (
        SELECT COUNT(*) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id
    );
    SET avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id), 0);
    IF NEW.rateable_type = 'dish' THEN
        UPDATE dishes SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    ELSEIF NEW.rateable_type = 'restaurant' THEN
        UPDATE restaurants SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_rating_insert_restaurant` AFTER INSERT ON `ratings` FOR EACH ROW UPDATE restaurants SET 
  total_ratings = (SELECT COUNT(*) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = NEW.rateable_id),
  avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = 'restaurant' AND rateable_id = NEW.rateable_id), 0)
WHERE id = NEW.rateable_id
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_rating_update` AFTER UPDATE ON `ratings` FOR EACH ROW BEGIN
    DECLARE total_count INT;
    DECLARE avg_rating DECIMAL(3,2);
    SET total_count = (
        SELECT COUNT(*) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id
    );
    SET avg_rating = COALESCE((SELECT SUM(rating * weight) / SUM(weight) FROM ratings WHERE rateable_type = NEW.rateable_type AND rateable_id = NEW.rateable_id), 0);
    IF NEW.rateable_type = 'dish' THEN
        UPDATE dishes SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    ELSEIF NEW.rateable_type = 'restaurant' THEN
        UPDATE restaurants SET total_ratings = total_count, avg_rating = avg_rating WHERE id = NEW.rateable_id;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `dish_rating_update` AFTER INSERT ON `ratings` FOR EACH ROW BEGIN
  IF NEW.rateable_type = 'dish' THEN
    UPDATE dishes
    SET avg_rating = (
      SELECT IFNULL(AVG(rating), 0)
      FROM ratings
      WHERE rateable_type = 'dish'
        AND rateable_id = NEW.rateable_id
    ),
    total_ratings = (
      SELECT COUNT(rating)
      FROM ratings
      WHERE rateable_type = 'dish'
        AND rateable_id = NEW.rateable_id
    )
    WHERE id = NEW.rateable_id;
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `restaurant_rating_update` AFTER INSERT ON `ratings` FOR EACH ROW BEGIN
  IF NEW.rateable_type = 'restaurant' THEN
    UPDATE restaurants
    SET avg_rating = (
      SELECT IFNULL(AVG(rating), 0)
      FROM ratings
      WHERE rateable_type = 'restaurant'
        AND rateable_id = NEW.rateable_id
    ),
    total_ratings = (
      SELECT COUNT(rating)
      FROM ratings
      WHERE rateable_type = 'restaurant'
        AND rateable_id = NEW.rateable_id
    )
    WHERE id = NEW.rateable_id;
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `restaurants`
--

CREATE TABLE `restaurants` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(180) NOT NULL,
  `kind` enum('restaurant','stall','store','dealer','market','home-based') NOT NULL DEFAULT 'restaurant',
  `slug` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `municipality_id` int(10) UNSIGNED NOT NULL,
  `address` varchar(300) NOT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  `website` varchar(300) DEFAULT NULL,
  `facebook` varchar(300) DEFAULT NULL,
  `instagram` varchar(300) DEFAULT NULL,
  `opening_hours` varchar(240) DEFAULT NULL,
  `price_range` enum('budget','moderate','expensive') DEFAULT 'moderate',
  `cuisine_types` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`cuisine_types`)),
  `rating` decimal(2,1) DEFAULT 0.0,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `location_pt` point NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `panel_rank` tinyint(3) UNSIGNED DEFAULT NULL,
  `featured` tinyint(1) NOT NULL DEFAULT 0,
  `featured_rank` tinyint(3) UNSIGNED DEFAULT NULL,
  `avg_rating` float DEFAULT 0,
  `total_ratings` int(11) DEFAULT 0,
  `view_count` int(11) DEFAULT 0,
  `location` point NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `review_votes`
--

CREATE TABLE `review_votes` (
  `id` int(11) NOT NULL,
  `review_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `vote_type` enum('helpful','report') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `review_votes`
--
DELIMITER $$
CREATE TRIGGER `after_vote_delete` AFTER DELETE ON `review_votes` FOR EACH ROW BEGIN
    -- Update helpfulness_votes count
    IF OLD.vote_type = "helpful" THEN
        UPDATE ratings 
        SET helpfulness_votes = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = OLD.review_id 
            AND vote_type = "helpful"
        ),
        last_vote_date = NOW()
        WHERE id = OLD.review_id;
    END IF;
    
    -- Update reported_count
    IF OLD.vote_type = "report" THEN
        UPDATE ratings 
        SET reported_count = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = OLD.review_id 
            AND vote_type = "report"
        )
        WHERE id = OLD.review_id;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_vote_insert` AFTER INSERT ON `review_votes` FOR EACH ROW BEGIN
    -- Update helpfulness_votes count
    IF NEW.vote_type = "helpful" THEN
        UPDATE ratings 
        SET helpfulness_votes = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = NEW.review_id 
            AND vote_type = "helpful"
        ),
        last_vote_date = NOW()
        WHERE id = NEW.review_id;
    END IF;
    
    -- Update reported_count
    IF NEW.vote_type = "report" THEN
        UPDATE ratings 
        SET reported_count = (
            SELECT COUNT(*) 
            FROM review_votes 
            WHERE review_id = NEW.review_id 
            AND vote_type = "report"
        )
        WHERE id = NEW.review_id;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` varchar(20) NOT NULL DEFAULT 'user',
  `password_hash` varchar(255) DEFAULT NULL,
  `salt` varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_favorites`
--

CREATE TABLE `user_favorites` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `item_type` enum('dish','restaurant') NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `dishes`
--
ALTER TABLE `dishes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `fk_dish_cat` (`category_id`),
  ADD KEY `idx_dish_slug` (`slug`),
  ADD KEY `idx_dish_muni_cat` (`municipality_id`,`category_id`),
  ADD KEY `idx_dishes_featured` (`featured`,`featured_rank`),
  ADD KEY `idx_dishes_updated` (`updated_at`);
ALTER TABLE `dishes` ADD FULLTEXT KEY `ft_dish_name_desc` (`name`,`description`);

--
-- Indexes for table `dish_categories`
--
ALTER TABLE `dish_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `dish_restaurants`
--
ALTER TABLE `dish_restaurants`
  ADD PRIMARY KEY (`dish_id`,`restaurant_id`),
  ADD KEY `fk_dr_rest` (`restaurant_id`),
  ADD KEY `idx_dish_restaurants_featured` (`is_featured`,`featured_rank`);

--
-- Indexes for table `dish_variants`
--
ALTER TABLE `dish_variants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_rest_dish_name` (`restaurant_id`,`dish_id`,`name`(150)),
  ADD KEY `fk_variant_dish` (`dish_id`);

--
-- Indexes for table `images`
--
ALTER TABLE `images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_img_owner` (`owner_type`,`owner_id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `municipalities`
--
ALTER TABLE `municipalities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `idx_municipality_osm_id` (`osm_relation_id`),
  ADD UNIQUE KEY `osm_id` (`osm_id`),
  ADD KEY `idx_muni_slug` (`slug`),
  ADD KEY `idx_osm_relation_id` (`osm_relation_id`),
  ADD KEY `idx_municipalities_osm_id` (`osm_id`),
  ADD KEY `idx_municipalities_osm_relation_id` (`osm_relation_id`);

--
-- Indexes for table `ratings`
--
ALTER TABLE `ratings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`,`rateable_id`,`rateable_type`),
  ADD KEY `idx_helpfulness_votes` (`helpfulness_votes`),
  ADD KEY `idx_reported_count` (`reported_count`),
  ADD KEY `idx_is_verified` (`is_verified_visit`),
  ADD KEY `response_by` (`response_by`);

--
-- Indexes for table `restaurants`
--
ALTER TABLE `restaurants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `fk_rest_muni` (`municipality_id`),
  ADD KEY `idx_rest_slug` (`slug`),
  ADD KEY `idx_restaurants_featured` (`featured`,`featured_rank`),
  ADD KEY `idx_restaurants_updated` (`updated_at`),
  ADD SPATIAL KEY `idx_restaurants_location` (`location`);
ALTER TABLE `restaurants` ADD FULLTEXT KEY `ft_rest_name_desc` (`name`,`description`);

--
-- Indexes for table `review_votes`
--
ALTER TABLE `review_votes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_vote` (`review_id`,`user_id`,`vote_type`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_favorites`
--
ALTER TABLE `user_favorites`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_favorite` (`user_id`,`item_id`,`item_type`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `dishes`
--
ALTER TABLE `dishes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dish_categories`
--
ALTER TABLE `dish_categories`
  MODIFY `id` tinyint(3) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dish_variants`
--
ALTER TABLE `dish_variants`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `images`
--
ALTER TABLE `images`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `municipalities`
--
ALTER TABLE `municipalities`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ratings`
--
ALTER TABLE `ratings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `restaurants`
--
ALTER TABLE `restaurants`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `review_votes`
--
ALTER TABLE `review_votes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_favorites`
--
ALTER TABLE `user_favorites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `dishes`
--
ALTER TABLE `dishes`
  ADD CONSTRAINT `fk_dish_category` FOREIGN KEY (`category_id`) REFERENCES `dish_categories` (`id`),
  ADD CONSTRAINT `fk_dish_municipality` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
