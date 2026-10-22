<?php
// ============================================================
// User Logout API
// ============================================================
// POST /api/auth/user-logout
// Mirrors logout.php: clears all session variables, expires the
// session cookie, and destroys server-side session storage.
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

startSession();

// Only logged-in users can log out (prevents forced-logout abuse)
if (empty($_SESSION['user_id']) && empty($_SESSION['admin_id'])) {
    jsonError('Not authenticated', 401);
}

// Clear all session variables
$_SESSION = [];

// Expire the session cookie
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

session_destroy();

jsonSuccess(['message' => 'Logged out successfully']);
