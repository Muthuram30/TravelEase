<?php
// ============================================================
// TravelEase – PHP/MySQL Database Configuration
// ============================================================
// Load environment variables from .env file (root of backend/)
// ============================================================

/**
 * Load .env file from backend root directory.
 * Simple key=value parser — no external library required.
 */
function loadEnv(string $path): void {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);
        // Strip surrounding quotes
        $value = trim($value, '"\'');
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key]   = $value;
            putenv("$key=$value");
        }
    }
}

// Load .env from backend root (two levels above api/config/)
$envPath = dirname(__DIR__, 2) . '/.env';
if (!file_exists($envPath)) {
    $envPath = dirname(__DIR__, 1) . '/.env';
}
loadEnv($envPath);

/**
 * Return a PDO connection to tourism_db.
 * Throws PDOException on failure — callers must catch.
 */
function getDbConnection(): PDO {
    $host     = $_ENV['MYSQL_HOST']     ?? 'localhost';
    $port     = $_ENV['MYSQL_PORT']     ?? '3306';
    $dbname   = $_ENV['MYSQL_DATABASE'] ?? 'tourism_db';
    $username = $_ENV['MYSQL_USER']     ?? 'root';
    $password = $_ENV['MYSQL_PASSWORD'] ?? '';

    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";

    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}
