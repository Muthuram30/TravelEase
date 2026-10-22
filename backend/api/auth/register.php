<?php
// ============================================================
// User Registration API
// ============================================================
// POST /api/auth/register
// Body: { email, password, full_name, phone?, theme_preference? }
// Input-validated, IP rate-limited (5 registrations / 15 min),
// issues a CSRF token on success.
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

    // ---- Abuse prevention: limit registrations per IP ----
    $ip = getClientIp();
    if (isRateLimited($ip, 5, 900)) {
        jsonError('Too many registration attempts. Please try again in 15 minutes.', 429);
    }

    // ---- Validate required fields ----
    $required = ['email', 'password', 'full_name'];
    foreach ($required as $field) {
        if (empty($data[$field]) || !is_string($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }

    $email            = trim($data['email']);
    $password         = $data['password'];
    $full_name        = trim($data['full_name']);
    $phone            = isset($data['phone']) && is_string($data['phone']) ? trim($data['phone']) : null;
    $theme_preference = isset($data['theme_preference']) && is_string($data['theme_preference'])
        ? trim($data['theme_preference']) : 'default';

    // ---- Length and format validation ----
    if (strlen($email) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }
    if (strlen($full_name) < 2 || strlen($full_name) > 100) {
        throw new Exception('Name must be between 2 and 100 characters');
    }
    if (!preg_match("/^[\p{L}\p{M}\s.'-]+$/u", $full_name)) {
        throw new Exception('Name contains invalid characters');
    }
    if ($phone !== null && $phone !== '') {
        // Normalize to digits (international format, 7–15 digits)
        $phone_digits = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($phone_digits) < 7 || strlen($phone_digits) > 15) {
            throw new Exception('Invalid phone number');
        }
        $phone = $phone_digits;
    }

    // ---- Password strength: 8+ chars, at least one letter and one digit ----
    if (strlen($password) < 8) {
        throw new Exception('Password must be at least 8 characters');
    }
    if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
        throw new Exception('Password must contain at least one letter and one number');
    }

    // ---- Theme allow-list ----
    $allowed_themes = ['default', 'kerala-green'];
    if (!in_array($theme_preference, $allowed_themes, true)) {
        throw new Exception('Invalid theme preference');
    }

    // ---- Check if email already exists ----
    $stmt = $db->prepare("SELECT user_id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        throw new Exception('Email already registered');
    }

    // ---- Hash password ----
    $password_hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    // ---- Insert new user ----
    $stmt = $db->prepare("
        INSERT INTO users (email, password_hash, full_name, phone, role, theme_preference, email_verified, is_active)
        VALUES (?, ?, ?, ?, 'user', ?, FALSE, TRUE)
    ");
    $stmt->execute([$email, $password_hash, $full_name, $phone ?: null, $theme_preference]);

    $user_id = $db->lastInsertId();

    // ---- Persist session with canonical field names ----
    startSession();
    session_regenerate_id(true); // prevent session fixation

    $_SESSION['user_id']   = $user_id;
    $_SESSION['user_name'] = $full_name;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_role'] = 'user';
    $_SESSION['theme_preference'] = $theme_preference;

    $csrf = generateCsrfToken();

    jsonSuccess([
        'message' => 'Registration successful',
        'user' => [
            'user_id' => (int)$user_id,
            'email' => $email,
            'full_name' => $full_name,
            'phone' => $phone ?: null,
            'role' => 'user',
            'theme_preference' => $theme_preference
        ],
        'csrf_token' => $csrf
    ]);

} catch (Exception $e) {
    jsonError($e->getMessage(), 400);
}
