<?php
// ============================================================
// TravelEase Admin Password Reset Script
// ============================================================
// FOR DEVELOPMENT USE ONLY.
// Resets the admin password to whatever is in ADMIN_PASSWORD in .env.
//
// CLI Usage:
//   php reset_admin.php
//
// IMPORTANT: Delete this file before going to production!
// ============================================================

require_once __DIR__ . '/api/config/database.php';

$isCli = php_sapi_name() === 'cli';

if (!$isCli) {
    // Block browser access to this script entirely
    header('Content-Type: application/json');
    http_response_code(403);
    echo json_encode(['error' => 'This script can only be run from the command line.']);
    exit();
}

$username = trim($_ENV['ADMIN_USERNAME'] ?? '');
$password = trim($_ENV['ADMIN_PASSWORD'] ?? '');

if (!$username || !$password) {
    echo "ERROR: ADMIN_USERNAME and ADMIN_PASSWORD must be set in backend/.env\n";
    exit(1);
}

if (strlen($password) < 8) {
    echo "ERROR: ADMIN_PASSWORD must be at least 8 characters.\n";
    exit(1);
}

try {
    $pdo  = getDbConnection();
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $pdo->prepare('UPDATE admin SET password_hash = ? WHERE username = ?');
    $stmt->execute([$hash, $username]);

    if ($stmt->rowCount() === 0) {
        echo "WARNING: No admin user found with username '$username'.\n";
        echo "Run setup_admin.php first to create the admin account.\n";
        exit(1);
    }

    echo "SUCCESS: Password for '$username' has been reset.\n";
    echo "Login at: http://localhost:5173/admin/login\n";

} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
