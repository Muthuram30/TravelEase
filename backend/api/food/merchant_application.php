<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

// database.php already loads .env via loadEnv()
setCorsHeaders();

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

// POST: Submit merchant application
if ($method === 'POST') {
    $data = getJsonBody();
    
    // Validate required fields
    $required = ['business_name', 'owner_name', 'email', 'phone', 'password'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonError("Field '$field' is required", 400);
        }
    }
    
    // Validate email
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        jsonError('Invalid email address', 400);
    }
    
    // Check if email already exists
    try {
        $stmt = $db->prepare("SELECT merchant_id FROM foodspot_merchant WHERE email = ?");
        $stmt->execute([$data['email']]);
        if ($stmt->fetch()) {
            jsonError('Email already registered', 409);
        }
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        jsonError('Database error', 500);
    }
    
    // Hash password
    $password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
    
    // Insert merchant
    try {
        $stmt = $db->prepare("
            INSERT INTO foodspot_merchant (business_name, owner_name, email, phone, password_hash, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([
            $data['business_name'],
            $data['owner_name'],
            $data['email'],
            $data['phone'],
            $password_hash
        ]);
        
        $merchant_id = $db->lastInsertId();
        
        // Log application
        $stmt = $db->prepare("
            INSERT INTO merchant_application_audit (merchant_id, action, notes)
            VALUES (?, 'created', 'Application submitted')
        ");
        $stmt->execute([$merchant_id]);
        
        jsonSuccess([
            'merchant_id' => $merchant_id,
            'status' => 'pending',
            'message' => 'Application submitted successfully. You will be notified once reviewed.'
        ], 201);
        
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        jsonError('Failed to submit application', 500);
    }
}

// GET: Check application status (by email)
if ($method === 'GET') {
    $email = $_GET['email'] ?? null;
    
    if (!$email) {
        jsonError('Email parameter required', 400);
    }
    
    try {
        $stmt = $db->prepare("
            SELECT merchant_id, business_name, owner_name, email, phone, status, rejection_reason, created_at, updated_at
            FROM foodspot_merchant
            WHERE email = ?
        ");
        $stmt->execute([$email]);
        $merchant = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$merchant) {
            jsonError('Application not found', 404);
        }
        
        jsonSuccess($merchant);
        
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        jsonError('Database error', 500);
    }
}

jsonError('Method not allowed', 405);
