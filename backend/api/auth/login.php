<?php
// ============================================================
// POST /api/auth/login.php - Shared customer and role-based admin login
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
startSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body = getJsonBody();
$identity = trim($body['identity'] ?? $body['username'] ?? '');
$password = $body['password'] ?? '';

if (!$identity || !$password || strlen($identity) > 100 || strlen($password) > 255) {
    jsonError('Invalid credentials.', 401);
}

$ip = getClientIp();
if (isRateLimited($ip, 5, 900)) {
    jsonError('Too many failed login attempts. Please try again in 15 minutes.', 429);
}

try {
    $pdo = getDbConnection();
    
    // Try users table first (new unified system)
    $stmt = $pdo->prepare('SELECT user_id, full_name, email, password_hash, role, theme_preference FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$identity]);
    $user = $stmt->fetch();
    
    // Fallback to user_account table (legacy)
    if (!$user) {
        $stmt = $pdo->prepare('SELECT user_id, name, username, email, password_hash, role, theme_choice FROM user_account WHERE username = ? OR email = ? LIMIT 1');
        $stmt->execute([$identity, $identity]);
        $user = $stmt->fetch();
    }
    
    // Final fallback to admin table (very old installs)
    if (!$user) {
        $legacy = $pdo->prepare('SELECT admin_id, username, password_hash, full_name FROM admin WHERE username = ? LIMIT 1');
        $legacy->execute([$identity]);
        $admin = $legacy->fetch();
        if ($admin) {
            $user = [
                'user_id' => $admin['admin_id'],
                'name' => $admin['full_name'],
                'username' => $admin['username'],
                'email' => '',
                'password_hash' => $admin['password_hash'],
                'role' => 'admin',
                'theme_choice' => 'kerala-green'
            ];
        }
    }

    if (!$user || !password_verify($password, $user['password_hash'])) {
        recordFailedAttempt($ip);
        jsonError('Invalid email/username or password.', 401);
    }

    clearRateLimit($ip);
    session_regenerate_id(true);
    
    $_SESSION['user_id'] = $user['user_id'];
    $_SESSION['user_name'] = $user['name'] ?? $user['full_name'] ?? '';
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['user_email'] = $user['email'] ?? '';
    
    if ($user['role'] === 'admin') {
        $_SESSION['admin_id'] = $user['user_id'];
        $_SESSION['admin_username'] = $user['username'] ?? '';
        $_SESSION['admin_name'] = $user['name'] ?? $user['full_name'] ?? '';
    }
    
    $csrf = generateCsrfToken();
    
    jsonSuccess([
        'user_id' => $user['user_id'],
        'name' => $user['name'] ?? $user['full_name'] ?? '',
        'username' => $user['username'] ?? '',
        'email' => $user['email'] ?? '',
        'role' => $user['role'],
        'theme_choice' => $user['theme_preference'] ?? $user['theme_choice'] ?? 'kerala-green',
        'csrf_token' => $csrf
    ]);
    
} catch (PDOException $e) {
    error_log('[TravelEase DB] Login error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}