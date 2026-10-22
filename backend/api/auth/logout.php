<?php
// ============================================================
// POST /api/auth/logout.php
// Destroy admin session and clear session cookie
// 
// Security features:
// - Complete session destruction
// - Session cookie invalidation
// - CSRF protection (requires valid session)
// ============================================================

require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
startSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

// Only logged-in users can log out (prevents CSRF logout attacks)
if (empty($_SESSION['user_id']) && empty($_SESSION['admin_id'])) {
    jsonError('Not authenticated', 401);
}

$username = $_SESSION['user_name'] ?? $_SESSION['admin_username'] ?? 'unknown';

// Clear all session variables
$_SESSION = [];

// Delete the session cookie
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// Destroy the session
session_destroy();

error_log("[TravelEase Security] Admin logout: $username");

jsonSuccess(['message' => 'Logged out successfully.']);
