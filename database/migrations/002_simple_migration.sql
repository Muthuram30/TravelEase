USE tourism_db;

SET FOREIGN_KEY_CHECKS = 0;

-- Drop and recreate is safer for development
DROP TABLE IF EXISTS package_tag_assignment;
DROP TABLE IF EXISTS package_tag;
DROP TABLE IF EXISTS package_exclusion;
DROP TABLE IF EXISTS package_inclusion;
DROP TABLE IF EXISTS package_itinerary_day;
DROP TABLE IF EXISTS package_image;
DROP TABLE IF EXISTS tour_package;
DROP TABLE IF EXISTS destination;

SET FOREIGN_KEY_CHECKS = 1;

-- Recreate destination
CREATE TABLE destination (
    destination_id       INT AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL UNIQUE,
    slug                 VARCHAR(120) NOT NULL UNIQUE,
    region               VARCHAR(50) NOT NULL,
    state                VARCHAR(50),
    country              VARCHAR(50) NOT NULL DEFAULT 'India',
    latitude             DECIMAL(10,8),
    longitude            DECIMAL(11,8),
    environment_category ENUM('forest', 'backwater', 'coastal', 'island', 'snow_alpine', 'desert', 'urban', 'heritage', 'tea_hills') DEFAULT NULL,
    theme_variant        ENUM('monsoon_green', 'ocean_blue', 'sunset_orange', 'ice_blue', 'neutral') DEFAULT 'neutral',
    description          TEXT,
    highlight_text       VARCHAR(255),
    meta_description     VARCHAR(160),
    featured_order       INT DEFAULT 999,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_environment (environment_category),
    INDEX idx_theme (theme_variant),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recreate tour_package
CREATE TABLE tour_package (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    package_name VARCHAR(255) NOT NULL,
    destination VARCHAR(100),
    destination_id INT DEFAULT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration VARCHAR(50),
    package_type ENUM('adventure', 'relaxation', 'cultural', 'pilgrimage', 'honeymoon', 'family', 'solo', 'group') DEFAULT NULL,
    difficulty_level ENUM('easy', 'moderate', 'challenging') DEFAULT 'easy',
    best_season VARCHAR(50),
    min_group_size INT DEFAULT 1,
    max_group_size INT DEFAULT 50,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (destination_id) REFERENCES destination(destination_id) ON DELETE SET NULL,
    INDEX idx_destination_id (destination_id),
    INDEX idx_active (is_active),
    INDEX idx_featured (is_featured),
    INDEX idx_package_type (package_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- package_image
CREATE TABLE package_image (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    image_type ENUM('primary', 'gallery', 'thumbnail') DEFAULT 'gallery',
    display_order INT NOT NULL DEFAULT 1,
    caption VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES tour_package(package_id) ON DELETE CASCADE,
    INDEX idx_package_id (package_id),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- package_itinerary_day
CREATE TABLE package_itinerary_day (
    itinerary_day_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    day_number INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    activities TEXT,
    meals_included VARCHAR(100),
    accommodation VARCHAR(200),
    FOREIGN KEY (package_id) REFERENCES tour_package(package_id) ON DELETE CASCADE,
    INDEX idx_package_id (package_id),
    UNIQUE KEY unique_package_day (package_id, day_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- package_inclusion
CREATE TABLE package_inclusion (
    inclusion_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    item VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 1,
    FOREIGN KEY (package_id) REFERENCES tour_package(package_id) ON DELETE CASCADE,
    INDEX idx_package_id (package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- package_exclusion
CREATE TABLE package_exclusion (
    exclusion_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    item VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 1,
    FOREIGN KEY (package_id) REFERENCES tour_package(package_id) ON DELETE CASCADE,
    INDEX idx_package_id (package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- package_tag
CREATE TABLE package_tag (
    tag_id INT AUTO_INCREMENT PRIMARY KEY,
    tag_name VARCHAR(50) NOT NULL UNIQUE,
    tag_slug VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_slug (tag_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- package_tag_assignment
CREATE TABLE package_tag_assignment (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    tag_id INT NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES tour_package(package_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES package_tag(tag_id) ON DELETE CASCADE,
    UNIQUE KEY unique_package_tag (package_id, tag_id),
    INDEX idx_package_id (package_id),
    INDEX idx_tag_id (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update booking (check if columns exist first)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'confirmation_token');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE booking ADD COLUMN confirmation_token VARCHAR(128) UNIQUE', 'SELECT "confirmation_token exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'payment_status');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE booking ADD COLUMN payment_status ENUM(\'pending\', \'paid\', \'failed\', \'refunded\') DEFAULT \'pending\'', 'SELECT "payment_status exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'special_requests');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE booking ADD COLUMN special_requests TEXT', 'SELECT "special_requests exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed destinations
INSERT INTO destination (name, slug, region, state, country, latitude, longitude, environment_category, theme_variant, description) VALUES
('Munnar', 'munnar', 'Western Ghats', 'Kerala', 'India', 10.0889, 77.0595, 'tea_hills', 'monsoon_green', 'Hill station with tea plantations'),
('Alappuzha', 'alappuzha', 'Coastal', 'Kerala', 'India', 9.4981, 76.3388, 'backwater', 'ocean_blue', 'Backwater destination'),
('Goa', 'goa', 'Western Coast', 'Goa', 'India', 15.2993, 74.1240, 'coastal', 'ocean_blue', 'Beach paradise'),
('Lakshadweep', 'lakshadweep', 'Arabian Sea', 'Lakshadweep', 'India', 10.5667, 72.6417, 'island', 'ocean_blue', 'Coral islands'),
('Manali', 'manali', 'Himalayas', 'Himachal Pradesh', 'India', 32.2432, 77.1892, 'snow_alpine', 'ice_blue', 'Himalayan resort'),
('Jaisalmer', 'jaisalmer', 'Thar Desert', 'Rajasthan', 'India', 26.9157, 70.9083, 'desert', 'sunset_orange', 'Golden city'),
('Delhi', 'delhi', 'Northern Plains', 'Delhi', 'India', 28.7041, 77.1025, 'urban', 'neutral', 'Capital city'),
('Hampi', 'hampi', 'Deccan Plateau', 'Karnataka', 'India', 15.3350, 76.4600, 'heritage', 'sunset_orange', 'Ancient ruins'),
('Wayanad', 'wayanad', 'Western Ghats', 'Kerala', 'India', 11.6054, 76.0830, 'forest', 'monsoon_green', 'Forest sanctuary'),
('Kovalam', 'kovalam', 'Malabar Coast', 'Kerala', 'India', 8.4004, 76.9790, 'coastal', 'ocean_blue', 'Beach town');

-- Seed tags
INSERT INTO package_tag (tag_name, tag_slug, description) VALUES
('adventure', 'adventure', 'Adventure activities'),
('relaxation', 'relaxation', 'Relaxing experiences'),
('family', 'family', 'Family-friendly'),
('honeymoon', 'honeymoon', 'Romantic getaways'),
('beach', 'beach', 'Beach destinations'),
('mountain', 'mountain', 'Mountain retreats'),
('wildlife', 'wildlife', 'Wildlife experiences'),
('culture', 'culture', 'Cultural exploration'),
('luxury', 'luxury', 'Luxury experiences'),
('budget', 'budget', 'Budget-friendly'),
('weekend', 'weekend', 'Weekend trips'),
('week-long', 'week-long', 'Week-long packages'),
('backwater', 'backwater', 'Backwater experiences'),
('heritage', 'heritage', 'Heritage sites'),
('trekking', 'trekking', 'Trekking adventures'),
('photography', 'photography', 'Photography tours'),
('ayurveda', 'ayurveda', 'Ayurvedic wellness'),
('spa', 'spa', 'Spa and wellness'),
('food-tour', 'food-tour', 'Food exploration'),
('eco-tourism', 'eco-tourism', 'Eco-friendly tourism'),
('camping', 'camping', 'Camping experiences'),
('water-sports', 'water-sports', 'Water sports'),
('snow-activities', 'snow-activities', 'Snow activities'),
('pilgrimage', 'pilgrimage', 'Pilgrimage tours'),
('solo-travel', 'solo-travel', 'Solo traveler friendly');

SELECT 'Migration completed!' AS status;
