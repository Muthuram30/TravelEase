<?php
// ============================================================
// Get Current Session Info
// ============================================================
// GET /api/auth/me.php
// Returns current user/admin session data with CSRF token

require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
startSession();

if (empty($_SESSION['user_id']) && empty($_SESSION['admin_id'])) {
    jsonError('Not authenticated', 401);
}

if (empty($_SESSION['csrf_token'])) {
    generateCsrfToken();
}

jsonSuccess([
    'user_id' => $_SESSION['user_id'] ?? $_SESSION['admin_id'],
    'name' => $_SESSION['user_name'] ?? $_SESSION['admin_name'],
    'email' => $_SESSION['user_email'] ?? '',
    'role' => $_SESSION['user_role'] ?? 'admin',
    'csrf_token' => getCsrfToken()
]);