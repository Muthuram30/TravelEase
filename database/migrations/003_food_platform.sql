USE tourism_db;

-- Food platform schema

CREATE TABLE IF NOT EXISTS foodspot_merchant (
    merchant_id INT AUTO_INCREMENT PRIMARY KEY,
    business_name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foodspot_location (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_id INT NOT NULL,
    venue_name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    description TEXT,
    cuisine_type VARCHAR(100),
    price_range ENUM('$', '$$', '$$$', '$$$$') DEFAULT '$$',
    seating_capacity INT,
    has_parking BOOLEAN DEFAULT FALSE,
    has_wifi BOOLEAN DEFAULT FALSE,
    is_vegetarian_only BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES foodspot_merchant(merchant_id) ON DELETE CASCADE,
    INDEX idx_merchant (merchant_id),
    INDEX idx_city (city),
    INDEX idx_cuisine (cuisine_type),
    INDEX idx_active (is_active),
    INDEX idx_coordinates (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foodspot_hours (
    hours_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (location_id) REFERENCES foodspot_location(location_id) ON DELETE CASCADE,
    UNIQUE KEY unique_location_day (location_id, day_of_week),
    INDEX idx_location (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foodspot_menu_item (
    menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(8,2) NOT NULL,
    category ENUM('appetizer', 'main_course', 'dessert', 'beverage', 'special') DEFAULT 'main_course',
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES foodspot_location(location_id) ON DELETE CASCADE,
    INDEX idx_location (location_id),
    INDEX idx_category (category),
    INDEX idx_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foodspot_image (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    image_type ENUM('cover', 'gallery', 'menu', 'interior', 'food') DEFAULT 'gallery',
    caption VARCHAR(255),
    display_order INT DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES foodspot_location(location_id) ON DELETE CASCADE,
    INDEX idx_location (location_id),
    INDEX idx_type (image_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foodspot_tag (
    tag_id INT AUTO_INCREMENT PRIMARY KEY,
    tag_name VARCHAR(50) NOT NULL UNIQUE,
    tag_slug VARCHAR(60) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foodspot_location_tag (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    tag_id INT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES foodspot_location(location_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES foodspot_tag(tag_id) ON DELETE CASCADE,
    UNIQUE KEY unique_location_tag (location_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS merchant_application_audit (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_id INT NOT NULL,
    action ENUM('created', 'approved', 'rejected', 'suspended', 'reactivated') NOT NULL,
    performed_by INT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES foodspot_merchant(merchant_id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES admin(admin_id) ON DELETE SET NULL,
    INDEX idx_merchant (merchant_id),
    INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed food tags
INSERT IGNORE INTO foodspot_tag (tag_name, tag_slug) VALUES
('authentic', 'authentic'),
('fine-dining', 'fine-dining'),
('casual', 'casual'),
('street-food', 'street-food'),
('family-friendly', 'family-friendly'),
('romantic', 'romantic'),
('rooftop', 'rooftop'),
('beachside', 'beachside'),
('traditional', 'traditional'),
('fusion', 'fusion'),
('organic', 'organic'),
('farm-to-table', 'farm-to-table');

SELECT 'Food platform migration completed!' AS status;
