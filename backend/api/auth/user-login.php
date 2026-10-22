<?php
// ============================================================
// Unified Login API (customers AND admins)
// ============================================================
// POST /api/auth/user-login
// Body: { email: "user@example.com-or-admin-username", password }
//
// Lookup order: users table (email) → user_account (email/username)
//               → legacy admin table (username)
// On success the response carries BOTH the user object and a CSRF
// token that every subsequent mutation must present in the
// X-CSRF-Token header.
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

try {
    $db = getDbConnection();
    $data = getJsonBody();

    $email    = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if ($email === '' || $password === '' || strlen($email) > 150 || strlen($password) > 255) {
        jsonError('Email/username and password are required', 401);
    }

    // ---- Brute-force protection (same limiter as admin login) ----
    $ip = getClientIp();
    if (isRateLimited($ip, 5, 900)) {
        jsonError('Too many failed login attempts. Please try again in 15 minutes.', 429);
    }

    // ---- 1. Unified users table (by email) ----
    $stmt = $db->prepare("
        SELECT user_id, email, password_hash, full_name, phone, role, theme_preference, profile_image, is_active
        FROM users
        WHERE email = ?
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // ---- 2. Legacy shared account table (by email OR username) ----
    if (!$user) {
        $stmt = $db->prepare("
            SELECT user_id, username, email, password_hash, role, theme_choice
            FROM user_account
            WHERE email = ? OR username = ?
            LIMIT 1
        ");
        $stmt->execute([$email, $email]);
        $legacy = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($legacy) {
            $user = [
                'user_id'          => $legacy['user_id'],
                'email'            => $legacy['email'],
                'password_hash'    => $legacy['password_hash'],
                'full_name'        => $legacy['username'],
                'phone'            => null,
                'role'             => $legacy['role'],
                'theme_preference' => $legacy['theme_choice'],
                'profile_image'    => null,
                'is_active'        => 1,
            ];
        }
    }

    // ---- 3. Very old installs: admin table (username only) ----
    if (!$user) {
        $stmt = $db->prepare('
            SELECT admin_id, username, password_hash, full_name
            FROM admin
            WHERE username = ?
            LIMIT 1
        ');
        $stmt->execute([$email]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($admin) {
            $user = [
                'user_id'          => $admin['admin_id'],
                'email'            => $admin['username'] . '@admin.travelease.local',
                'password_hash'    => $admin['password_hash'],
                'full_name'        => $admin['full_name'],
                'phone'            => null,
                'role'             => 'admin',
                'theme_preference' => 'default',
                'profile_image'    => null,
                'is_active'        => 1,
            ];
        }
    }

    // Generic failure message — never reveal which part was wrong
    if (!$user || !password_verify($password, $user['password_hash'])) {
        recordFailedAttempt($ip);
        jsonError('Invalid email/username or password', 401);
    }

    if (!$user['is_active']) {
        jsonError('Account is deactivated. Please contact support.', 403);
    }

    clearRateLimit($ip);

    // ---- Persist session (canonical field names, shared with login.php) ----
    startSession();
    session_regenerate_id(true); // prevent session fixation

    $_SESSION['user_id']   = $user['user_id'];
    $_SESSION['user_name'] = $user['full_name'] ?? '';
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['theme_preference'] = $user['theme_preference'] ?? 'default';

    if ($user['role'] === 'admin') {
        $_SESSION['admin_id']       = $user['user_id'];
        $_SESSION['admin_username'] = $user['email'];
        $_SESSION['admin_name']     = $user['full_name'] ?? '';
    }

    $csrf = generateCsrfToken();

    unset($user['password_hash']);

    jsonSuccess([
        'message' => 'Login successful',
        'user' => $user,
        'csrf_token' => $csrf
    ]);

} catch (PDOException $e) {
    error_log('[TravelEase DB] User login error (db): ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
} catch (Exception $e) {
    error_log('[TravelEase] User login error: ' . $e->getMessage());
    jsonError($e->getMessage(), 401);
}
