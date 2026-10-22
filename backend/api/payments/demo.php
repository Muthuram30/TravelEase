<?php
// ============================================================
// Demo Payment Endpoint (NO REAL PAYMENT GATEWAY)
// POST /api/payments/demo.php?action=get_checkout  → Get booking info for checkout page
// POST /api/payments/demo.php?action=simulate      → Simulate demo payment completion
// ============================================================
// DEMO MODE ONLY — No real money is transferred.
// This endpoint is for UI demonstration purposes only.
// Do NOT use in production for real payments.
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

try {
    $pdo = getDbConnection();

    // ============================================================
    // GET: Fetch booking info for demo checkout page
    // GET /api/payments/demo.php?booking_ref=TOKEN_OR_ID
    // ============================================================
    if ($method === 'GET') {
        requireAuth();
        $user = getCurrentUser();

        $bookingRef = trim($_GET['booking_ref'] ?? '');
        if (!$bookingRef) {
            jsonError('booking_ref is required.', 400);
        }

        // Determine if it's a token (128-char hex) or numeric ID
        $isToken = strlen($bookingRef) > 10 && !ctype_digit($bookingRef);

        if ($isToken) {
            $stmt = $pdo->prepare('
                SELECT
                    b.booking_id,
                    b.confirmation_token,
                    b.booking_date,
                    b.travel_date,
                    b.number_of_persons,
                    b.total_cost,
                    b.booking_status,
                    b.payment_status,
                    t.name        AS customer_name,
                    t.email       AS customer_email,
                    t.phone       AS customer_phone,
                    p.package_name,
                    p.destination,
                    p.cost        AS package_cost
                FROM booking b
                JOIN tourist      t ON b.tourist_id = t.tourist_id
                JOIN tour_package p ON b.package_id = p.package_id
                WHERE b.confirmation_token = ?
            ');
            $stmt->execute([$bookingRef]);
        } else {
            $stmt = $pdo->prepare('
                SELECT
                    b.booking_id,
                    b.confirmation_token,
                    b.booking_date,
                    b.travel_date,
                    b.number_of_persons,
                    b.total_cost,
                    b.booking_status,
                    b.payment_status,
                    t.name        AS customer_name,
                    t.email       AS customer_email,
                    t.phone       AS customer_phone,
                    p.package_name,
                    p.destination,
                    p.cost        AS package_cost
                FROM booking b
                JOIN tourist      t ON b.tourist_id = t.tourist_id
                JOIN tour_package p ON b.package_id = p.package_id
                WHERE b.booking_id = ?
            ');
            $stmt->execute([(int)$bookingRef]);
        }

        $booking = $stmt->fetch();
        if (!$booking) {
            jsonError('Booking not found.', 404);
        }

        // Authorization: ensure the booking belongs to this user
        // Match by email or user_id (handle both old and new schema)
        $userEmail = $user['email'] ?? '';
        if ($booking['customer_email'] !== $userEmail) {
            // Try user_id match (if booking has user_id column)
            try {
                $authCheck = $pdo->prepare('SELECT user_id FROM booking WHERE booking_id = ?');
                $authCheck->execute([$booking['booking_id']]);
                $row = $authCheck->fetch();
                if ($row && isset($row['user_id']) && $row['user_id'] !== null) {
                    if ((int)$row['user_id'] !== (int)($user['user_id'] ?? 0)) {
                        jsonError('Access denied.', 403);
                    }
                }
            } catch (Exception $ignored) {
                // user_id column may not exist — skip this check
            }
        }

        jsonSuccess($booking);
    }

    // ============================================================
    // POST: Simulate demo payment (marks booking with demo status)
    // POST /api/payments/demo.php?action=simulate
    // Body: { "booking_id": 123 }
    // ============================================================
    if ($method === 'POST' && $action === 'simulate') {
        requireAuth();
        $user = getCurrentUser();

        $body = getJsonBody();
        $bookingId = (int)($body['booking_id'] ?? 0);

        if (!$bookingId) {
            jsonError('booking_id is required.', 400);
        }

        // Verify booking exists and belongs to user
        $stmt = $pdo->prepare('
            SELECT b.booking_id, b.total_cost, b.booking_status, b.payment_status,
                   t.email AS customer_email, t.name AS customer_name
            FROM booking b
            JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE b.booking_id = ?
        ');
        $stmt->execute([$bookingId]);
        $booking = $stmt->fetch();

        if (!$booking) {
            jsonError('Booking not found.', 404);
        }

        // Authorization check
        $userEmail = $user['email'] ?? '';
        if ($booking['customer_email'] !== $userEmail) {
            try {
                $authCheck = $pdo->prepare('SELECT user_id FROM booking WHERE booking_id = ?');
                $authCheck->execute([$bookingId]);
                $row = $authCheck->fetch();
                if ($row && isset($row['user_id']) && $row['user_id'] !== null) {
                    if ((int)$row['user_id'] !== (int)($user['user_id'] ?? 0)) {
                        jsonError('Access denied.', 403);
                    }
                }
            } catch (Exception $ignored) {}
        }

        // Check payment_status column exists (added by migration 002)
        $hasPaymentStatus = false;
        try {
            $colCheck = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'payment_status'");
            $hasPaymentStatus = (int)$colCheck->fetchColumn() > 0;
        } catch (Exception $ignored) {}

        // DEMO ONLY: Mark payment_status as 'demo_completed'
        // This is NEVER treated as real payment. Booking status remains 'Pending'.
        // Admin must still review and confirm the booking manually.
        if ($hasPaymentStatus) {
            // Check if payment_status enum allows 'demo_completed' — if not, use a note approach
            try {
                // First try to update payment_status (may fail if enum doesn't have this value)
                $pdo->prepare('UPDATE booking SET payment_status = ? WHERE booking_id = ?')
                    ->execute(['demo_completed', $bookingId]);
            } catch (PDOException $enumErr) {
                // enum doesn't allow demo_completed — use special_requests field to note demo
                error_log('[TravelEase Demo] payment_status enum does not allow demo_completed, using special_requests note: ' . $enumErr->getMessage());
                try {
                    $pdo->prepare("UPDATE booking SET special_requests = CONCAT(COALESCE(special_requests,''), '[DEMO PAYMENT SIMULATED]') WHERE booking_id = ?")
                        ->execute([$bookingId]);
                } catch (Exception $ignored2) {}
            }
        } else {
            // No payment_status column — use special_requests if available
            try {
                $pdo->prepare("UPDATE booking SET special_requests = CONCAT(COALESCE(special_requests,''), '[DEMO PAYMENT SIMULATED]') WHERE booking_id = ?")
                    ->execute([$bookingId]);
            } catch (Exception $ignored) {}
        }

        // Log to error_log for audit trail (no real transaction)
        error_log('[TravelEase DEMO] Demo payment simulated for booking_id=' . $bookingId
            . ' customer=' . $booking['customer_name']
            . ' amount=INR' . $booking['total_cost']
            . ' — NO REAL TRANSACTION');

        jsonSuccess([
            'booking_id'    => $bookingId,
            'demo_status'   => 'demo_completed',
            'message'       => 'Demo Payment Completed — No Real Transaction',
            'is_demo'       => true,
            'amount'        => $booking['total_cost'],
            'booking_status'=> $booking['booking_status'], // Still 'Pending' — admin must confirm
        ]);
    }

    jsonError('Method or action not allowed.', 405);

} catch (PDOException $e) {
    error_log('[TravelEase DB] Demo payment error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
} catch (Exception $e) {
    error_log('[TravelEase] Demo payment error: ' . $e->getMessage());
    jsonError($e->getMessage(), 500);
}
