<?php
// ============================================================
// User Registration API
// ============================================================
// POST /api/auth/register
// Body: { email, password, full_name, phone?, theme_preference? }

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

    // Validate required fields
    $required = ['email', 'password', 'full_name'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }

    $email = trim($data['email']);
    $password = $data['password'];
    $full_name = trim($data['full_name']);
    $phone = isset($data['phone']) ? trim($data['phone']) : null;
    $theme_preference = isset($data['theme_preference']) ? $data['theme_preference'] : 'default';

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }

    // Validate password strength
    if (strlen($password) < 6) {
        throw new Exception('Password must be at least 6 characters');
    }

    // Check if email already exists
    $stmt = $db->prepare("SELECT user_id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        throw new Exception('Email already registered');
    }

    // Hash password
    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    // Insert new user
    $stmt = $db->prepare("
        INSERT INTO users (email, password_hash, full_name, phone, role, theme_preference, email_verified, is_active)
        VALUES (?, ?, ?, ?, 'user', ?, FALSE, TRUE)
    ");
    $stmt->execute([$email, $password_hash, $full_name, $phone, $theme_preference]);

    $user_id = $db->lastInsertId();

    // Start session and set user
    startSession();
    $_SESSION['user_id'] = $user_id;
    $_SESSION['email'] = $email;
    $_SESSION['role'] = 'user';
    $_SESSION['theme_preference'] = $theme_preference;

    jsonSuccess([
        'message' => 'Registration successful',
        'user' => [
            'user_id' => $user_id,
            'email' => $email,
            'full_name' => $full_name,
            'role' => 'user',
            'theme_preference' => $theme_preference
        ]
    ]);

} catch (Exception $e) {
    jsonError($e->getMessage(), 400);
}