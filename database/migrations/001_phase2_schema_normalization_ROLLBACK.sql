-- ============================================================
-- TravelEase PHASE 2: Schema Normalization ROLLBACK
-- ============================================================
--
-- WARNING: This script REMOVES all PHASE 2 additions
-- Use ONLY if you need to revert to the original schema
--
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT!
--
-- Usage:
--   mysql -u root -p tourism_db < 001_phase2_schema_normalization_ROLLBACK.sql
-- ============================================================

USE tourism_db;

-- Drop foreign key constraints first
ALTER TABLE tour_package DROP FOREIGN KEY IF EXISTS fk_package_destination;

-- Drop new tables (reverse order of creation)
DROP TABLE IF EXISTS package_tag_assignment;
DROP TABLE IF EXISTS package_tag;
DROP TABLE IF EXISTS package_exclusion;
DROP TABLE IF EXISTS package_inclusion;
DROP TABLE IF EXISTS package_itinerary_day;
DROP TABLE IF EXISTS package_image;
DROP TABLE IF EXISTS destination;

-- Remove added columns from tour_package
ALTER TABLE tour_package
    DROP COLUMN IF EXISTS destination_id,
    DROP COLUMN IF EXISTS package_type,
    DROP COLUMN IF EXISTS difficulty_level,
    DROP COLUMN IF EXISTS best_season,
    DROP COLUMN IF EXISTS min_group_size,
    DROP COLUMN IF EXISTS max_group_size,
    DROP COLUMN IF EXISTS is_featured,
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS updated_at;

-- Remove added columns from booking
ALTER TABLE booking
    DROP COLUMN IF EXISTS confirmation_token,
    DROP COLUMN IF EXISTS payment_status,
    DROP COLUMN IF EXISTS payment_method,
    DROP COLUMN IF EXISTS special_requests,
    DROP COLUMN IF EXISTS admin_notes,
    DROP COLUMN IF EXISTS cancelled_at,
    DROP COLUMN IF EXISTS confirmed_at,
    DROP COLUMN IF EXISTS updated_at;

SELECT 'PHASE 2 Rollback Complete - Schema reverted to original state' as status;
