-- ============================================================
-- TravelEase PHASE 2: Schema Normalization Migration
-- ============================================================
--
-- This migration adds:
-- 1. destination table with theme classification
-- 2. package_image table for admin-managed galleries
-- 3. package_itinerary_day table for stored itineraries
-- 4. package_tag and package_tag_assignment for recommendations
-- 5. package_inclusion and package_exclusion tables
-- 6. confirmation_token to booking table (cryptographic)
-- 7. Foreign key relationships and indexes
--
-- SAFETY: This migration is ADDITIVE ONLY — no data loss
-- Existing package and booking records are preserved
--
-- Usage:
--   mysql -u root -p tourism_db < 001_phase2_schema_normalization.sql
-- ============================================================

USE tourism_db;

-- ============================================================
-- 1. DESTINATION TABLE
-- Normalized destination/region data with theme metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS destination (
    destination_id       INT            AUTO_INCREMENT  PRIMARY KEY,
    name                 VARCHAR(100)   NOT NULL  UNIQUE,
    slug                 VARCHAR(120)   NOT NULL  UNIQUE,
    region               VARCHAR(50)    NOT NULL,
    state                VARCHAR(50),
    country              VARCHAR(50)    NOT NULL  DEFAULT 'India',
    
    -- Geographic coordinates
    latitude             DECIMAL(10,8),
    longitude            DECIMAL(11,8),
    
    -- Theme classification for adaptive UI
    environment_category ENUM('forest', 'backwater', 'coastal', 'island', 'snow_alpine', 'desert', 'urban', 'heritage', 'tea_hills') DEFAULT NULL,
    theme_variant        ENUM('monsoon_green', 'ocean_blue', 'sunset_orange', 'ice_blue', 'neutral') DEFAULT 'neutral',
    
    -- Editorial content
    description          TEXT,
    highlight_text       VARCHAR(255),
    
    -- SEO & display
    meta_description     VARCHAR(160),
    featured_order       INT           DEFAULT 999,
    is_active            BOOLEAN       NOT NULL  DEFAULT TRUE,
    
    created_at           TIMESTAMP     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_slug (slug),
    INDEX idx_environment (environment_category),
    INDEX idx_theme (theme_variant),
    INDEX idx_active (is_active)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 2. UPDATE tour_package TABLE
-- Add destination foreign key and additional metadata
-- ============================================================

-- Add new columns to existing tour_package table
ALTER TABLE tour_package 
    ADD COLUMN IF NOT EXISTS destination_id INT DEFAULT NULL AFTER destination,
    ADD COLUMN IF NOT EXISTS package_type ENUM('adventure', 'relaxation', 'cultural', 'pilgrimage', 'honeymoon', 'family', 'solo', 'group') DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS difficulty_level ENUM('easy', 'moderate', 'challenging') DEFAULT 'easy',
    ADD COLUMN IF NOT EXISTS best_season VARCHAR(50),
    ADD COLUMN IF NOT EXISTS min_group_size INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS max_group_size INT DEFAULT 50,
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add foreign key (after destination table exists)
-- Note: This will fail if destination_id references non-existent destinations
-- We'll populate destination_id values after seeding destination table
ALTER TABLE tour_package
    ADD CONSTRAINT IF NOT EXISTS fk_package_destination
        FOREIGN KEY (destination_id)
        REFERENCES destination (destination_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

-- Add indexes
ALTER TABLE tour_package
    ADD INDEX IF NOT EXISTS idx_destination_id (destination_id),
    ADD INDEX IF NOT EXISTS idx_active (is_active),
    ADD INDEX IF NOT EXISTS idx_featured (is_featured),
    ADD INDEX IF NOT EXISTS idx_package_type (package_type);


-- ============================================================
-- 3. PACKAGE IMAGE GALLERY TABLE
-- Admin-managed image galleries with ordering
-- ============================================================

CREATE TABLE IF NOT EXISTS package_image (
    image_id          INT            AUTO_INCREMENT  PRIMARY KEY,
    package_id        INT            NOT NULL,
    
    -- Stored file path (relative to upload directory)
    image_path        VARCHAR(255)   NOT NULL,
    
    -- Image metadata
    alt_text          VARCHAR(255)   NOT NULL,
    caption           VARCHAR(255),
    display_order     INT            NOT NULL  DEFAULT 0,
    is_cover_image    BOOLEAN        NOT NULL  DEFAULT FALSE,
    
    -- Asset provenance
    image_type        ENUM('photo', 'illustration', 'concept') DEFAULT 'photo',
    source_note       VARCHAR(255),
    license_status    ENUM('owned', 'licensed', 'cc', 'demo') DEFAULT 'demo',
    
    -- Technical details
    file_size_kb      INT,
    width_px          INT,
    height_px         INT,
    focal_point_x     DECIMAL(5,2)   DEFAULT 50.00,  -- percentage
    focal_point_y     DECIMAL(5,2)   DEFAULT 50.00,  -- percentage
    
    created_at        TIMESTAMP      NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (package_id)
        REFERENCES tour_package (package_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    INDEX idx_package_id (package_id),
    INDEX idx_cover_image (package_id, is_cover_image),
    INDEX idx_display_order (package_id, display_order)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 4. PACKAGE ITINERARY TABLE
-- Stored day-by-day itinerary details
-- ============================================================

CREATE TABLE IF NOT EXISTS package_itinerary_day (
    itinerary_day_id  INT            AUTO_INCREMENT  PRIMARY KEY,
    package_id        INT            NOT NULL,
    day_number        INT            NOT NULL,
    
    -- Day content
    day_title         VARCHAR(150)   NOT NULL,
    day_description   TEXT           NOT NULL,
    
    -- Optional location details
    location_name     VARCHAR(100),
    location_lat      DECIMAL(10,8),
    location_lng      DECIMAL(11,8),
    
    -- Activities
    activities        TEXT,           -- JSON or comma-separated
    meals_included    SET('breakfast', 'lunch', 'dinner', 'snacks'),
    accommodation     VARCHAR(100),
    
    -- Logistics
    transport_mode    VARCHAR(50),
    distance_km       INT,
    duration_hours    DECIMAL(4,2),
    
    created_at        TIMESTAMP      NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (package_id)
        REFERENCES tour_package (package_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    UNIQUE KEY unique_package_day (package_id, day_number),
    INDEX idx_package_id (package_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 5. PACKAGE INCLUSIONS & EXCLUSIONS
-- What's included and excluded in the package
-- ============================================================

CREATE TABLE IF NOT EXISTS package_inclusion (
    inclusion_id      INT            AUTO_INCREMENT  PRIMARY KEY,
    package_id        INT            NOT NULL,
    inclusion_text    VARCHAR(255)   NOT NULL,
    display_order     INT            NOT NULL  DEFAULT 0,
    icon_name         VARCHAR(50),   -- Material icon name
    
    FOREIGN KEY (package_id)
        REFERENCES tour_package (package_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    INDEX idx_package_id (package_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_exclusion (
    exclusion_id      INT            AUTO_INCREMENT  PRIMARY KEY,
    package_id        INT            NOT NULL,
    exclusion_text    VARCHAR(255)   NOT NULL,
    display_order     INT            NOT NULL  DEFAULT 0,
    
    FOREIGN KEY (package_id)
        REFERENCES tour_package (package_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    INDEX idx_package_id (package_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 6. PACKAGE TAGGING SYSTEM
-- For recommendation engine and filtering
-- ============================================================

CREATE TABLE IF NOT EXISTS package_tag (
    tag_id            INT            AUTO_INCREMENT  PRIMARY KEY,
    tag_name          VARCHAR(50)    NOT NULL  UNIQUE,
    tag_slug          VARCHAR(60)    NOT NULL  UNIQUE,
    tag_category      ENUM('interest', 'activity', 'season', 'audience', 'style') NOT NULL,
    description       VARCHAR(255),
    
    INDEX idx_category (tag_category)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_tag_assignment (
    package_id        INT            NOT NULL,
    tag_id            INT            NOT NULL,
    
    PRIMARY KEY (package_id, tag_id),
    
    FOREIGN KEY (package_id)
        REFERENCES tour_package (package_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    FOREIGN KEY (tag_id)
        REFERENCES package_tag (tag_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    INDEX idx_package_id (package_id),
    INDEX idx_tag_id (tag_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 7. UPDATE booking TABLE
-- Add cryptographic confirmation token (replaces sequential ID lookup)
-- ============================================================

ALTER TABLE booking
    ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(64) UNIQUE DEFAULT NULL AFTER booking_id,
    ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'partial', 'completed', 'refunded') DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS special_requests TEXT,
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add index for token lookup (primary access method)
ALTER TABLE booking
    ADD INDEX IF NOT EXISTS idx_confirmation_token (confirmation_token);

-- Add index for status queries
ALTER TABLE booking
    ADD INDEX IF NOT EXISTS idx_booking_status (booking_status),
    ADD INDEX IF NOT EXISTS idx_payment_status (payment_status);


-- ============================================================
-- 8. SEED DESTINATION DATA
-- Initial destinations from existing packages
-- ============================================================

INSERT INTO destination (name, slug, region, state, environment_category, theme_variant, description, highlight_text, featured_order) VALUES
    ('Kerala Backwaters', 'kerala-backwaters', 'South India', 'Kerala', 'backwater', 'monsoon_green', 
     'Tranquil backwater cruises through palm-lined canals, traditional houseboats, and lush tropical landscapes.',
     'Houseboat rides, lush green backwaters, Ayurvedic retreats', 1),
    
    ('Goa Beaches', 'goa-beaches', 'West India', 'Goa', 'coastal', 'ocean_blue',
     'Golden sandy beaches, Portuguese architecture, vibrant nightlife, and water sports.',
     'Golden beaches, water sports, Portuguese heritage', 2),
    
    ('Rajasthan Heritage', 'rajasthan-heritage', 'North India', 'Rajasthan', 'desert', 'neutral',
     'Majestic forts, royal palaces, desert landscapes, and vibrant cultural traditions.',
     'Majestic forts, camel safaris, vibrant culture', 3),
    
    ('Kashmir Valley', 'kashmir-valley', 'North India', 'Jammu & Kashmir', 'snow_alpine', 'ice_blue',
     'Himalayan snow peaks, Dal Lake shikaras, Mughal gardens, and alpine meadows.',
     'Dal Lake, Gulmarg snow, Mughal gardens', 4),
    
    ('Andaman Islands', 'andaman-islands', 'Island Territory', 'Andaman & Nicobar', 'island', 'ocean_blue',
     'Pristine beaches, coral reefs, scuba diving, and untouched tropical paradise.',
     'Crystal waters, scuba diving, virgin beaches', 5),
    
    ('Darjeeling Tea Hills', 'darjeeling-tea-hills', 'East India', 'West Bengal', 'tea_hills', 'monsoon_green',
     'Rolling tea estates, toy train heritage, and views of Kanchenjunga peaks.',
     'Tea estates, Toy train, Kanchenjunga views', 6),
    
    ('Varanasi Ghats', 'varanasi-ghats', 'North India', 'Uttar Pradesh', 'urban', 'neutral',
     'Ancient spiritual city on the Ganges, sacred ghats, temples, and evening aarti.',
     'Ganga aarti, ancient temples, city of light', 7),
    
    ('Manali & Leh', 'manali-leh', 'North India', 'Himachal Pradesh & Ladakh', 'snow_alpine', 'ice_blue',
     'High-altitude Himalayan adventure, snow passes, monasteries, and stunning landscapes.',
     'Skiing, trekking, Rohtang Pass, Solang Valley', 8),
    
    ('Coorg Coffee Hills', 'coorg-coffee-hills', 'South India', 'Karnataka', 'forest', 'monsoon_green',
     'Misty coffee plantations, waterfalls, wildlife sanctuaries, and serene hill station.',
     'Coffee plantations, Abbey Falls, misty hills', 9),
    
    ('Meghalaya Valleys', 'meghalaya-valleys', 'Northeast India', 'Meghalaya', 'forest', 'monsoon_green',
     'Living root bridges, wettest place on Earth, crystal clear rivers, and tribal culture.',
     'Living root bridges, Cherrapunji waterfalls, pristine valleys', 10)
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- ============================================================
-- 9. LINK EXISTING PACKAGES TO DESTINATIONS
-- Match existing tour_package.destination strings to destination IDs
-- ============================================================

UPDATE tour_package tp
JOIN destination d ON (
    tp.destination LIKE CONCAT('%', d.name, '%')
    OR tp.destination LIKE CONCAT('%', d.state, '%')
)
SET tp.destination_id = d.destination_id
WHERE tp.destination_id IS NULL;

-- Manual mappings for specific cases
UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'kerala-backwaters')
WHERE destination LIKE '%Kerala%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'goa-beaches')
WHERE destination LIKE '%Goa%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'rajasthan-heritage')
WHERE destination LIKE '%Rajasthan%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'kashmir-valley')
WHERE destination LIKE '%Kashmir%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'andaman-islands')
WHERE destination LIKE '%Andaman%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'darjeeling-tea-hills')
WHERE destination LIKE '%Darjeeling%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'varanasi-ghats')
WHERE destination LIKE '%Varanasi%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'manali-leh')
WHERE (destination LIKE '%Manali%' OR destination LIKE '%Leh%') AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'coorg-coffee-hills')
WHERE destination LIKE '%Coorg%' AND destination_id IS NULL;

UPDATE tour_package SET destination_id = (SELECT destination_id FROM destination WHERE slug = 'meghalaya-valleys')
WHERE (destination LIKE '%Meghalaya%' OR destination LIKE '%Shillong%' OR destination LIKE '%Cherrapunji%') AND destination_id IS NULL;


-- ============================================================
-- 10. SEED PACKAGE TAGS
-- Common travel interest tags for recommendation engine
-- ============================================================

INSERT INTO package_tag (tag_name, tag_slug, tag_category, description) VALUES
    -- Interest tags
    ('Nature & Wildlife', 'nature-wildlife', 'interest', 'Natural landscapes and wildlife experiences'),
    ('Beach & Coastal', 'beach-coastal', 'interest', 'Beach destinations and coastal activities'),
    ('Mountains & Snow', 'mountains-snow', 'interest', 'Mountain destinations and snow activities'),
    ('Heritage & Culture', 'heritage-culture', 'interest', 'Historical sites and cultural experiences'),
    ('Spiritual & Pilgrimage', 'spiritual-pilgrimage', 'interest', 'Temples, religious sites, spiritual journeys'),
    ('Adventure Sports', 'adventure-sports', 'interest', 'Trekking, skiing, water sports, adventure activities'),
    ('Relaxation & Wellness', 'relaxation-wellness', 'interest', 'Spa, yoga, Ayurveda, peaceful retreats'),
    ('Food & Cuisine', 'food-cuisine', 'interest', 'Culinary experiences and local food'),
    
    -- Activity tags
    ('Trekking & Hiking', 'trekking-hiking', 'activity', 'Walking and hiking activities'),
    ('Water Sports', 'water-sports', 'activity', 'Swimming, diving, boating, kayaking'),
    ('Sightseeing', 'sightseeing', 'activity', 'Guided tours and landmark visits'),
    ('Photography', 'photography', 'activity', 'Scenic photography opportunities'),
    ('Camping', 'camping', 'activity', 'Outdoor camping experiences'),
    
    -- Season tags
    ('Summer Getaway', 'summer-getaway', 'season', 'Best for summer months'),
    ('Monsoon Magic', 'monsoon-magic', 'season', 'Ideal during monsoon season'),
    ('Winter Wonderland', 'winter-wonderland', 'season', 'Perfect for winter travel'),
    ('Year Round', 'year-round', 'season', 'Suitable all year'),
    
    -- Audience tags
    ('Family Friendly', 'family-friendly', 'audience', 'Suitable for families with children'),
    ('Honeymoon Special', 'honeymoon-special', 'audience', 'Romantic destinations for couples'),
    ('Solo Traveler', 'solo-traveler', 'audience', 'Great for solo exploration'),
    ('Group Tour', 'group-tour', 'audience', 'Designed for group travel'),
    ('Senior Friendly', 'senior-friendly', 'audience', 'Easy pace, comfortable for seniors'),
    
    -- Style tags
    ('Luxury', 'luxury', 'style', 'Premium accommodations and services'),
    ('Budget Friendly', 'budget-friendly', 'style', 'Affordable travel options'),
    ('Eco-Tourism', 'eco-tourism', 'style', 'Sustainable and eco-friendly travel'),
    ('Offbeat', 'offbeat', 'style', 'Unique, less-traveled destinations')
ON DUPLICATE KEY UPDATE tag_name = VALUES(tag_name);


-- ============================================================
-- 11. GENERATE CONFIRMATION TOKENS FOR EXISTING BOOKINGS
-- Create secure tokens for bookings that don't have them yet
-- ============================================================

-- Note: This uses SHA2 with booking data as seed for deterministic token generation
-- In production, consider using a stored procedure with RANDOM_BYTES() if supported
UPDATE booking
SET confirmation_token = LOWER(
    CONCAT(
        SHA2(CONCAT('travelease-', booking_id, '-', tourist_id, '-', UNIX_TIMESTAMP(created_at)), 256),
        SHA2(CONCAT(package_id, '-', booking_date, '-', total_cost), 256)
    )
)
WHERE confirmation_token IS NULL;

-- Ensure uniqueness (should be guaranteed by SHA2, but verify)
-- If duplicate tokens exist, regenerate with additional entropy
UPDATE booking b1
JOIN (
    SELECT confirmation_token, MIN(booking_id) as min_id
    FROM booking
    WHERE confirmation_token IS NOT NULL
    GROUP BY confirmation_token
    HAVING COUNT(*) > 1
) b2 ON b1.confirmation_token = b2.confirmation_token
SET b1.confirmation_token = LOWER(SHA2(CONCAT(b1.confirmation_token, '-', b1.booking_id, '-', RAND()), 256))
WHERE b1.booking_id != b2.min_id;


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

SELECT 'PHASE 2 Migration Complete!' as status,
       (SELECT COUNT(*) FROM destination) as destinations_count,
       (SELECT COUNT(*) FROM tour_package WHERE destination_id IS NOT NULL) as packages_linked,
       (SELECT COUNT(*) FROM package_tag) as tags_count,
       (SELECT COUNT(*) FROM booking WHERE confirmation_token IS NOT NULL) as bookings_tokenized;
