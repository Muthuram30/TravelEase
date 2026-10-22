<?php
// ============================================================
// TravelEase Admin Setup Script
// ============================================================
// Run ONCE to create or reset the admin user in MySQL.
//
// CLI Usage:
//   php setup_admin.php
//
// Browser Usage (with token protection):
//   http://localhost/travelease/backend/setup_admin.php?token=YOUR_SETUP_TOKEN
//
// IMPORTANT:
//   - Set ADMIN_USERNAME and ADMIN_PASSWORD in backend/.env first!
//   - Delete or disable this file in production after use.
// ============================================================

require_once __DIR__ . '/api/config/database.php';

$isCli = php_sapi_name() === 'cli';

// ---- Token check for browser access ----
if (!$isCli) {
    $token         = $_GET['token'] ?? '';
    $expectedToken = $_ENV['SETUP_TOKEN'] ?? 'travelease-setup-2026';
    if ($token !== $expectedToken) {
        header('Content-Type: application/json');
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden. Provide the correct setup token as ?token=...']);
        exit();
    }
}

// ---- Read credentials from .env ----
$username = trim($_ENV['ADMIN_USERNAME'] ?? '');
$password = trim($_ENV['ADMIN_PASSWORD'] ?? '');
$fullName = 'System Administrator';

// ---- Validate ----
if (!$username) {
    $msg = "ERROR: ADMIN_USERNAME is not set in backend/.env\n"
         . "Please set ADMIN_USERNAME=admin (or your chosen username) and re-run.\n";
    output($isCli, false, $msg);
    exit(1);
}

if (!$password) {
    $msg = "ERROR: ADMIN_PASSWORD is not set in backend/.env\n"
         . "Please set a strong password in ADMIN_PASSWORD and re-run.\n"
         . "Example:  ADMIN_PASSWORD=MyStr0ng!Pass\n";
    output($isCli, false, $msg);
    exit(1);
}

if (strlen($password) < 8) {
    $msg = "ERROR: ADMIN_PASSWORD is too short (minimum 8 characters).\n";
    output($isCli, false, $msg);
    exit(1);
}

// ---- Connect and create/update admin ----
try {
    $pdo = getDbConnection();

    // Ensure admin table exists
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS admin (
            admin_id      INT            AUTO_INCREMENT PRIMARY KEY,
            username      VARCHAR(50)    NOT NULL UNIQUE,
            password_hash VARCHAR(255)   NOT NULL,
            full_name     VARCHAR(100)   NOT NULL,
            created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ');

    // Hash with bcrypt
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    // Upsert admin: create if not exists, update hash if it does
    $stmt = $pdo->prepare('
        INSERT INTO admin (username, password_hash, full_name)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            password_hash = VALUES(password_hash),
            full_name     = VALUES(full_name)
    ');
    $stmt->execute([$username, $hash, $fullName]);

    // New installs use a shared account table; role, not a route alone, grants access.
    $pdo->exec('CREATE TABLE IF NOT EXISTS user_account (
        user_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
        username VARCHAR(50) NOT NULL UNIQUE, email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, role ENUM("user", "admin") NOT NULL DEFAULT "user",
        theme_choice VARCHAR(40) NOT NULL DEFAULT "kerala-green", created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB');
    $account = $pdo->prepare('INSERT INTO user_account (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, "admin") ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role="admin"');
    $account->execute([$fullName, $username, $username . '@admin.travelease.local', $hash]);

    $msg = "SUCCESS: Admin account created/updated.\n"
         . "  Username : $username\n"
         . "  Password : [set from ADMIN_PASSWORD in .env — not shown]\n"
         . "\n"
         . "Login at: http://localhost:5173/admin/login\n"
         . "IMPORTANT: Keep ADMIN_PASSWORD secret and delete/disable this script in production.\n";

    output($isCli, true, $msg);

} catch (PDOException $e) {
    $errMsg = "Database error: " . $e->getMessage() . "\n"
            . "Check MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD in backend/.env\n";
    output($isCli, false, $errMsg);
    exit(1);
}

// ---- Output helper ----
function output(bool $isCli, bool $success, string $msg): void {
    if ($isCli) {
        echo $msg;
    } else {
        header('Content-Type: application/json');
        if (!$success) http_response_code(400);
        echo json_encode([
            'success' => $success,
            'message' => nl2br(htmlspecialchars($msg)),
        ]);
    }
}
