-- ============================================================
-- Migration 005: Smart Travel Assistant Schema
-- ============================================================
-- Adds package metadata for rule-based recommendations:
-- - Interest categories (nature, beach, heritage, adventure, etc.)
-- - Season suitability (best/good/avoid months)
-- - Group type suitability (solo, couple, family, friends)
-- - Accessibility features
-- - Recommendation preferences tracking

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. PACKAGE CATEGORIES (Interest Tags)
-- ============================================================
DROP TABLE IF EXISTS package_categories;
CREATE TABLE package_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert standard categories
INSERT INTO package_categories (category_name, category_slug, icon, display_order) VALUES
('Nature & Wildlife', 'nature', '🌿', 1),
('Beach & Coastal', 'beach', '🏖️', 2),
('Heritage & Culture', 'heritage', '🏛️', 3),
('Adventure & Sports', 'adventure', '⛰️', 4),
('Food & Culinary', 'food', '🍛', 5),
('Wellness & Spa', 'wellness', '🧘', 6),
('Photography', 'photography', '📸', 7),
('Hill Station', 'hill-station', '🏔️', 8),
('Spiritual & Religious', 'spiritual', '🙏', 9),
('Backwaters & Lakes', 'backwaters', '🛶', 10),
('Shopping', 'shopping', '🛍️', 11),
('Nightlife', 'nightlife', '🌃', 12);

-- ============================================================
-- 2. PACKAGE TO CATEGORY MAPPING (Many-to-Many)
-- ============================================================
DROP TABLE IF EXISTS package_category_mapping;
CREATE TABLE package_category_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    category_id INT NOT NULL,
    relevance_weight DECIMAL(3,2) DEFAULT 1.00,
    FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES package_categories(category_id) ON DELETE CASCADE,
    UNIQUE KEY unique_package_category (package_id, category_id),
    INDEX idx_package (package_id),
    INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. SEASON SUITABILITY
-- ============================================================
DROP TABLE IF EXISTS package_season_suitability;
CREATE TABLE package_season_suitability (
    suitability_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    month_number INT NOT NULL CHECK (month_number BETWEEN 1 AND 12),
    suitability_level ENUM('best', 'good', 'okay', 'avoid') DEFAULT 'good',
    reason VARCHAR(500),
    temperature_range VARCHAR(50),
    rainfall_level VARCHAR(50),
    FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
    UNIQUE KEY unique_package_month (package_id, month_number),
    INDEX idx_package (package_id),
    INDEX idx_month (month_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. GROUP TYPE SUITABILITY
-- ============================================================
DROP TABLE IF EXISTS package_group_types;
CREATE TABLE package_group_types (
    group_type_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    group_type ENUM('solo', 'couple', 'family', 'friends', 'senior', 'kids') NOT NULL,
    suitability_score DECIMAL(3,2) DEFAULT 1.00 CHECK (suitability_score BETWEEN 0 AND 1),
    reason VARCHAR(500),
    FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
    UNIQUE KEY unique_package_group (package_id, group_type),
    INDEX idx_package (package_id),
    INDEX idx_group_type (group_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. ACCESSIBILITY FEATURES
-- ============================================================
DROP TABLE IF EXISTS package_accessibility;
CREATE TABLE package_accessibility (
    accessibility_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    wheelchair_accessible BOOLEAN DEFAULT FALSE,
    senior_friendly BOOLEAN DEFAULT FALSE,
    child_friendly BOOLEAN DEFAULT FALSE,
    medical_facilities_nearby BOOLEAN DEFAULT FALSE,
    dietary_accommodations BOOLEAN DEFAULT FALSE,
    mobility_level_required ENUM('easy', 'moderate', 'challenging', 'difficult') DEFAULT 'moderate',
    notes TEXT,
    FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
    UNIQUE KEY unique_package_accessibility (package_id),
    INDEX idx_package (package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. USER RECOMMENDATION PREFERENCES (For History-Based Scoring)
-- ============================================================
DROP TABLE IF EXISTS user_recommendation_prefs;
CREATE TABLE user_recommendation_prefs (
    pref_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    session_id VARCHAR(255) NULL,
    package_id INT NOT NULL,
    interaction_type ENUM('view', 'like', 'book', 'enquiry') NOT NULL,
    interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_session (session_id),
    INDEX idx_package (package_id),
    INDEX idx_interaction_type (interaction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. SAMPLE DATA - Map existing packages to categories
-- ============================================================
-- Note: Update package_ids based on actual packages in your database
-- This is a template - adjust based on your real package data

-- Example: Kerala Backwaters Package (assuming package_id = 1)
INSERT INTO package_category_mapping (package_id, category_id, relevance_weight) VALUES
(1, (SELECT category_id FROM package_categories WHERE category_slug = 'nature'), 1.00),
(1, (SELECT category_id FROM package_categories WHERE category_slug = 'backwaters'), 1.00),
(1, (SELECT category_id FROM package_categories WHERE category_slug = 'wellness'), 0.75);

-- Example: Goa Beach Package (assuming package_id = 2)
INSERT INTO package_category_mapping (package_id, category_id, relevance_weight) VALUES
(2, (SELECT category_id FROM package_categories WHERE category_slug = 'beach'), 1.00),
(2, (SELECT category_id FROM package_categories WHERE category_slug = 'nightlife'), 0.80),
(2, (SELECT category_id FROM package_categories WHERE category_slug = 'food'), 0.70);

-- Add sample season data for Kerala (best: Oct-Mar, avoid: Jun-Aug monsoon)
INSERT INTO package_season_suitability (package_id, month_number, suitability_level, reason) VALUES
(1, 1, 'best', 'Pleasant weather, low humidity'),
(1, 2, 'best', 'Perfect temperature for backwaters'),
(1, 3, 'good', 'Warm but comfortable'),
(1, 4, 'okay', 'Hot weather begins'),
(1, 5, 'okay', 'Hot and humid'),
(1, 6, 'avoid', 'Heavy monsoon rains'),
(1, 7, 'avoid', 'Peak monsoon season'),
(1, 8, 'avoid', 'Monsoon continues'),
(1, 9, 'okay', 'Post-monsoon, greenery peaks'),
(1, 10, 'best', 'Perfect weather after monsoon'),
(1, 11, 'best', 'Cool and pleasant'),
(1, 12, 'best', 'Ideal vacation weather');

-- Add group type suitability
INSERT INTO package_group_types (package_id, group_type, suitability_score, reason) VALUES
(1, 'couple', 1.00, 'Romantic houseboat experience'),
(1, 'family', 0.90, 'Relaxing for all ages'),
(1, 'friends', 0.70, 'Peaceful but may lack adventure'),
(1, 'solo', 0.60, 'Better with company'),
(1, 'senior', 0.95, 'Comfortable and accessible');

-- Add accessibility info
INSERT INTO package_accessibility (package_id, wheelchair_accessible, senior_friendly, child_friendly, medical_facilities_nearby, mobility_level_required, notes) VALUES
(1, FALSE, TRUE, TRUE, TRUE, 'easy', 'Houseboats may have steps. Medical facilities in Alleppey town.');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- USAGE NOTES:
-- ============================================================
-- 1. After running this migration, manually populate category mappings for all packages
-- 2. Add season suitability data for each package based on destination climate
-- 3. Set group type scores based on package characteristics
-- 4. Update accessibility info for accurate recommendations
-- 5. User interactions are tracked automatically via API calls
-- ============================================================
