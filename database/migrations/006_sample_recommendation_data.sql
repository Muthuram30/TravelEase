-- ============================================================
-- Sample Data for Smart Travel Assistant Testing
-- ============================================================
-- Populates recommendation metadata for existing packages
-- Run after migration 005

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- Map packages to categories
-- ============================================================
-- Get package IDs first - adjust based on actual package data
SET @kerala_pkg = (SELECT package_id FROM packages WHERE package_name LIKE '%Kerala%' OR destination LIKE '%Kerala%' LIMIT 1);
SET @goa_pkg = (SELECT package_id FROM packages WHERE package_name LIKE '%Goa%' OR destination LIKE '%Goa%' LIMIT 1);
SET @rajasthan_pkg = (SELECT package_id FROM packages WHERE package_name LIKE '%Rajasthan%' OR destination LIKE '%Rajasthan%' OR destination LIKE '%Jaipur%' LIMIT 1);

-- Kerala package categories (if exists)
INSERT IGNORE INTO package_category_mapping (package_id, category_id, relevance_weight)
SELECT @kerala_pkg, category_id, 1.00 FROM package_categories WHERE category_slug = 'nature' AND @kerala_pkg IS NOT NULL
UNION ALL
SELECT @kerala_pkg, category_id, 1.00 FROM package_categories WHERE category_slug = 'backwaters' AND @kerala_pkg IS NOT NULL
UNION ALL
SELECT @kerala_pkg, category_id, 0.80 FROM package_categories WHERE category_slug = 'wellness' AND @kerala_pkg IS NOT NULL
UNION ALL
SELECT @kerala_pkg, category_id, 0.70 FROM package_categories WHERE category_slug = 'food' AND @kerala_pkg IS NOT NULL;

-- Goa package categories (if exists)
INSERT IGNORE INTO package_category_mapping (package_id, category_id, relevance_weight)
SELECT @goa_pkg, category_id, 1.00 FROM package_categories WHERE category_slug = 'beach' AND @goa_pkg IS NOT NULL
UNION ALL
SELECT @goa_pkg, category_id, 0.80 FROM package_categories WHERE category_slug = 'nightlife' AND @goa_pkg IS NOT NULL
UNION ALL
SELECT @goa_pkg, category_id, 0.75 FROM package_categories WHERE category_slug = 'food' AND @goa_pkg IS NOT NULL
UNION ALL
SELECT @goa_pkg, category_id, 0.60 FROM package_categories WHERE category_slug = 'adventure' AND @goa_pkg IS NOT NULL;

-- Rajasthan package categories (if exists)
INSERT IGNORE INTO package_category_mapping (package_id, category_id, relevance_weight)
SELECT @rajasthan_pkg, category_id, 1.00 FROM package_categories WHERE category_slug = 'heritage' AND @rajasthan_pkg IS NOT NULL
UNION ALL
SELECT @rajasthan_pkg, category_id, 0.90 FROM package_categories WHERE category_slug = 'photography' AND @rajasthan_pkg IS NOT NULL
UNION ALL
SELECT @rajasthan_pkg, category_id, 0.70 FROM package_categories WHERE category_slug = 'food' AND @rajasthan_pkg IS NOT NULL
UNION ALL
SELECT @rajasthan_pkg, category_id, 0.50 FROM package_categories WHERE category_slug = 'shopping' AND @rajasthan_pkg IS NOT NULL;

-- ============================================================
-- Season suitability for all packages
-- ============================================================
-- Kerala - Best Oct-Mar, Avoid Jun-Aug (monsoon)
INSERT IGNORE INTO package_season_suitability (package_id, month_number, suitability_level, reason)
SELECT @kerala_pkg, 1, 'best', 'Pleasant weather, low humidity' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 2, 'best', 'Perfect temperature' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 3, 'good', 'Warm but comfortable' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 4, 'okay', 'Hot weather begins' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 5, 'okay', 'Hot and humid' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 6, 'avoid', 'Heavy monsoon rains' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 7, 'avoid', 'Peak monsoon season' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 8, 'avoid', 'Monsoon continues' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 9, 'okay', 'Post-monsoon greenery' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 10, 'best', 'Perfect weather' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 11, 'best', 'Cool and pleasant' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 12, 'best', 'Ideal vacation weather' WHERE @kerala_pkg IS NOT NULL;

-- Goa - Best Nov-Feb, Okay May-Oct
INSERT IGNORE INTO package_season_suitability (package_id, month_number, suitability_level, reason)
SELECT @goa_pkg, 1, 'best', 'Perfect beach weather' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 2, 'best', 'Dry and sunny' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 3, 'good', 'Still pleasant' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 4, 'okay', 'Getting hot' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 5, 'okay', 'Hot and humid' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 6, 'avoid', 'Monsoon begins' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 7, 'avoid', 'Heavy rains' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 8, 'avoid', 'Monsoon continues' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 9, 'okay', 'Post-monsoon' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 10, 'good', 'Weather improves' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 11, 'best', 'Peak season starts' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 12, 'best', 'Perfect weather' WHERE @goa_pkg IS NOT NULL;

-- Rajasthan - Best Oct-Mar, Avoid May-Jul (extreme heat)
INSERT IGNORE INTO package_season_suitability (package_id, month_number, suitability_level, reason)
SELECT @rajasthan_pkg, 1, 'best', 'Cool and pleasant' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 2, 'best', 'Ideal sightseeing weather' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 3, 'good', 'Warm days, cool nights' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 4, 'okay', 'Getting hot' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 5, 'avoid', 'Extreme heat' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 6, 'avoid', 'Very hot' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 7, 'avoid', 'Hottest month' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 8, 'okay', 'Monsoon relief' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 9, 'okay', 'Post-monsoon' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 10, 'best', 'Perfect weather' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 11, 'best', 'Cool and clear' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 12, 'best', 'Pleasant winter' WHERE @rajasthan_pkg IS NOT NULL;

-- ============================================================
-- Group type suitability
-- ============================================================
-- Kerala - Great for couples and families
INSERT IGNORE INTO package_group_types (package_id, group_type, suitability_score, reason)
SELECT @kerala_pkg, 'couple', 1.00, 'Romantic houseboat experience' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 'family', 0.90, 'Relaxing for all ages' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 'friends', 0.70, 'Peaceful atmosphere' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 'solo', 0.60, 'Better with company' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @kerala_pkg, 'senior', 0.95, 'Comfortable and accessible' WHERE @kerala_pkg IS NOT NULL;

-- Goa - Great for friends and couples
INSERT IGNORE INTO package_group_types (package_id, group_type, suitability_score, reason)
SELECT @goa_pkg, 'friends', 1.00, 'Vibrant nightlife and activities' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 'couple', 0.95, 'Romantic beaches' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 'family', 0.85, 'Beach fun for all' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 'solo', 0.80, 'Social atmosphere' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, 'senior', 0.60, 'Can be crowded' WHERE @goa_pkg IS NOT NULL;

-- Rajasthan - Great for families and heritage lovers
INSERT IGNORE INTO package_group_types (package_id, group_type, suitability_score, reason)
SELECT @rajasthan_pkg, 'family', 1.00, 'Educational and cultural' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 'couple', 0.90, 'Romantic palaces' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 'friends', 0.85, 'Adventure and culture' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 'solo', 0.75, 'Rich experiences' WHERE @rajasthan_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, 'senior', 0.80, 'Comfortable hotels available' WHERE @rajasthan_pkg IS NOT NULL;

-- ============================================================
-- Accessibility features
-- ============================================================
INSERT IGNORE INTO package_accessibility (package_id, wheelchair_accessible, senior_friendly, child_friendly, medical_facilities_nearby, mobility_level_required, notes)
SELECT @kerala_pkg, FALSE, TRUE, TRUE, TRUE, 'easy', 'Houseboats have steps. Medical facilities in Alleppey.' WHERE @kerala_pkg IS NOT NULL
UNION ALL SELECT @goa_pkg, FALSE, TRUE, TRUE, TRUE, 'moderate', 'Beach activities require mobility. Good medical facilities.' WHERE @goa_pkg IS NOT NULL
UNION ALL SELECT @rajasthan_pkg, FALSE, TRUE, TRUE, TRUE, 'moderate', 'Forts have stairs. Hotels accessible. Good medical facilities.' WHERE @rajasthan_pkg IS NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Verification Query
-- ============================================================
SELECT 
    'Categories mapped' as step,
    COUNT(*) as count 
FROM package_category_mapping
UNION ALL
SELECT 
    'Season data added' as step,
    COUNT(*) as count 
FROM package_season_suitability
UNION ALL
SELECT 
    'Group types set' as step,
    COUNT(*) as count 
FROM package_group_types
UNION ALL
SELECT 
    'Accessibility set' as step,
    COUNT(*) as count 
FROM package_accessibility;
