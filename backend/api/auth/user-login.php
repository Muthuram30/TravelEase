<?php
// ============================================================
// User Login API (Separate from admin login)
// ============================================================
// POST /api/auth/user-login
// Body: { email, password }

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

try {
    $db = getDbConnection();
    $data = getJsonBody();

    if (empty($data['email']) || empty($data['password'])) {
        throw new Exception('Email and password are required');
    }

    $email = trim($data['email']);
    $password = $data['password'];

    // Get user by email
    $stmt = $db->prepare("
        SELECT user_id, email, password_hash, full_name, phone, role, theme_preference, profile_image, is_active
        FROM users
        WHERE email = ?
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new Exception('Invalid email or password');
    }

    if (!$user['is_active']) {
        throw new Exception('Account is deactivated. Please contact support.');
    }

    // Verify password
    if (!password_verify($password, $user['password_hash'])) {
        throw new Exception('Invalid email or password');
    }

    // Update last login
    $updateStmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE user_id = ?");
    $updateStmt->execute([$user['user_id']]);

    // Start session
    startSession();
    $_SESSION['user_id'] = $user['user_id'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['theme_preference'] = $user['theme_preference'];

    unset($user['password_hash']);

    jsonSuccess([
        'message' => 'Login successful',
        'user' => $user
    ]);

} catch (Exception $e) {
    jsonError($e->getMessage(), 401);
}