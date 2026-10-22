-- Migration 007: Create users table for unified authentication
-- The users table already exists in tourism_db with the full premium schema,
-- so CREATE TABLE IF NOT EXISTS is a safe no-op.

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('user', 'premium', 'admin') NOT NULL DEFAULT 'user',
    theme_preference VARCHAR(40) DEFAULT 'kerala-green',
    profile_image VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate from user_account only if that table exists (it does not in tourism_db)
SET @ua_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_account');

SET @sql = IF(@ua_exists > 0,
    'INSERT IGNORE INTO users (email, password_hash, full_name, role, is_active, created_at)
     SELECT email, password_hash, username, ''admin'', is_active, created_at FROM user_account WHERE role = ''admin''',
    'SELECT ''user_account table not found; skipping admin migration'' AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@ua_exists > 0,
    'INSERT IGNORE INTO users (email, password_hash, full_name, role, is_active, created_at)
     SELECT email, password_hash, username, ''user'', is_active, created_at FROM user_account WHERE role = ''user''',
    'SELECT ''user_account table not found; skipping user migration'' AS status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 007 complete!' AS status;
