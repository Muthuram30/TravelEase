-- Migration 010: Pay Later support + duplicate-booking protection
-- - booking.created_at / booking.travel_date : restore columns the app reads
-- - booking.idempotency_key                  : one booking per submit attempt
-- payment_status already exists (009_upi_payment_system.sql) and stays
-- independent from booking_status.

USE tourism_db;

-- ---- created_at ----
SET @has_created = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'created_at');
SET @sql = IF(@has_created = 0,
    'ALTER TABLE booking ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'SELECT "booking.created_at: already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- travel_date ----
SET @has_travel = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'travel_date');
SET @sql = IF(@has_travel = 0,
    'ALTER TABLE booking ADD COLUMN travel_date DATE NULL AFTER booking_date',
    'SELECT "booking.travel_date: already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- idempotency_key ----
SET @has_idem = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'idempotency_key');
SET @sql = IF(@has_idem = 0,
    'ALTER TABLE booking ADD COLUMN idempotency_key VARCHAR(64) NULL AFTER confirmation_token',
    'SELECT "booking.idempotency_key: already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- unique index (NULLs are allowed to repeat) ----
SET @has_idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND INDEX_NAME = 'uq_booking_idempotency');
SET @sql = IF(@has_idx = 0,
    'CREATE UNIQUE INDEX uq_booking_idempotency ON booking (idempotency_key)',
    'SELECT "uq_booking_idempotency: already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Migration 010 complete!' AS status;
