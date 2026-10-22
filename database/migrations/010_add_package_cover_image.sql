-- Migration 009: Add cover_image_url to tour_package for quick primary image access
-- This provides a denormalized column for the main package cover image
-- while preserving the full package_image gallery table for additional images

USE tourism_db;

SET FOREIGN_KEY_CHECKS = 0;

-- Add cover_image_url column to tour_package if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND COLUMN_NAME = 'cover_image_url');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE tour_package ADD COLUMN cover_image_url VARCHAR(500) NULL AFTER description',
    'SELECT "cover_image_url column already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add index for cover image queries
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND INDEX_NAME = 'idx_cover_image');

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_cover_image ON tour_package (cover_image_url)',
    'SELECT "idx_cover_image already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 009: Package cover image column added' AS status;