-- Run once on existing TravelEase databases.
CREATE TABLE IF NOT EXISTS user_account (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    theme_choice VARCHAR(40) NOT NULL DEFAULT 'kerala-green',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO user_account (name, username, email, password_hash, role)
SELECT full_name, username, CONCAT(username, '@admin.travelease.local'), password_hash, 'admin'
FROM admin;
