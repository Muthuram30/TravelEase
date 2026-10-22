<?php
// ============================================================
// Admin Activity Log
// GET /api/admin/audit.php?search=...&entity_type=booking&page=1&limit=25
// Read-only audit history for admin operations. Admin session required.
// Requires admin_audit_log from database/migrations/015_booking_decisions_admin_audit.sql.
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

try {
    $pdo = getDbConnection();
    $tableCheck = $pdo->prepare("\n        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES\n        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_audit_log'\n    ");
    $tableCheck->execute();
    if ((int) $tableCheck->fetchColumn() === 0) {
        jsonError('Admin activity history is not installed. Apply database/migrations/015_booking_decisions_admin_audit.sql.', 409);
    }

    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int) ($_GET['limit'] ?? 25)));
    $offset = ($page - 1) * $limit;
    $search = trim((string) ($_GET['search'] ?? ''));
    $entityType = trim((string) ($_GET['entity_type'] ?? ''));
    $allowedEntities = ['booking', 'package', 'user', 'tourist'];

    $where = [];
    $params = [];
    if ($search !== '') {
        $like = '%' . $search . '%';
        $where[] = '(action LIKE ? OR entity_type LIKE ? OR actor_name LIKE ? OR CAST(details AS CHAR) LIKE ? OR CAST(entity_id AS CHAR) LIKE ?)';
        array_push($params, $like, $like, $like, $like, $like);
    }
    if (in_array($entityType, $allowedEntities, true)) {
        $where[] = 'entity_type = ?';
        $params[] = $entityType;
    }
    $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM admin_audit_log' . $whereSql);
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare('
        SELECT audit_id, action, entity_type, entity_id, actor_id, actor_name,
               details, old_value, new_value, ip_address, created_at
        FROM admin_audit_log' . $whereSql . '
        ORDER BY created_at DESC, audit_id DESC
        LIMIT ? OFFSET ?
    ');
    $queryParams = $params;
    $queryParams[] = $limit;
    $queryParams[] = $offset;
    $stmt->execute($queryParams);

    jsonSuccess([
        'data' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => max(1, (int) ceil($total / $limit)),
        ],
    ]);
} catch (PDOException $e) {
    error_log('[TravelEase DB] Admin activity log error: ' . $e->getMessage());
    jsonError('Could not load admin activity history. Please try again.', 500);
}
