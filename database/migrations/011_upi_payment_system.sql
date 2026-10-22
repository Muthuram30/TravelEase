-- Migration 009: Direct UPI QR Payment System
-- Adds payment tracking, UPI QR configuration, and admin verification workflow
-- Compatible with tourism_db (no Razorpay, no external payment aggregator)

USE tourism_db;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. PAYMENT ATTEMPTS TABLE
-- Tracks each payment attempt for a booking
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_attempt (
    payment_id          INT AUTO_INCREMENT PRIMARY KEY,
    booking_id          INT NOT NULL,
    user_id             INT NULL,
    
    -- Payment details
    payment_method      ENUM('upi_qr') NOT NULL DEFAULT 'upi_qr',
    amount_expected     DECIMAL(10,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    
    -- UPI QR specific
    merchant_upi_id     VARCHAR(100) NOT NULL,
    merchant_name       VARCHAR(100) NOT NULL,
    upi_order_ref       VARCHAR(100) NOT NULL,
    qr_payload          TEXT NOT NULL,
    
    -- Customer submitted data (after scanning QR and paying)
    submitted_utr       VARCHAR(100) NULL,
    receipt_path        VARCHAR(500) NULL,
    
    -- Status tracking
    payment_status      ENUM(
        'pending_qr',       -- QR generated, waiting for customer to pay
        'pending_verification', -- Customer submitted UTR, awaiting admin verification
        'verified',         -- Admin verified payment
        'rejected',         -- Admin rejected payment
        'expired',          -- Payment attempt expired
        'cancelled'         -- Customer cancelled
    ) NOT NULL DEFAULT 'pending_qr',
    
    -- Verification audit
    verified_by         INT NULL,
    verified_at         TIMESTAMP NULL,
    rejection_reason    TEXT NULL,
    
    -- Timestamps
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at          TIMESTAMP NULL,
    
    -- Constraints & Indexes
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_booking (booking_id),
    INDEX idx_user (user_id),
    INDEX idx_status (payment_status),
    INDEX idx_utr (submitted_utr),
    INDEX idx_created (created_at),
    UNIQUE KEY unique_utr_per_booking (booking_id, submitted_utr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. UPI MERCHANT CONFIGURATION TABLE
-- Stores merchant UPI configuration (single active config)
-- ============================================================
CREATE TABLE IF NOT EXISTS upi_merchant_config (
    config_id           INT AUTO_INCREMENT PRIMARY KEY,
    merchant_upi_id     VARCHAR(100) NOT NULL,
    merchant_name       VARCHAR(100) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Ensure only one active config
    UNIQUE KEY unique_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default placeholder config (must be updated by admin)
INSERT IGNORE INTO upi_merchant_config (merchant_upi_id, merchant_name, is_active, notes)
VALUES ('merchant@upi', 'TravelEase Merchant', FALSE, 'Update with real UPI ID before enabling payments');

-- ============================================================
-- 3. PAYMENT VERIFICATION AUDIT LOG
-- Immutable audit trail for all payment state changes
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_audit_log (
    audit_id            INT AUTO_INCREMENT PRIMARY KEY,
    payment_id          INT NOT NULL,
    booking_id          INT NOT NULL,
    
    -- State change
    old_status          VARCHAR(30) NULL,
    new_status          VARCHAR(30) NOT NULL,
    
    -- Actor
    actor_type          ENUM('customer', 'admin', 'system') NOT NULL,
    actor_id            INT NULL,
    actor_name          VARCHAR(100) NULL,
    
    -- Details
    details             JSON NULL,
    ip_address          VARCHAR(45) NULL,
    user_agent          TEXT NULL,
    
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (payment_id) REFERENCES payment_attempt(payment_id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    INDEX idx_payment (payment_id),
    INDEX idx_booking (booking_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. UPDATE BOOKING TABLE
-- Add payment linkage columns (if not already present)
-- ============================================================
-- Add payment_id to booking if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'payment_id');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE booking ADD COLUMN payment_id INT NULL AFTER confirmation_token',
    'SELECT "payment_id column already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add foreign key for payment_id
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = 'tourism_db' AND TABLE_NAME = 'booking' AND CONSTRAINT_NAME = 'fk_booking_payment');
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE booking ADD CONSTRAINT fk_booking_payment FOREIGN KEY (payment_id) REFERENCES payment_attempt(payment_id) ON DELETE SET NULL',
    'SELECT "fk_booking_payment already exists" AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 5. VERIFICATION: Ensure payment_status enum in booking is compatible
-- ============================================================
-- The existing payment_status enum is: pending, paid, failed, refunded
-- Our new payment_attempt uses: pending_qr, pending_verification, verified, rejected, expired, cancelled
-- They are separate columns serving different purposes - booking.payment_status is high-level, payment_attempt.payment_status is granular

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 009: UPI Payment System applied successfully!' AS status;