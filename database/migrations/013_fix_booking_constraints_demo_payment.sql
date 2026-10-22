-- Migration 010: Fix booking constraints and add demo payment status
-- SAFE: Only additive changes (new columns, enum extension)

USE tourism_db;

-- ============================================================
-- 1. Add user_id column to booking table (if not exists)
--    Required for per-user booking limit checks
-- ============================================================
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND COLUMN_NAME = 'user_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE booking ADD COLUMN user_id INT NULL AFTER tourist_id',
    'SELECT "user_id already exists" AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. Extend payment_status enum in booking to include demo_completed
--    Keeps it clearly distinguishable from real payment statuses.
--    Existing values: pending, paid, failed, refunded
-- ============================================================
SET @has_payment_col = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND COLUMN_NAME = 'payment_status'
);
SET @col_type = IF(@has_payment_col > 0,
    (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'booking'
     AND COLUMN_NAME = 'payment_status'),
    NULL
);
SET @has_demo = IF(@col_type IS NOT NULL AND @col_type LIKE '%demo_completed%', 1, 0);

SET @sql = IF(@has_payment_col > 0 AND @has_demo = 0,
    "ALTER TABLE booking MODIFY COLUMN payment_status ENUM('pending','paid','failed','refunded','demo_completed') DEFAULT 'pending'",
    'SELECT "payment_status: no change needed" AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. Fix booking_status default from 'Confirmed' to 'Pending'
--    The original schema incorrectly defaults to 'Confirmed'
--    New bookings should always start as 'Pending' (admin confirms)
-- ============================================================
SET @current_default = (
    SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND COLUMN_NAME = 'booking_status'
);
SET @sql = IF(@current_default = 'Confirmed',
    "ALTER TABLE booking MODIFY COLUMN booking_status VARCHAR(20) NOT NULL DEFAULT 'Pending'",
    'SELECT "booking_status default already correct" AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Migration 010: booking constraints fix + demo payment status applied!' AS status;
