<?php
// ============================================================
// Get Current User Info
// ============================================================
// GET /api/auth/user-me
// Returns current user session data

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

try {
    startSession();

    if (!isset($_SESSION['user_id'])) {
        jsonError('Not authenticated', 401);
    }

    $db = getDbConnection();
    $stmt = $db->prepare("
        SELECT user_id, email, full_name, phone, role, theme_preference, profile_image, email_verified, last_login
        FROM users
        WHERE user_id = ? AND is_active = TRUE
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        session_destroy();
        jsonError('User not found or inactive', 401);
    }

    jsonSuccess($user);

} catch (Exception $e) {
    jsonError($e->getMessage(), 401);
}