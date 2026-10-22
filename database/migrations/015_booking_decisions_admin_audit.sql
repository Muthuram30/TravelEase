-- ============================================================
-- Migration 015: Booking decision metadata + admin audit log
-- ============================================================
-- Supports the admin booking approval/rejection workflow:
--   * booking.decision_by      – admin users.user_id who decided
--   * booking.decision_by_name – display name (safe for legacy/external
--                                admin accounts that have no users row)
--   * booking.decision_at      – when the decision was recorded
--   * booking.rejection_reason – optional reason for the rejection
--   * admin_audit_log          – lightweight audit trail for admin actions
--
-- All changes are ADDITIVE and guarded by INFORMATION_SCHEMA checks,
-- so re-running this migration is a safe no-op. No data is modified
-- or deleted, and existing status values are not reinterpreted.

USE tourism_db;

-- ============================================================
-- 1. booking table: decision metadata columns
-- ============================================================

-- decision_by (kept intentionally without an FK: legacy admin accounts
-- provisioned by setup_admin.php may only exist in the `admin` table,
-- so a users.user_id FK would wrongly reject those IDs. No FK is safer
-- for mixed legacy installs.)
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND COLUMN_NAME = 'decision_by'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE booking ADD COLUMN decision_by INT NULL',
    'SELECT "decision_by already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND COLUMN_NAME = 'decision_by_name'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE booking ADD COLUMN decision_by_name VARCHAR(100) NULL AFTER decision_by',
    'SELECT "decision_by_name already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND COLUMN_NAME = 'decision_at'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE booking ADD COLUMN decision_at TIMESTAMP NULL AFTER decision_by_name',
    'SELECT "decision_at already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND COLUMN_NAME = 'rejection_reason'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE booking ADD COLUMN rejection_reason TEXT NULL AFTER decision_at',
    'SELECT "rejection_reason already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for the admin "pending review" queue
SET @idx_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking'
    AND INDEX_NAME = 'idx_booking_status_created'
);
SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_booking_status_created ON booking (booking_status, created_at)',
    'SELECT "idx_booking_status_created already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. Fix upi_merchant_config unique key
--    Migration 011 created UNIQUE KEY unique_active (is_active),
--    which wrongly permits at most ONE inactive config row.
--    The admin UPI config endpoint deactivates *all* existing
--    rows before inserting a new active one, so two inactive rows
--    are legitimate — the unique constraint makes the 2nd config
--    switch fail (duplicate entry '0'). Dropping the index is safe:
--    it affects no data, and "only one active config" remains
--    enforced by the endpoint's own deactivating UPDATE.
-- ============================================================
SET @idx_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'upi_merchant_config'
    AND INDEX_NAME = 'unique_active'
);
SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE upi_merchant_config DROP INDEX unique_active',
    'SELECT "unique_active already removed" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. admin_audit_log: audit trail for admin decisions
--    (payment decisions already have payment_audit_log from
--     migration 011 — this table covers bookings, packages,
--     and user management actions.)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
    audit_id        INT AUTO_INCREMENT PRIMARY KEY,

    -- What happened
    action          VARCHAR(50)  NOT NULL,     -- e.g. booking_approve, package_deactivate
    entity_type     VARCHAR(30)  NOT NULL,     -- booking | package | user | payment
    entity_id       INT          NULL,

    -- Who did it
    actor_id        INT          NULL,         -- users.user_id or legacy admin id
    actor_name      VARCHAR(100) NULL,

    -- Context (denormalised for quick reads)
    details         JSON         NULL,         -- e.g. {"reason": "...", "old_status": "Pending"}
    old_value       VARCHAR(255) NULL,
    new_value       VARCHAR(255) NULL,

    -- Request context
    ip_address      VARCHAR(45)  NULL,
    user_agent      TEXT         NULL,

    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_entity  (entity_type, entity_id),
    INDEX idx_audit_actor   (actor_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Verification
-- ============================================================
SELECT 'Migration 015: booking decision metadata + admin audit log applied!' AS status;

-- Sanity check: these columns must now exist on booking
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'booking'
  AND COLUMN_NAME IN ('decision_by', 'decision_by_name', 'decision_at', 'rejection_reason')
ORDER BY COLUMN_NAME;
