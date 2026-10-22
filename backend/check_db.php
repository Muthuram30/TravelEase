<?php
// ============================================================
// TravelEase Database Diagnostic Script
// ============================================================
// Run this to verify MySQL connectivity and schema.
//
// CLI:    php check_db.php
// Browser: http://localhost/travelease/backend/check_db.php
//          (Only shows safe info — never exposes passwords)
// ============================================================

require_once __DIR__ . '/api/config/database.php';

$results = [];
$allPassed = true;

// ---- 1. Check MySQL connection ----
try {
    $pdo = getDbConnection();
    $results[] = ['test' => 'MySQL Connection', 'status' => 'PASS', 'detail' => 'Connected to ' . ($_ENV['MYSQL_HOST'] ?? 'localhost') . ':' . ($_ENV['MYSQL_PORT'] ?? '3306')];
} catch (PDOException $e) {
    $results[] = ['test' => 'MySQL Connection', 'status' => 'FAIL', 'detail' => 'Cannot connect: ' . $e->getMessage()];
    $allPassed = false;
    outputResults($results, $allPassed);
    exit(1);
}

// ---- 2. Check database exists ----
try {
    $db = $_ENV['MYSQL_DATABASE'] ?? 'tourism_db';
    $stmt = $pdo->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = " . $pdo->quote($db));
    if ($stmt->fetch()) {
        $results[] = ['test' => 'Database Exists', 'status' => 'PASS', 'detail' => "Database '$db' exists"];
    } else {
        $results[] = ['test' => 'Database Exists', 'status' => 'FAIL', 'detail' => "Database '$db' not found. Run: mysql -u root -p < database/schema.sql"];
        $allPassed = false;
    }
} catch (PDOException $e) {
    $results[] = ['test' => 'Database Exists', 'status' => 'FAIL', 'detail' => $e->getMessage()];
    $allPassed = false;
}

// ---- 3. Check required tables ----
$requiredTables = ['tourist', 'tour_package', 'booking', 'admin'];
foreach ($requiredTables as $table) {
    try {
        $count = (int) $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
        $results[] = ['test' => "Table: $table", 'status' => 'PASS', 'detail' => "$count row(s)"];
    } catch (PDOException $e) {
        $results[] = ['test' => "Table: $table", 'status' => 'FAIL', 'detail' => "Table missing or error: " . $e->getMessage()];
        $allPassed = false;
    }
}

// ---- 4. Check admin table has bcrypt hashes ----
try {
    $row = $pdo->query("SELECT password_hash FROM admin LIMIT 1")->fetch();
    if ($row) {
        $hash = $row['password_hash'];
        if (str_starts_with($hash, '$2y$')) {
            $results[] = ['test' => 'Admin Password Hash', 'status' => 'PASS', 'detail' => 'bcrypt hash found'];
        } else {
            $results[] = ['test' => 'Admin Password Hash', 'status' => 'WARN', 'detail' => 'Non-bcrypt hash detected (run setup_admin.php to fix)'];
            $allPassed = false;
        }
    } else {
        $results[] = ['test' => 'Admin Password Hash', 'status' => 'WARN', 'detail' => 'No admin users found — run setup_admin.php'];
        $allPassed = false;
    }
} catch (PDOException $e) {
    $results[] = ['test' => 'Admin Password Hash', 'status' => 'FAIL', 'detail' => $e->getMessage()];
    $allPassed = false;
}

// ---- 5. Check .env loaded ----
$envCheck = [
    'MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER',
    'REACT_APP_URL', 'ADMIN_USERNAME',
];
foreach ($envCheck as $key) {
    $val = $_ENV[$key] ?? null;
    if ($val !== null && $val !== '') {
        $results[] = ['test' => "Env: $key", 'status' => 'PASS', 'detail' => ($key === 'MYSQL_USER' ? $val : '(set)')];
    } else {
        $results[] = ['test' => "Env: $key", 'status' => 'WARN', 'detail' => 'Not set in .env'];
    }
}

// Password-related: only check if SET, don't reveal value
foreach (['MYSQL_PASSWORD', 'ADMIN_PASSWORD'] as $key) {
    $val = $_ENV[$key] ?? null;
    if ($val !== null && $val !== '') {
        $results[] = ['test' => "Env: $key", 'status' => 'PASS', 'detail' => '(set — hidden)'];
    } else {
        $status = 'WARN';
        $detail = 'Not set in .env — required for admin login';
        if ($key === 'MYSQL_PASSWORD') { $detail = 'Not set — may be OK if MySQL has no password'; }
        $results[] = ['test' => "Env: $key", 'status' => $status, 'detail' => $detail];
    }
}

outputResults($results, $allPassed);

// ---- Output ----
function outputResults(array $results, bool $allPassed): void {
    $isCli = php_sapi_name() === 'cli';
    if ($isCli) {
        echo "\n=== TravelEase Database Diagnostic ===\n\n";
        foreach ($results as $r) {
            $icon = $r['status'] === 'PASS' ? '✓' : ($r['status'] === 'WARN' ? '⚠' : '✗');
            echo "[$icon] {$r['test']}: {$r['detail']}\n";
        }
        echo "\n" . ($allPassed ? "ALL CHECKS PASSED ✓" : "SOME CHECKS FAILED — see above") . "\n\n";
    } else {
        header('Content-Type: application/json');
        echo json_encode([
            'all_passed' => $allPassed,
            'results'    => $results,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}
