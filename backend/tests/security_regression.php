<?php
// ============================================================
// TravelEase – Security Regression Tests (static analysis)
// ============================================================
// Run: php backend/tests/security_regression.php
//
// These tests assert server-side security invariants that were
// introduced by audit fixes. They are pure static checks (no DB
// required) and must keep passing after any refactor.
// ============================================================

declare(strict_types=1);

$root = dirname(__DIR__); // backend/
$pass = 0;
$fail = 0;
$failures = [];

function contents(string $path): string {
    $src = @file_get_contents($path);
    if ($src === false) {
        fwrite(STDERR, "FATAL: cannot read $path\n");
        exit(2);
    }
    return $src;
}

function contains(string $needle, string $haystack): bool {
    return strpos($haystack, $needle) !== false;
}

function not_contains(string $needle, string $haystack): bool {
    return strpos($haystack, $needle) === false;
}

function test(bool $condition, string $name): void {
    global $pass, $fail, $failures;
    if ($condition) {
        $pass++;
        echo "  PASS  $name\n";
    } else {
        $fail++;
        $failures[] = $name;
        echo "  FAIL  $name\n";
    }
}

echo "=== TravelEase Security Regression Tests ===\n\n";

// ------------------------------------------------------------
// 1. UPI payment ownership (IDOR fix)
// ------------------------------------------------------------
echo "[1] payments/upi.php — booking-ownership authorization\n";
$upi = contents($root . '/api/payments/upi.php');

test(
    not_contains('b.payment_id IS NOT NULL', $upi),
    "no 'b.payment_id IS NOT NULL' IDOR backdoor in create_qr ownership clause"
);
test(
    substr_count($upi, 'b.user_id = ? OR t.email = ?') >= 4,
    'every payment query enforces user ownership (user_id OR tourist email)'
);
test(
    substr_count($upi, 'requireAuthWithCsrf()') >= 4,
    'all customer UPI mutations require auth + CSRF (create_qr, submit_utr, upload_receipt, cancel)'
);
test(
    contains("\$finfo = @finfo_open(FILEINFO_MIME_TYPE)", $upi) && not_contains('in_array($file[\'type\']', $upi),
    'receipt upload sniffs real MIME type instead of trusting $_FILES[type]'
);
test(
    not_contains('DEBUG payment:', $upi),
    'no DEBUG error_log lines leaking user email / booking data'
);

// ------------------------------------------------------------
// 2. Demo payment isolation
// ------------------------------------------------------------
echo "[2] payments/demo.php — demo vs. genuine payment separation\n";
$demo = contents($root . '/api/payments/demo.php');

test(
    substr_count($demo, 'b.user_id = ? OR t.email = ?') >= 2,
    'GET checkout + simulate enforce single-query ownership check'
);
test(
    not_contains("catch (Exception \$ignored) {}", $demo),
    'no silent authorization-failure fallback paths'
);
test(
    contains("in_array(\$booking['payment_status'], \$blockedStatuses, true)", $demo)
        && contains("\$blockedStatuses = ['paid', 'verified']", $demo),
    'demo simulation refuses bookings already marked paid/verified'
);
test(
    contains('payment_status IN (\'pending_qr\', \'pending_verification\', \'verified\')', $demo),
    'demo simulation refused when a real UPI attempt is in progress'
);
test(
    contains('booking_status', $demo) && contains("!== 'Pending'", $demo),
    'demo simulation only allowed for pending bookings'
);
test(
    not_contains('customer=', $demo),
    'demo audit log contains no customer name (PII)'
);

// ------------------------------------------------------------
// 3. Sensitive debug logging removed
// ------------------------------------------------------------
echo "[3] Sensitive logging removed across backend\n";
foreach (['/api/auth/login.php', '/api/config/helpers.php', '/api/packages/manage.php'] as $rel) {
    $src = contents($root . $rel);
    test(not_contains('DEBUG ', $src), "$rel contains no DEBUG logs");
}
$login = contents($root . '/api/auth/login.php');
test(
    not_contains('json_encode($body)', $login),
    'login.php never logs raw request bodies'
);
$helpers = contents($root . '/api/config/helpers.php');
test(
    not_contains('var_export($raw', $helpers),
    'getJsonBody no longer logs raw request bodies'
);

// ------------------------------------------------------------
// 4. Auth session standardization
// ------------------------------------------------------------
echo "[4] Standardized session fields + CSRF\n";
$userLogin = contents($root . '/api/auth/user-login.php');
foreach (['user_id', 'user_email', 'user_role', 'user_name'] as $field) {
    test(contains("\$_SESSION['$field']", $userLogin), "user-login.php sets canonical \$_SESSION['$field']");
}
test(contains('session_regenerate_id(true)', $userLogin), 'user-login.php regenerates session ID (fixation guard)');
test(contains('generateCsrfToken()', $userLogin), 'user-login.php issues a CSRF token');
test(contains('FROM admin', $userLogin), 'user-login.php falls back to legacy admin table (admin login works)');

$register = contents($root . '/api/auth/register.php');
test(contains("\$_SESSION['user_role']", $register), 'register.php sets canonical session role');
test(contains('session_regenerate_id(true)', $register), 'register.php regenerates session ID');
test(contains('isRateLimited($ip', $register), 'register.php applies IP rate limiting');
test(contains("preg_match(\"/^[\p{L}\p{M}\s.'-]+\$/u\"", $register), 'register.php validates full_name characters');
test(contains('password_hash($password, PASSWORD_BCRYPT', $register), 'register.php bcrypt-hashes passwords');

$bookings = contents($root . '/api/bookings/index.php');
test(contains('validateCsrfToken()', $bookings), 'booking creation requires CSRF');

$updateTheme = contents($root . '/api/auth/update-theme.php');
test(contains('validateCsrfToken()', $updateTheme), 'theme update requires CSRF');

$userLogout = contents($root . '/api/auth/user-logout.php');
test(contains('session_destroy()', $userLogout) && contains('setcookie(', $userLogout), 'user logout clears session + cookie');

// ------------------------------------------------------------
// 5. Upload hardening
// ------------------------------------------------------------
echo "[5] packages/images.php — upload hardening\n";
$images = contents($root . '/api/packages/images.php');
test(not_contains('image/svg', $images), 'SVG uploads are not allowed (XSS vector)');
test(contains('requireAdminSession()', $images) && contains("if (\$method === 'GET') {", $images), 'image listing requires admin session');

// ------------------------------------------------------------
// 6. Migration hygiene
// ------------------------------------------------------------
echo "[6] Database migrations — deterministic order\n";
$migDir = dirname($root) . '/database/migrations';
$sqls  = glob($migDir . '/*.sql');
$nums  = [];
foreach ($sqls as $f) {
    if (preg_match('/^(\d{3,})_/', basename($f), $m)) $nums[] = (int)$m[1];
}
$sorted = $nums;
sort($sorted);
test($nums === $sorted && count($nums) > 0, 'migration numbers are unique and strictly increasing');
test(
    !contains('DROP TABLE IF EXISTS users', contents("$migDir/007_users_table.sql")),
    'canonical users migration is non-destructive'
);
$premium = contents("$migDir/008_premium_roles_system.sql");
test(
    not_contains('john.doe@example.com', $premium),
    'premium roles migration contains no demo-account privilege grants'
);

// ------------------------------------------------------------
echo "\n=== RESULTS: $pass passed, $fail failed ===\n";
if ($fail > 0) {
    echo "Failing checks:\n";
    foreach ($failures as $f) echo "  - $f\n";
    exit(1);
}
exit(0);
