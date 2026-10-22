<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];
startSession();

// GET: Check active merchant session
if ($method === 'GET') {
    $merchantId = $_SESSION['food_merchant_id'] ?? null;
    if (!$merchantId) {
        jsonError('Not authenticated as merchant', 401);
    }

    try {
        $stmt = $db->prepare("
            SELECT merchant_id, business_name, owner_name, email, phone, status, rejection_reason, created_at
            FROM foodspot_merchant
            WHERE merchant_id = ?
        ");
        $stmt->execute([$merchantId]);
        $merchant = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$merchant) {
            unset($_SESSION['food_merchant_id']);
            jsonError('Merchant account not found', 404);
        }

        // Generate CSRF token if not present
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        $merchant['csrf_token'] = $_SESSION['csrf_token'];

        jsonSuccess($merchant);
    } catch (PDOException $e) {
        error_log("Merchant auth error: " . $e->getMessage());
        jsonError('Database error', 500);
    }
}

// POST: Login / Logout
if ($method === 'POST') {
    $action = $_GET['action'] ?? 'login';

    if ($action === 'logout') {
        unset($_SESSION['food_merchant_id']);
        jsonSuccess(['message' => 'Logged out successfully']);
    }

    // Login
    $data = getJsonBody();
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        jsonError('Email and password are required', 400);
    }

    try {
        $stmt = $db->prepare("
            SELECT merchant_id, business_name, owner_name, email, phone, password_hash, status, rejection_reason
            FROM foodspot_merchant
            WHERE email = ?
        ");
        $stmt->execute([$email]);
        $merchant = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$merchant || !password_verify($password, $merchant['password_hash'])) {
            jsonError('Invalid email or password', 401);
        }

        // Store session
        $_SESSION['food_merchant_id'] = (int)$merchant['merchant_id'];
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        unset($merchant['password_hash']);
        $merchant['csrf_token'] = $_SESSION['csrf_token'];

        jsonSuccess([
            'merchant' => $merchant,
            'message' => 'Login successful',
            'status' => $merchant['status']
        ]);

    } catch (PDOException $e) {
        error_log("Merchant login error: " . $e->getMessage());
        jsonError('Database error', 500);
    }
}

jsonError('Method not allowed', 405);
