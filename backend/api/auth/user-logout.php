<?php
// ============================================================
// User Logout API
// ============================================================
// POST /api/auth/user-logout

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
session_destroy();

jsonSuccess(['message' => 'Logged out successfully']);