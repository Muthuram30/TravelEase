<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
requireAdminSession();

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    // GET: List all merchants or filter by status
    if ($method === 'GET') {
        $status = $_GET['status'] ?? null;
        // Explicit column list — never expose merchant password hashes
        $sql = "
            SELECT 
                m.merchant_id, m.business_name, m.owner_name, m.email, m.phone,
                m.status, m.rejection_reason, m.created_at, m.updated_at,
                (SELECT COUNT(*) FROM foodspot_location WHERE merchant_id = m.merchant_id) AS location_count,
                (SELECT venue_name FROM foodspot_location WHERE merchant_id = m.merchant_id LIMIT 1) AS primary_venue
            FROM foodspot_merchant m
            WHERE 1=1
        ";
        $params = [];
        if ($status) {
            $sql .= " AND m.status = ?";
            $params[] = $status;
        }
        $sql .= " ORDER BY m.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $merchants = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch audit log
        $auditStmt = $db->query("
            SELECT a.*, m.business_name, adm.full_name as admin_name
            FROM merchant_application_audit a
            INNER JOIN foodspot_merchant m ON a.merchant_id = m.merchant_id
            LEFT JOIN admin adm ON a.performed_by = adm.admin_id
            ORDER BY a.created_at DESC
            LIMIT 20
        ");
        $audits = $auditStmt->fetchAll(PDO::FETCH_ASSOC);

        jsonSuccess([
            'merchants' => $merchants,
            'audits' => $audits
        ]);
    }

    // POST: Approve, Reject, or Suspend
    if ($method === 'POST') {
        $action = $_GET['action'] ?? '';
        $id = (int)($_GET['id'] ?? 0);
        $body = getJsonBody();
        $notes = trim($body['notes'] ?? $body['reason'] ?? '');
        $adminId = $_SESSION['admin_id'] ?? null;

        if (!$id) {
            jsonError('Merchant ID is required', 400);
        }

        if (!in_array($action, ['approve', 'reject', 'suspend', 'reactivate'])) {
            jsonError('Invalid action', 400);
        }

        $newStatus = match ($action) {
            'approve' => 'approved',
            'reject' => 'rejected',
            'suspend' => 'suspended',
            'reactivate' => 'approved',
        };

        $stmt = $db->prepare("
            UPDATE foodspot_merchant 
            SET status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
            WHERE merchant_id = ?
        ");
        $stmt->execute([$newStatus, ($action === 'reject' ? $notes : null), $id]);

        // Audit entry
        $auditStmt = $db->prepare("
            INSERT INTO merchant_application_audit (merchant_id, action, performed_by, notes)
            VALUES (?, ?, ?, ?)
        ");
        $auditStmt->execute([$id, $newStatus, $adminId, $notes ?: "Admin status update to $newStatus"]);

        jsonSuccess([
            'merchant_id' => $id,
            'status' => $newStatus,
            'message' => "Merchant application has been $newStatus."
        ]);
    }

} catch (PDOException $e) {
    error_log("Admin food merchants error: " . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}

jsonError('Method not allowed', 405);
