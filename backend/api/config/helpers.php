<?php
// ============================================================
// TravelEase – CORS, Session, CSRF & Security Helpers
// ============================================================
// Include this file at the top of every API endpoint.
// ============================================================

ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

/**
 * Set CORS headers and handle preflight OPTIONS request.
 * The REACT_APP_URL env variable controls the allowed origin.
 * 
 * MUST be called BEFORE any output. Only call ONCE per request.
 */
function setCorsHeaders(): void {
    $allowedOrigin = $_ENV['REACT_APP_URL'] ?? 'http://localhost:5173';

    header("Access-Control-Allow-Origin: $allowedOrigin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token');

    // Respond to preflight immediately
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit();
    }
}

/**
 * Send a JSON success response.
 */
function jsonSuccess(mixed $data = null, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    $payload = ['success' => true];
    if ($data !== null) {
        $payload['data'] = $data;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Send a JSON error response.
 * NOTE: Never expose raw SQL errors to public endpoints.
 */
function jsonError(string $message, int $code = 400): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Get the decoded JSON body of the current request.
 * Returns an associative array or empty array on failure.
 */
function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Verify admin session token (JWT-free, session-based via PHP sessions).
 * Returns true if the session is valid admin, false otherwise.
 */
function requireAdminSession(): void {
    startSession();
    if (($_SESSION['user_role'] ?? '') !== 'admin' && empty($_SESSION['admin_id'])) {
        jsonError('Unauthorized. Please log in as admin.', 401);
    }
}

/**
 * Require admin session AND valid CSRF token for mutation operations.
 * Use this for POST/PUT/DELETE endpoints that modify data.
 */
function requireAdminSessionWithCsrf(): void {
    requireAdminSession();
    validateCsrfToken();
}

/**
 * Start PHP session if not already started.
 * Secure cookie configuration is environment-aware (HTTP in dev, HTTPS in production).
 */
function startSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        // Determine if we're in HTTPS production environment
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') 
                || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
                || (!empty($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'production');

        session_set_cookie_params([
            'lifetime' => 86400,         // 24 hours
            'path'     => '/',
            'secure'   => $isHttps,      // true only in HTTPS
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

/**
 * Generate a new CSRF token and store it in the session.
 * Call this after successful login.
 */
function generateCsrfToken(): string {
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    return $token;
}

/**
 * Get the current CSRF token from session.
 * Returns empty string if no token exists.
 */
function getCsrfToken(): string {
    return $_SESSION['csrf_token'] ?? '';
}

/**
 * Validate CSRF token from request header.
 * Exits with 403 error if validation fails.
 */
function validateCsrfToken(): void {
    $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';

    if (!$sessionToken || !$headerToken || !hash_equals($sessionToken, $headerToken)) {
        jsonError('Invalid CSRF token. Please refresh and try again.', 403);
    }
}

/**
 * Rate limiting for login attempts.
 * Tracks failed attempts by IP address using file-based storage with flock() for concurrency safety.
 * 
 * @param string $identifier Usually the client IP address
 * @param int $maxAttempts Maximum allowed attempts (default: 5)
 * @param int $windowSeconds Time window in seconds (default: 900 = 15 minutes)
 * @return bool True if rate limit exceeded, false if allowed
 */
function isRateLimited(string $identifier, int $maxAttempts = 5, int $windowSeconds = 900): bool {
    $rateLimitDir = dirname(__DIR__, 1) . '/storage/rate_limits';
    
    // Create directory if it doesn't exist
    if (!is_dir($rateLimitDir)) {
        mkdir($rateLimitDir, 0755, true);
    }

    $filename = $rateLimitDir . '/' . hash('sha256', $identifier) . '.json';
    $now = time();

    // Use flock for atomic read-modify-write
    $fp = fopen($filename, 'c+'); // Create if not exists, don't truncate
    if ($fp === false) {
        // Fail open - if we can't open the file, allow the request
        return false;
    }
    
    flock($fp, LOCK_SH); // Shared lock for reading
    
    $attempts = [];
    if (filesize($filename) > 0) {
        $data = json_decode(fread($fp, filesize($filename)), true);
        if (is_array($data)) {
            $attempts = $data;
        }
    }
    
    flock($fp, LOCK_UN);
    fclose($fp);

    // Filter out attempts outside the time window
    $attempts = array_filter($attempts, fn($timestamp) => ($now - $timestamp) < $windowSeconds);

    // Check if rate limit exceeded
    if (count($attempts) >= $maxAttempts) {
        return true;
    }

    return false;
}

/**
 * Record a failed login attempt for rate limiting.
 * Uses flock() for atomic file operations to prevent race conditions.
 * 
 * @param string $identifier Usually the client IP address
 */
function recordFailedAttempt(string $identifier): void {
    $rateLimitDir = dirname(__DIR__, 1) . '/storage/rate_limits';
    
    if (!is_dir($rateLimitDir)) {
        mkdir($rateLimitDir, 0755, true);
    }

    $filename = $rateLimitDir . '/' . hash('sha256', $identifier) . '.json';
    $now = time();

    // Use flock for atomic read-modify-write
    $fp = fopen($filename, 'c+'); // Create if not exists
    if ($fp === false) {
        return; // Fail silently
    }
    
    flock($fp, LOCK_EX); // Exclusive lock for writing
    
    $attempts = [];
    if (filesize($filename) > 0) {
        $data = json_decode(fread($fp, filesize($filename)), true);
        if (is_array($data)) {
            $attempts = $data;
        }
    }

    // Add current attempt
    $attempts[] = $now;

    // Keep only last 15 minutes (900 seconds)
    $attempts = array_filter($attempts, fn($timestamp) => ($now - $timestamp) < 900);

    // Truncate and write
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($attempts)));
    
    flock($fp, LOCK_UN);
    fclose($fp);
}

/**
 * Clear rate limit records for an identifier (e.g., after successful login).
 * 
 * @param string $identifier Usually the client IP address
 */
function clearRateLimit(string $identifier): void {
    $rateLimitDir = dirname(__DIR__, 1) . '/storage/rate_limits';
    $filename = $rateLimitDir . '/' . hash('sha256', $identifier) . '.json';
    
    if (file_exists($filename)) {
        unlink($filename);
    }
}

/**
 * Clean up old rate limit files (older than 1 hour).
 * Call this periodically via cron or from a maintenance endpoint.
 */
function cleanupRateLimits(): int {
    $rateLimitDir = dirname(__DIR__, 1) . '/storage/rate_limits';
    $deleted = 0;
    
    if (!is_dir($rateLimitDir)) {
        return 0;
    }
    
    $files = glob($rateLimitDir . '/*.json');
    $now = time();
    
    foreach ($files as $file) {
        // Check if file was modified more than 1 hour ago
        if ($now - filemtime($file) > 3600) {
            if (unlink($file)) {
                $deleted++;
            }
        }
    }
    
    return $deleted;
}

/**
 * Get client IP address, accounting for proxies.
 */
function getClientIp(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    
    // Check for proxy headers (be cautious - these can be spoofed)
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($ips[0]);
    } elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $ip = $_SERVER['HTTP_X_REAL_IP'];
    }
    
    return $ip;
}

/**
 * Get the current authenticated user from session.
 * Returns user data array or null if not authenticated.
 */
function getCurrentUser(): ?array {
    startSession();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    
    return [
        'user_id' => $_SESSION['user_id'] ?? null,
        'email' => $_SESSION['user_email'] ?? ($_SESSION['email'] ?? null),
        'role' => $_SESSION['user_role'] ?? ($_SESSION['role'] ?? 'user'),
        'theme_preference' => $_SESSION['theme_preference'] ?? 'kerala-green',
        'premium_features' => isset($_SESSION['premium_features']) 
            ? json_decode($_SESSION['premium_features'], true) 
            : null
    ];
}

/**
 * Check if user has a specific role (user, premium, admin).
 * 
 * @param string $requiredRole Role to check ('user', 'premium', 'admin')
 * @param bool $allowHigher If true, higher roles also pass (e.g., admin passes for premium check)
 * @return bool True if user has the required role
 */
function hasRole(string $requiredRole, bool $allowHigher = true): bool {
    $user = getCurrentUser();
    if (!$user) {
        return false;
    }
    
    $role = $user['role'];
    
    // Role hierarchy: user < premium < admin
    $hierarchy = ['user' => 1, 'premium' => 2, 'admin' => 3];
    
    $userLevel = $hierarchy[$role] ?? 0;
    $requiredLevel = $hierarchy[$requiredRole] ?? 0;
    
    if ($allowHigher) {
        return $userLevel >= $requiredLevel;
    }
    
    return $role === $requiredRole;
}

/**
 * Check if user has a specific premium feature enabled.
 * 
 * @param string $featureName Feature key to check (e.g., 'route_planner', 'food_discovery')
 * @return bool True if user has the feature
 */
function hasPremiumFeature(string $featureName): bool {
    $user = getCurrentUser();
    if (!$user) {
        return false;
    }
    
    // Admin has all features
    if ($user['role'] === 'admin') {
        return true;
    }
    
    // Non-premium users have no premium features
    if ($user['role'] !== 'premium') {
        return false;
    }
    
    // Check premium_features JSON
    $features = $user['premium_features'];
    if (!is_array($features)) {
        return false;
    }
    
    return !empty($features[$featureName]);
}

/**
 * Require user to be authenticated.
 * Exits with 401 if not authenticated.
 */
function requireAuth(): array {
    $user = getCurrentUser();
    if (!$user) {
        jsonError('Authentication required. Please log in.', 401);
    }
    return $user;
}

/**
 * Require an authenticated user session AND a valid CSRF token.
 * Use this for every CUSTOMER-side mutation (POST/PUT/DELETE):
 * bookings, payments, theme updates, etc.
 * The token is obtained from /api/auth/login.php or /api/auth/me.php
 * and sent by the frontend in the X-CSRF-Token header.
 */
function requireAuthWithCsrf(): array {
    $user = requireAuth();
    validateCsrfToken();
    return $user;
}

/**
 * Require user to have a specific role.
 * Exits with 403 if user doesn't have the required role.
 * 
 * @param string $requiredRole Role to check ('user', 'premium', 'admin')
 * @param bool $allowHigher If true, higher roles also pass
 */
function requireRole(string $requiredRole, bool $allowHigher = true): array {
    $user = requireAuth();
    
    if (!hasRole($requiredRole, $allowHigher)) {
        $message = $requiredRole === 'premium' 
            ? 'This feature requires a premium account. Please upgrade to continue.'
            : 'You do not have permission to access this resource.';
        jsonError($message, 403);
    }
    
    return $user;
}

/**
 * Require user to have a specific premium feature.
 * Exits with 403 if user doesn't have the feature.
 * 
 * @param string $featureName Feature key to check
 */
function requirePremiumFeature(string $featureName): array {
    $user = requireAuth();
    
    if (!hasPremiumFeature($featureName)) {
        jsonError("This feature requires a premium account with '$featureName' enabled. Please upgrade to continue.", 403);
    }
    
    return $user;
}

/**
 * Get user's monthly booking count and check if limit is reached.
 * Free users: 3 bookings/month
 * Premium/Admin: unlimited
 * 
 * @param PDO $db Database connection
 * @param int $userId User ID
 * @return array ['count' => int, 'limit' => int, 'can_book' => bool]
 */
function getBookingLimits(PDO $db, int $userId): array {
    $user = getCurrentUser();
    
    // Premium and admin have unlimited bookings
    if (hasRole('premium', true)) {
        return [
            'count' => 0,
            'limit' => -1, // -1 means unlimited
            'can_book' => true,
            'is_unlimited' => true
        ];
    }
    
    // Free users: 3 bookings per month
    $stmt = $db->prepare("
        SELECT COUNT(*) as count 
        FROM booking 
        WHERE user_id = ? 
        AND booking_date >= DATE_FORMAT(NOW(), '%Y-%m-01')
        AND booking_status != 'Cancelled'
    ");
    $stmt->execute([$userId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $count = (int)$result['count'];
    
    $limit = 3;
    
    return [
        'count' => $count,
        'limit' => $limit,
        'can_book' => $count < $limit,
        'is_unlimited' => false
    ];
}