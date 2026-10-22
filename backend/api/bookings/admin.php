<?php
// ============================================================
// Admin Booking Management API
// GET    /api/bookings/admin.php               → list bookings (search/filter/pagination)
// GET    /api/bookings/admin.php?id=N          → single booking details
// POST   /api/bookings/admin.php?action=confirm&id=N  (requires CSRF)
// POST   /api/bookings/admin.php?action=cancel&id=N   (requires CSRF)
// POST   /api/bookings/admin.php?action=reject&id=N   (requires CSRF, optional reason in JSON body)
// DELETE /api/bookings/admin.php?id=N          (requires CSRF)
// ============================================================
//
// State machine (booking_status):
//   Pending → Confirmed | Rejected | Cancelled
//   Confirmed → Cancelled
//   Rejected / Cancelled are terminal — no further transitions.
// Confirming a booking decrements tour_package.availability inside a
// transaction; cancel only restores availability when the booking was
// confirmed. Payment verification is intentionally NOT touched here —
// payment_status is a separate workflow (api/admin/payments.php).

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];

// Read operations don't need CSRF, mutations do
if ($method === 'GET') {
    requireAdminSession();
} else {
    requireAdminSessionWithCsrf();
}

// ---- HELPER: safe column detection for optional booking columns ----
function bookingColumns(PDO $pdo): array {
    static $cols = null;
    if ($cols === null) {
        $stmt = $pdo->query("
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'booking'
        ");
        $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    return $cols;
}

// ---- HELPER: full booking JOIN query (reused by list & detail) ----
function fetchBookingById(PDO $pdo, int $id): ?array {
    $cols = bookingColumns($pdo);
    $hasDecision = in_array('decision_by', $cols);

    $decisionSelect = $hasDecision
        ? 'b.decision_by, b.decision_by_name, b.decision_at, b.rejection_reason,'
        : 'NULL AS decision_by, NULL AS decision_by_name, NULL AS decision_at, NULL AS rejection_reason,';

    $stmt = $pdo->prepare("
        SELECT
            b.booking_id,
            b.booking_date,
            b.travel_date,
            b.number_of_persons,
            b.total_cost,
            b.booking_status,
            b.payment_status,
            b.special_requests,
            b.user_id,
            $decisionSelect
            u.role      AS user_role,
            u.full_name AS user_account_name,
            u.email     AS user_account_email,
            u.is_active AS user_is_active,
            t.tourist_id,
            t.name        AS customer_name,
            t.email       AS customer_email,
            t.phone       AS customer_phone,
            t.address     AS customer_address,
            p.package_id,
            p.package_name,
            p.destination,
            p.duration,
            p.cost        AS package_cost
        FROM booking b
        JOIN tourist      t ON b.tourist_id = t.tourist_id
        JOIN tour_package p ON b.package_id = p.package_id
        LEFT JOIN users   u ON u.user_id    = b.user_id
        WHERE b.booking_id = ?
    ");
    $stmt->execute([$id]);
    $booking = $stmt->fetch() ?: null;

    // Enrich with the latest payment attempt (separate UPI workflow)
    if ($booking) {
        $payStmt = $pdo->prepare('
            SELECT payment_id, payment_status, amount_expected, currency,
                   merchant_name, upi_order_ref, submitted_utr, receipt_path,
                   created_at, verified_at, rejection_reason
            FROM payment_attempt
            WHERE booking_id = ?
            ORDER BY payment_id DESC
            LIMIT 1
        ');
        $payStmt->execute([$id]);
        $booking['payment'] = $payStmt->fetch() ?: null;
    }

    return $booking;
}

// ---- HELPER: apply a status change with row locking + decision metadata ----
// Returns true when the row was transitioned; exits with a JSON error
// otherwise. The caller is responsible for begin/commit/rollback.
function applyBookingTransition(
    PDO $pdo,
    array $booking,
    string $targetStatus,
    array $extraSets = [],
    array $extraParams = [],
    ?string $rejectionReason = null
): void {
    $id = (int) $booking['booking_id'];
    $currentStatus = $booking['booking_status'];

    // Lock the row so concurrent/duplicate submissions serialise.
    $lockStmt = $pdo->prepare('SELECT booking_status FROM booking WHERE booking_id = ? FOR UPDATE');
    $lockStmt->execute([$id]);
    $locked = $lockStmt->fetch();

    if (!$locked) {
        $pdo->rollBack();
        jsonError('Booking not found.', 404);
    }

    $liveStatus = $locked['booking_status'];

    // Idempotent no-op: the booking already shows the target status.
    // Nothing to change — respond with success and do not touch the row.
    if ($liveStatus === $targetStatus) {
        $pdo->rollBack();
        jsonSuccess([
            'message' => "Booking #$id is already $targetStatus. No changes were made.",
            'booking_id' => $id,
            'status' => $liveStatus,
            'already_in_state' => true,
        ]);
    }

    // Guard against incompatible states (finalised, in-flight transitions)
    $allowed = [
        'confirm' => ['Pending'],
        'reject'  => ['Pending'],
        'cancel'  => ['Pending', 'Confirmed'],
    ];
    $action = $_GET['action'] ?? '';
    $fromStatuses = $allowed[$action] ?? null;

    if ($fromStatuses !== null && !in_array($liveStatus, $fromStatuses)) {
        $pdo->rollBack();
        jsonError(
            "Cannot $action a booking that is currently \"$liveStatus\". " .
            ($liveStatus === $currentStatus ? "Only Pending bookings can be $action" . 'ed.' : 'The booking status changed while you were acting on it.'),
            409
        );
    }

    // Record decision metadata where migration 015 has added the columns
    $cols = bookingColumns($pdo);
    $sets = ['booking_status = ?'];
    $params = [$targetStatus];

    if (in_array('decision_by', $cols) && in_array('decision_at', $cols)) {
        startSession();
        $sets[] = 'decision_by = ?';
        $sets[] = 'decision_at = CURRENT_TIMESTAMP';
        $params[] = $_SESSION['user_id'] ?? null;
        if (in_array('decision_by_name', $cols)) {
            $sets[] = 'decision_by_name = ?';
            $params[] = $_SESSION['admin_name'] ?? ($_SESSION['user_name'] ?? null);
        }
    }
    if ($targetStatus === 'Rejected' && in_array('rejection_reason', $cols)) {
        $sets[] = 'rejection_reason = ?';
        $params[] = $rejectionReason;
    }

    foreach (array_keys($extraSets) as $col) {
        $sets[] = "$col = ?";
        $params[] = $extraSets[$col];
    }

    $stmt = $pdo->prepare('UPDATE booking SET ' . implode(', ', $sets) . ' WHERE booking_id = ?');
    $params[] = $id;
    $stmt->execute(array_merge($params, $extraParams));
}

try {
    $pdo = getDbConnection();

    // ---- GET single booking ----
    if ($method === 'GET' && isset($_GET['id'])) {
        $id      = (int) $_GET['id'];
        $booking = fetchBookingById($pdo, $id);
        if (!$booking) jsonError('Booking not found.', 404);
        jsonSuccess($booking);
    }

    // ---- GET list ----
    if ($method === 'GET') {
        $search   = trim($_GET['search'] ?? '');
        $status   = trim($_GET['status'] ?? '');
        $page     = max(1, (int) ($_GET['page'] ?? 1));
        $limit    = min(50, max(1, (int) ($_GET['limit'] ?? 20)));
        $offset   = ($page - 1) * $limit;
        $userRole = trim($_GET['user_role'] ?? ''); // all | regular | premium

        $cols = bookingColumns($pdo);
        $hasDecision = in_array('decision_by', $cols);

        $decisionSelect = $hasDecision
            ? 'b.decision_by, b.decision_by_name, b.decision_at, b.rejection_reason,'
            : 'NULL AS decision_by, NULL AS decision_by_name, NULL AS decision_at, NULL AS rejection_reason,';

        // SQL QUERY: 3-table JOIN — complete booking info
        $sql    = "
            SELECT
                b.booking_id,
                b.booking_date,
                b.travel_date,
                b.number_of_persons,
                b.total_cost,
                b.booking_status,
                b.payment_status,
                b.created_at,
                b.user_id,
                $decisionSelect
                u.role        AS user_role,
                t.name        AS customer_name,
                t.email       AS customer_email,
                t.phone       AS customer_phone,
                p.package_name,
                p.destination
            FROM booking b
            JOIN tourist      t ON b.tourist_id = t.tourist_id
            JOIN tour_package p ON b.package_id = p.package_id
            LEFT JOIN users   u ON u.user_id    = b.user_id
            WHERE 1=1
        ";
        $params = [];

        if ($search) {
            $like    = '%' . $search . '%';
            $sql    .= ' AND (t.name LIKE ? OR t.email LIKE ? OR p.package_name LIKE ? OR p.destination LIKE ? OR b.booking_id = ?)';
            $params  = array_merge($params, [$like, $like, $like, $like, $search]);
        }

        $validStatuses = ['Pending', 'Confirmed', 'Cancelled', 'Rejected'];
        if ($status && in_array($status, $validStatuses)) {
            $sql     .= ' AND b.booking_status = ?';
            $params[] = $status;
        }

        // Booker type filter — regular users vs premium users (admins are never bookers here)
        if ($userRole === 'regular') {
            $sql .= ' AND (u.role = "user" OR u.user_id IS NULL)';
        } elseif ($userRole === 'premium') {
            $sql .= ' AND u.role = "premium"';
        } elseif ($userRole === 'admin') {
            $sql .= ' AND u.role = "admin"';
        }

        // Count total before applying LIMIT for pagination
        $countSql = 'SELECT COUNT(*) AS total FROM booking b
                     JOIN tourist t ON b.tourist_id = t.tourist_id
                     JOIN tour_package p ON b.package_id = p.package_id
                     LEFT JOIN users u ON u.user_id = b.user_id
                     WHERE 1=1';
        $countParams = [];
        // Re-apply filters on the count query without re-binding LIMIT/OFFSET
        if ($search) {
            $like = '%' . $search . '%';
            $countSql .= ' AND (t.name LIKE ? OR t.email LIKE ? OR p.package_name LIKE ? OR p.destination LIKE ? OR b.booking_id = ?)';
            $countParams = array_merge($countParams, [$like, $like, $like, $like, $search]);
        }
        if ($status && in_array($status, $validStatuses)) {
            $countSql     .= ' AND b.booking_status = ?';
            $countParams[] = $status;
        }
        if ($userRole === 'regular') {
            $countSql .= ' AND (u.role = "user" OR u.user_id IS NULL)';
        } elseif ($userRole === 'premium') {
            $countSql .= ' AND u.role = "premium"';
        } elseif ($userRole === 'admin') {
            $countSql .= ' AND u.role = "admin"';
        }

        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($countParams);
        $total = (int) $countStmt->fetch()['total'];

        $sql .= ' ORDER BY b.booking_id DESC LIMIT ? OFFSET ?';
        $params[] = $limit;
        $params[] = $offset;

        $stmt     = $pdo->prepare($sql);
        $stmt->execute($params);
        $bookings = $stmt->fetchAll();

        jsonSuccess([
            'data' => $bookings,
            'pagination' => [
                'page'  => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => max(1, (int) ceil($total / $limit)),
            ],
        ]);
    }

    // ---- POST: status change actions ----
    if ($method === 'POST') {
        $action = trim($_GET['action'] ?? '');
        $id     = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Booking ID is required.');
        // Read the body once. php://input is a stream, so reading it in both
        // the transition helper and the audit branch loses the rejection reason.
        $requestBody = $action === 'reject' ? getJsonBody() : [];
        $reasonText = trim((string) ($requestBody['reason'] ?? ''));
        $rejectionReason = $reasonText === '' ? null : mb_substr($reasonText, 0, 2000);

        $pdo->beginTransaction();

        $booking = fetchBookingById($pdo, $id);
        if (!$booking) {
            $pdo->rollBack();
            jsonError('Booking not found.', 404);
        }

        $currentStatus = $booking['booking_status'];

        // ---- Idempotency: repeating the same transition is a safe no-op ----
        // (duplicate double-clicks / retries never double-process a booking)
        $targetStatuses = ['confirm' => 'Confirmed', 'reject' => 'Rejected', 'cancel' => 'Cancelled'];
        if (isset($targetStatuses[$action]) && $currentStatus === $targetStatuses[$action]) {
            $pdo->rollBack();
            jsonSuccess([
                'message'          => "Booking #$id is already $currentStatus. No changes were made.",
                'booking_id'       => $id,
                'status'           => $currentStatus,
                'already_in_state' => true,
            ]);
        }

        // ---- CONFIRM (= "approve"): Pending → Confirmed ----
        if ($action === 'confirm') {
            if ($currentStatus === 'Rejected' || $currentStatus === 'Cancelled') {
                $pdo->rollBack();
                jsonError(
                    "This booking was already $currentStatus and is finalised. " .
                    'It cannot be approved. Ask the customer to create a new booking.',
                    409
                );
            }
            if ($currentStatus !== 'Pending') {
                $pdo->rollBack();
                jsonError("Only Pending bookings can be confirmed. Current status: $currentStatus.", 409);
            }

            // Check availability against a live value (package may have changed)
            $lockStmt = $pdo->prepare('SELECT availability FROM tour_package WHERE package_id = ? FOR UPDATE');
            $lockStmt->execute([$booking['package_id']]);
            $pkg = $lockStmt->fetch();

            if (!$pkg || $pkg['availability'] < $booking['number_of_persons']) {
                $pdo->rollBack();
                jsonError('Not enough availability to approve this booking.', 409);
            }

            // Decrement availability BEFORE the status transition (same transaction)
            $pdo->prepare('UPDATE tour_package SET availability = availability - ? WHERE package_id = ?')
                ->execute([$booking['number_of_persons'], $booking['package_id']]);

            applyBookingTransition($pdo, $booking, 'Confirmed');

            $pdo->commit();
            logAdminAction($pdo, 'booking_approve', 'booking', $id, [
                'customer'          => $booking['customer_name'],
                'package'           => $booking['package_name'],
                'persons'           => (int) $booking['number_of_persons'],
                'old_booking_status' => $currentStatus,
                'booking_status'     => 'Confirmed',
                'payment_status'     => $booking['payment_status'], // separate workflow — unchanged
            ], $currentStatus, 'Confirmed');

            jsonSuccess([
                'message'     => "Booking #$id approved.",
                'booking_id'  => $id,
                'status'      => 'Confirmed',
                'payment_note'=> 'Booking approved. Payment verification is a separate step — this booking is not marked as paid.',
            ]);
        }

        // ---- REJECT: Pending → Rejected (optional reason) ----
        if ($action === 'reject') {
            if ($currentStatus === 'Confirmed') {
                $pdo->rollBack();
                jsonError('This booking is already approved. Use "Cancel" instead of rejecting it.', 409);
            }
            if ($currentStatus === 'Rejected') {
                $pdo->rollBack();
                jsonError('This booking is already rejected and is finalised.', 409);
            }
            if ($currentStatus !== 'Pending') {
                $pdo->rollBack();
                jsonError("Only Pending bookings can be rejected. Current status: $currentStatus.", 409);
            }

            applyBookingTransition($pdo, $booking, 'Rejected', [], [], $rejectionReason);

            $pdo->commit();

            logAdminAction($pdo, 'booking_reject', 'booking', $id, [
                'customer'  => $booking['customer_name'],
                'package'   => $booking['package_name'],
                'reason'    => $rejectionReason,
            ], $currentStatus, 'Rejected');

            jsonSuccess([
                'message'    => "Booking #$id rejected.",
                'booking_id' => $id,
                'status'     => 'Rejected',
            ]);
        }

        // ---- CANCEL ----
        if ($action === 'cancel') {
            if ($currentStatus === 'Cancelled') {
                $pdo->rollBack();
                jsonSuccess([
                    'message' => "Booking #$id is already cancelled. No changes were made.",
                    'booking_id' => $id,
                    'status' => 'Cancelled',
                    'already_in_state' => true,
                ]);
            }
            if (!in_array($currentStatus, ['Pending', 'Confirmed'], true)) {
                $pdo->rollBack();
                jsonError("A \"$currentStatus\" booking cannot be cancelled. Only Pending or Confirmed bookings can be cancelled.", 409);
            }

            // If confirmed, availability must be restored (same transaction)
            if ($currentStatus === 'Confirmed') {
                $pdo->prepare('UPDATE tour_package SET availability = availability + ? WHERE package_id = ?')
                    ->execute([$booking['number_of_persons'], $booking['package_id']]);
            }

            applyBookingTransition($pdo, $booking, 'Cancelled');

            $pdo->commit();
            logAdminAction($pdo, 'booking_cancel', 'booking', $id, [
                'customer' => $booking['customer_name'],
                'package'  => $booking['package_name'],
            ], $currentStatus, 'Cancelled');

            jsonSuccess(['message' => "Booking #$id cancelled. Availability restored."]);
        }

        $pdo->rollBack();
        jsonError('Unknown action.', 400);
    }

    // ---- DELETE ----
    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Booking ID is required.');

        $booking = fetchBookingById($pdo, $id);
        if (!$booking) jsonError('Booking not found.', 404);

        // Never hard-delete bookings with payment history (referential + audit integrity)
        if (!empty($booking['payment'])) {
            jsonError('This booking has a payment history and cannot be deleted. Cancel it instead.', 409);
        }

        $pdo->beginTransaction();

        // If confirmed, restore availability before deletion
        if ($booking['booking_status'] === 'Confirmed') {
            $pdo->prepare('UPDATE tour_package SET availability = availability + ? WHERE package_id = ?')
                ->execute([$booking['number_of_persons'], $booking['package_id']]);
        }

        $pdo->prepare('DELETE FROM booking WHERE booking_id = ?')->execute([$id]);
        $pdo->commit();

        logAdminAction($pdo, 'booking_delete', 'booking', $id, [
            'customer' => $booking['customer_name'],
            'package'  => $booking['package_name'],
        ], $booking['booking_status'], null);

        jsonSuccess(['message' => 'Booking deleted successfully.']);
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[TravelEase DB] Admin booking error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
