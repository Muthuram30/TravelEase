-- ============================================================
-- Migration 004: User Authentication System
-- ============================================================
-- Creates users table with role-based access and theme preferences
-- Supports: email/password auth, user/admin roles, theme customization

SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing users/admin tables if they exist
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

-- Create unified users table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
    theme_preference VARCHAR(50) DEFAULT 'default',
    profile_image VARCHAR(500),
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key to bookings table if it exists
-- Check if bookings table exists and add user_id column
SET @dbname = DATABASE();
SET @tablename = 'bookings';
SET @columnname = 'user_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
  ) > 0,
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN IF NOT EXISTS ', @columnname, ' INT NULL AFTER tourist_id'),
  'SELECT 1'
));
PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

-- Create default admin user
-- Password: admin123 (hashed with PASSWORD_BCRYPT)
INSERT INTO users (email, password_hash, full_name, role, theme_preference, email_verified, is_active) VALUES
('admin@travelease.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'TravelEase Admin', 'admin', 'default', TRUE, TRUE);

-- Create sample regular users
INSERT INTO users (email, password_hash, full_name, phone, role, theme_preference, email_verified, is_active) VALUES
('john.doe@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John Doe', '+91-9876543210', 'user', 'kerala-green', TRUE, TRUE),
('jane.smith@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Jane Smith', '+91-9876543211', 'user', 'default', TRUE, TRUE),
('bob.wilson@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Bob Wilson', '+91-9876543212', 'user', 'kerala-green', TRUE, TRUE);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- USAGE NOTES:
-- ============================================================
-- Default password for all sample accounts: admin123
-- 
-- To create a new hashed password in PHP:
--   password_hash('your_password', PASSWORD_BCRYPT)
--
-- Theme preferences:
--   - 'default': Standard blue/teal theme
--   - 'kerala-green': Nature green theme (Kerala-inspired)
--
-- Roles:
--   - 'user': Regular authenticated user
--   - 'admin': Full system access (dashboard, approvals, management)
-- ============================================================
