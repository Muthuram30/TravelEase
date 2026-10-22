<?php
// ============================================================
// Admin Payment Verification Endpoints
// GET  /api/admin/payments.php                    → List payments with filters
// GET  /api/admin/payments.php?id=N               → Single payment details
// POST /api/admin/payments.php?action=verify&id=N  → Verify payment (admin)
// POST /api/admin/payments.php?action=reject&id=N  → Reject payment (admin)
// GET  /api/admin/payments.php?audit=1&payment_id=N → Get audit log
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

try {
    $pdo = getDbConnection();

    // Require admin session with CSRF for mutations
    if ($method === 'GET') {
        requireAdminSession();
    } else {
        requireAdminSessionWithCsrf();
    }

    // ---- Helper: Log audit trail ----
    function logAudit(PDO $pdo, int $paymentId, int $bookingId, ?string $oldStatus, string $newStatus, string $actorType, ?int $actorId, ?string $actorName, array $details = []): void {
        $stmt = $pdo->prepare('
            INSERT INTO payment_audit_log (payment_id, booking_id, old_status, new_status, actor_type, actor_id, actor_name, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $paymentId,
            $bookingId,
            $oldStatus,
            $newStatus,
            $actorType,
            $actorId,
            $actorName,
            json_encode($details),
            getClientIp(),
            $_SERVER['HTTP_USER_AGENT'] ?? null,
        ]);
    }

    // ---- Helper: Fetch payment with full details ----
    function fetchPaymentById(PDO $pdo, int $id): ?array {
        $stmt = $pdo->prepare('
            SELECT
                pa.*,
                b.booking_id,
                b.total_cost,
                b.booking_status,
                b.payment_status AS booking_payment_status,
                t.name        AS customer_name,
                t.email       AS customer_email,
                t.phone       AS customer_phone,
                p.package_name,
                p.destination,
                p.duration,
                u.full_name   AS verified_by_name,
                u.email       AS verified_by_email
            FROM payment_attempt pa
            JOIN booking b ON pa.booking_id = b.booking_id
            JOIN tourist t ON b.tourist_id = t.tourist_id
            JOIN tour_package p ON b.package_id = p.package_id
            LEFT JOIN users u ON pa.verified_by = u.user_id
            WHERE pa.payment_id = ?
        ');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // ============================================================
    // GET: List payments (with search/filter)
    // ============================================================
    if ($method === 'GET' && !isset($_GET['id']) && !isset($_GET['audit'])) {
        $search = trim($_GET['search'] ?? '');
        $status = trim($_GET['status'] ?? '');
        $dateFrom = trim($_GET['date_from'] ?? '');
        $dateTo = trim($_GET['date_to'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(50, max(1, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $sql = '
            SELECT
                pa.payment_id,
                pa.booking_id,
                pa.amount_expected,
                pa.currency,
                pa.merchant_name,
                pa.upi_order_ref,
                pa.payment_status,
                pa.submitted_utr,
                pa.receipt_path,
                pa.created_at,
                pa.expires_at,
                pa.verified_at,
                pa.verified_by,
                t.name        AS customer_name,
                t.email       AS customer_email,
                p.package_name,
                p.destination,
                b.booking_status,
                b.payment_status AS booking_payment_status
            FROM payment_attempt pa
            JOIN booking b ON pa.booking_id = b.booking_id
            JOIN tourist t ON b.tourist_id = t.tourist_id
            JOIN tour_package p ON b.package_id = p.package_id
            WHERE 1=1
        ';
        $params = [];

        if ($search) {
            $like = '%' . $search . '%';
            $sql .= ' AND (t.name LIKE ? OR t.email LIKE ? OR p.package_name LIKE ? OR pa.upi_order_ref LIKE ? OR pa.submitted_utr LIKE ?)';
            $params = array_merge($params, [$like, $like, $like, $like, $like]);
        }

        $validStatuses = ['pending_qr', 'pending_verification', 'verified', 'rejected', 'expired', 'cancelled'];
        if ($status && in_array($status, $validStatuses)) {
            $sql .= ' AND pa.payment_status = ?';
            $params[] = $status;
        }

        if ($dateFrom) {
            $sql .= ' AND DATE(pa.created_at) >= ?';
            $params[] = $dateFrom;
        }
        if ($dateTo) {
            $sql .= ' AND DATE(pa.created_at) <= ?';
            $params[] = $dateTo;
        }

        // Count total
        $countSql = 'SELECT COUNT(*) as total FROM (' . $sql . ') as sub';
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch()['total'];

        $sql .= ' ORDER BY pa.created_at DESC LIMIT ? OFFSET ?';
        $params[] = $limit;
        $params[] = $offset;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $payments = $stmt->fetchAll();

        jsonSuccess([
            'data' => $payments,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit),
            ],
        ]);
    }

    // ============================================================
    // GET: Single payment details
    // ============================================================
    if ($method === 'GET' && isset($_GET['id']) && !isset($_GET['audit'])) {
        $id = (int) $_GET['id'];
        $payment = fetchPaymentById($pdo, $id);

        if (!$payment) {
            jsonError('Payment not found.', 404);
        }

        jsonSuccess($payment);
    }

    // ============================================================
    // GET: Audit log for a payment
    // ============================================================
    if ($method === 'GET' && isset($_GET['audit']) && isset($_GET['payment_id'])) {
        $paymentId = (int) $_GET['payment_id'];

        $stmt = $pdo->prepare('
            SELECT * FROM payment_audit_log
            WHERE payment_id = ?
            ORDER BY created_at DESC
        ');
        $stmt->execute([$paymentId]);
        $auditLog = $stmt->fetchAll();

        jsonSuccess($auditLog);
    }

    // ============================================================
    // POST: Admin verifies payment
    // ============================================================
    if ($method === 'POST' && $action === 'verify') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Payment ID is required.');

        $body = getJsonBody();
        $notes = trim($body['notes'] ?? '');

        $payment = fetchPaymentById($pdo, $id);
        if (!$payment) {
            jsonError('Payment not found.', 404);
        }

        if ($payment['payment_status'] !== 'pending_verification') {
            jsonError('Only payments in "pending_verification" status can be verified.');
        }

        $admin = getCurrentUser(); // Returns admin user data

        $oldStatus = $payment['payment_status'];
        $newStatus = 'verified';

        $pdo->beginTransaction();
        try {
            // Update payment attempt
            $pdo->prepare('
                UPDATE payment_attempt 
                SET payment_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE payment_id = ?
            ')->execute([$newStatus, $admin['user_id'], $id]);

            // Update booking payment_status
            $pdo->prepare('UPDATE booking SET payment_status = ? WHERE booking_id = ?')
                ->execute(['paid', $payment['booking_id']]);

            // If booking is still Pending, auto-confirm it (optional - admin can also confirm separately)
            if ($payment['booking_status'] === 'Pending') {
                // Check availability first
                $availStmt = $pdo->prepare('SELECT availability FROM tour_package WHERE package_id = (SELECT package_id FROM booking WHERE booking_id = ?)');
                $availStmt->execute([$payment['booking_id']]);
                $pkg = $availStmt->fetch();

                if ($pkg && $pkg['availability'] >= $payment['number_of_persons']) {
                    $pdo->prepare('UPDATE booking SET booking_status = ? WHERE booking_id = ?')
                        ->execute(['Confirmed', $payment['booking_id']]);
                    $pdo->prepare('UPDATE tour_package SET availability = availability - ? WHERE package_id = (SELECT package_id FROM booking WHERE booking_id = ?)')
                        ->execute([$payment['number_of_persons'], $payment['booking_id']]);
                }
            }

            logAudit($pdo, $id, $payment['booking_id'], $oldStatus, $newStatus, 'admin', $admin['user_id'], $admin['full_name'] ?? $admin['email'] ?? 'Admin', [
                'notes' => $notes,
                'booking_status_updated' => $payment['booking_status'] === 'Pending' ? 'Confirmed' : 'unchanged',
            ]);

            $pdo->commit();

            jsonSuccess(['message' => 'Payment verified successfully. Booking payment status updated to paid.']);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ============================================================
    // POST: Admin rejects payment
    // ============================================================
    if ($method === 'POST' && $action === 'reject') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Payment ID is required.');

        $body = getJsonBody();
        $reason = trim($body['reason'] ?? '');

        if (!$reason) {
            jsonError('Rejection reason is required.');
        }

        $payment = fetchPaymentById($pdo, $id);
        if (!$payment) {
            jsonError('Payment not found.', 404);
        }

        if (!in_array($payment['payment_status'], ['pending_qr', 'pending_verification'])) {
            jsonError('Only pending payments can be rejected.');
        }

        $admin = getCurrentUser();

        $oldStatus = $payment['payment_status'];
        $newStatus = 'rejected';

        $pdo->beginTransaction();
        try {
            $pdo->prepare('
                UPDATE payment_attempt 
                SET payment_status = ?, rejection_reason = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE payment_id = ?
            ')->execute([$newStatus, $reason, $admin['user_id'], $id]);

            // Update booking payment_status
            $pdo->prepare('UPDATE booking SET payment_status = ? WHERE booking_id = ?')
                ->execute(['failed', $payment['booking_id']]);

            logAudit($pdo, $id, $payment['booking_id'], $oldStatus, $newStatus, 'admin', $admin['user_id'], $admin['full_name'] ?? $admin['email'] ?? 'Admin', [
                'reason' => $reason,
            ]);

            $pdo->commit();

            jsonSuccess(['message' => 'Payment rejected.']);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ============================================================
    // POST: Admin marks payment as expired (cleanup)
    // ============================================================
    if ($method === 'POST' && $action === 'expire') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Payment ID is required.');

        $payment = fetchPaymentById($pdo, $id);
        if (!$payment) {
            jsonError('Payment not found.', 404);
        }

        if ($payment['payment_status'] !== 'pending_qr') {
            jsonError('Only pending QR payments can be expired.');
        }

        $admin = getCurrentUser();

        $oldStatus = $payment['payment_status'];
        $newStatus = 'expired';

        $pdo->prepare('UPDATE payment_attempt SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?')
            ->execute([$newStatus, $id]);

        logAudit($pdo, $id, $payment['booking_id'], $oldStatus, $newStatus, 'admin', $admin['user_id'], $admin['full_name'] ?? $admin['email'] ?? 'Admin');

        jsonSuccess(['message' => 'Payment marked as expired.']);
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('[TravelEase DB] Admin Payment error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
} catch (Exception $e) {
    error_log('[TravelEase] Admin Payment error: ' . $e->getMessage());
    jsonError($e->getMessage(), 500);
}