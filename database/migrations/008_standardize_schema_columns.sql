-- Migration 008: Standardize tour_package column names
-- This migration renames columns to use consistent naming across the codebase.
-- Corrected to target tourism_db and handle duration as varchar -> duration_days int.

USE tourism_db;

-- Rename cost to price (if cost exists and price doesn't)
SET @col_exists_cost = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND COLUMN_NAME = 'cost');
SET @col_exists_price = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND COLUMN_NAME = 'price');

SET @sql = IF(@col_exists_cost > 0 AND @col_exists_price = 0,
    'ALTER TABLE tour_package CHANGE COLUMN cost price DECIMAL(10,2) NOT NULL DEFAULT 0.00',
    'SELECT "cost->price: no action needed" AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rename availability to max_group_size (if availability exists and max_group_size doesn't)
SET @col_exists_avail = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND COLUMN_NAME = 'availability');
SET @col_exists_max_group = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND COLUMN_NAME = 'max_group_size');

SET @sql = IF(@col_exists_avail > 0 AND @col_exists_max_group = 0,
    'ALTER TABLE tour_package CHANGE COLUMN availability max_group_size INT NOT NULL DEFAULT 50',
    'SELECT "availability->max_group_size: no action needed" AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add duration_days as INT (converted from duration varchar) if it doesn't exist
SET @col_exists_duration_days = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND COLUMN_NAME = 'duration_days');

SET @sql = IF(@col_exists_duration_days = 0,
    'ALTER TABLE tour_package ADD COLUMN duration_days INT NOT NULL DEFAULT 1 AFTER duration',
    'SELECT "duration_days: already exists" AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Populate duration_days from existing duration (varchar like "7 Days") values
UPDATE tour_package SET duration_days = CAST(SUBSTRING_INDEX(duration, ' ', 1) AS UNSIGNED) WHERE duration_days = 1;

-- Add duration_nights as generated column (if not exists)
SET @col_exists_duration_nights = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND COLUMN_NAME = 'duration_nights');

SET @sql = IF(@col_exists_duration_nights = 0,
    'ALTER TABLE tour_package ADD COLUMN duration_nights INT GENERATED ALWAYS AS (GREATEST(duration_days - 1, 0)) STORED',
    'SELECT "duration_nights: already exists" AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure all required columns exist with correct types
ALTER TABLE tour_package
    MODIFY COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    MODIFY COLUMN max_group_size INT NOT NULL DEFAULT 50,
    MODIFY COLUMN duration_days INT NOT NULL DEFAULT 1;

-- Add indexes for performance (only if not already present)
SET @idx_price = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND INDEX_NAME = 'idx_price');
SET @sql = IF(@idx_price = 0, 'CREATE INDEX idx_price ON tour_package (price)', 'SELECT "idx_price: already exists" AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_max_group = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND INDEX_NAME = 'idx_max_group_size');
SET @sql = IF(@idx_max_group = 0, 'CREATE INDEX idx_max_group_size ON tour_package (max_group_size)', 'SELECT "idx_max_group_size: already exists" AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_duration_days = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'tour_package' AND INDEX_NAME = 'idx_duration_days');
SET @sql = IF(@idx_duration_days = 0, 'CREATE INDEX idx_duration_days ON tour_package (duration_days)', 'SELECT "idx_duration_days: already exists" AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 008 complete!' AS status;
