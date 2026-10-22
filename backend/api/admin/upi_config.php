<?php
// ============================================================
// Admin UPI Merchant Configuration
// GET  /api/admin/upi_config.php          → Get current config
// POST /api/admin/upi_config.php          → Update config (admin)
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDbConnection();

    if ($method === 'GET') {
        requireAdminSession();
    } else {
        requireAdminSessionWithCsrf();
    }

    // ---- GET: Current config ----
    if ($method === 'GET') {
        $stmt = $pdo->prepare('SELECT * FROM upi_merchant_config WHERE is_active = TRUE LIMIT 1');
        $stmt->execute();
        $config = $stmt->fetch();

        if (!$config) {
            // Return placeholder
            jsonSuccess([
                'config_id' => 0,
                'merchant_upi_id' => '',
                'merchant_name' => '',
                'is_active' => false,
                'notes' => 'No active configuration. Please configure UPI merchant settings.',
            ]);
        }

        jsonSuccess($config);
    }

    // ---- POST: Update/Insert config ----
    if ($method === 'POST') {
        $body = getJsonBody();

        $merchantUpiId = trim($body['merchant_upi_id'] ?? '');
        $merchantName = trim($body['merchant_name'] ?? '');
        $isActive = isset($body['is_active']) ? (bool)$body['is_active'] : false;
        $notes = trim($body['notes'] ?? '');

        // Validation
        if (!$merchantUpiId) {
            jsonError('Merchant UPI ID is required.');
        }
        if (!preg_match('/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/', $merchantUpiId)) {
            jsonError('Invalid UPI ID format. Expected: identifier@provider (e.g., merchant@upi, 9876543210@paytm)');
        }
        if (!$merchantName) {
            jsonError('Merchant name is required.');
        }

        $admin = getCurrentUser();

        $pdo->beginTransaction();
        try {
            // Deactivate all existing configs
            $pdo->prepare('UPDATE upi_merchant_config SET is_active = FALSE')->execute();

            // Insert new config
            $stmt = $pdo->prepare('
                INSERT INTO upi_merchant_config (merchant_upi_id, merchant_name, is_active, notes)
                VALUES (?, ?, ?, ?)
            ');
            $stmt->execute([$merchantUpiId, $merchantName, $isActive, $notes]);
            $configId = (int) $pdo->lastInsertId();

            $pdo->commit();

            jsonSuccess([
                'config_id' => $configId,
                'merchant_upi_id' => $merchantUpiId,
                'merchant_name' => $merchantName,
                'is_active' => $isActive,
                'notes' => $notes,
                'message' => 'UPI merchant configuration updated successfully.',
            ], 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('[TravelEase DB] UPI Config error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
} catch (Exception $e) {
    error_log('[TravelEase] UPI Config error: ' . $e->getMessage());
    jsonError($e->getMessage(), 500);
}