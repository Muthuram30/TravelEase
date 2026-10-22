-- ============================================================
-- Migration 007: Premium Role System
-- ============================================================
-- Adds premium user role and feature tracking
-- Roles: user (free), premium (paid), admin (full access)

SET FOREIGN_KEY_CHECKS = 0;

-- Update users table to support premium role
ALTER TABLE users 
    MODIFY COLUMN role ENUM('user', 'premium', 'admin') DEFAULT 'user' NOT NULL;

-- Add premium features tracking
ALTER TABLE users
    ADD COLUMN premium_since DATE NULL AFTER role,
    ADD COLUMN premium_expiry DATE NULL AFTER premium_since,
    ADD COLUMN premium_features JSON NULL AFTER premium_expiry;

-- Add indexes for premium queries
ALTER TABLE users
    ADD INDEX idx_premium (role, premium_expiry);

-- Note: individual demo/premium seed users are NOT provisioned by this
-- migration. Promote a real account to premium explicitly when needed:
--   UPDATE users SET role='premium', premium_since=CURDATE(),
--     premium_expiry=DATE_ADD(CURDATE(), INTERVAL 365 DAY), ...
--   WHERE email = '<real customer email>';

-- Update admin account
UPDATE users
SET premium_features = JSON_OBJECT(
    'all_features', true
)
WHERE role = 'admin';

-- Set default features for free users
UPDATE users
SET premium_features = JSON_OBJECT(
    'basic_search', true,
    'view_packages', true,
    'basic_booking', true,
    'limited_bookings', 3
)
WHERE role = 'user' AND premium_features IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Sample Data for Testing
-- ============================================================
-- Create sample users for each role
INSERT INTO users (email, password_hash, full_name, phone, role, theme_preference, premium_since, premium_expiry, email_verified, is_active, premium_features) VALUES
('free.user@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Free User', '+91-9876543220', 'user', 'default', NULL, NULL, TRUE, TRUE, 
 JSON_OBJECT('basic_search', true, 'view_packages', true, 'basic_booking', true, 'limited_bookings', 3)),

('premium.user@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Premium User', '+91-9876543221', 'premium', 'kerala-green', DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 305 DAY), TRUE, TRUE,
 JSON_OBJECT('advanced_filters', true, 'unlimited_bookings', true, 'priority_support', true, 'exclusive_packages', true, 'route_planner', true, 'food_discovery', true))
ON DUPLICATE KEY UPDATE 
    role = 'premium',
    premium_since = DATE_SUB(CURDATE(), INTERVAL 60 DAY),
    premium_expiry = DATE_ADD(CURDATE(), INTERVAL 305 DAY);

-- ============================================================
-- Verification Query
-- ============================================================
SELECT 
    role,
    COUNT(*) as user_count,
    COUNT(CASE WHEN premium_expiry > CURDATE() THEN 1 END) as active_premium
FROM users
GROUP BY role
ORDER BY FIELD(role, 'admin', 'premium', 'user');

-- ============================================================
-- ROLE DEFINITIONS:
-- ============================================================
-- USER (Free):
--   - Basic package search
--   - View package details
--   - Limited bookings (3 per month)
--   - Basic recommendations
--   - Standard support
--
-- PREMIUM:
--   - Advanced search filters
--   - Unlimited bookings
--   - Priority customer support
--   - Exclusive premium packages
--   - Route planner access
--   - Food discovery access
--   - Smart recommendations with more criteria
--   - Early access to new features
--
-- ADMIN:
--   - All features
--   - Dashboard access
--   - User management
--   - Package management
--   - Booking management
--   - Analytics access
-- ============================================================
