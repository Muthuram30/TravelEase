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

        // Single ownership query — the booking must belong to the
        // authenticated user (booking.user_id) or be associated with the
        // tourist record created for their account email during booking.
        $identColumn = $isToken ? 'b.confirmation_token' : 'b.booking_id';
        $identValue  = $isToken ? $bookingRef : (int)$bookingRef;

        $stmt = $pdo->prepare("
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
            WHERE {$identColumn} = ?
              AND (b.user_id = ? OR t.email = ?)
        ");
        $stmt->execute([$identValue, $user['user_id'] ?? 0, $user['email'] ?? '']);

        $booking = $stmt->fetch();
        if (!$booking) {
            // Deliberately generic: do not reveal whether the booking exists
            jsonError('Booking not found.', 404);
        }

        jsonSuccess($booking);
    }

    // ============================================================
    // POST: Simulate demo payment (marks booking with demo status)
    // POST /api/payments/demo.php?action=simulate
    // Body: { "booking_id": 123 }
    // ============================================================
    if ($method === 'POST' && $action === 'simulate') {
        requireAuthWithCsrf();
        $user = getCurrentUser();

        $body = getJsonBody();
        $bookingId = (int)($body['booking_id'] ?? 0);

        if (!$bookingId) {
            jsonError('booking_id is required.', 400);
        }

        // Verify booking exists AND belongs to the authenticated user.
        // Possession of a booking ID alone must never grant access.
        $stmt = $pdo->prepare('
            SELECT b.booking_id, b.booking_status, b.payment_status, b.total_cost,
                   t.email AS customer_email, t.name AS customer_name
            FROM booking b
            JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE b.booking_id = ?
              AND (b.user_id = ? OR t.email = ?)
        ');
        $stmt->execute([$bookingId, $user['user_id'] ?? 0, $user['email'] ?? '']);
        $booking = $stmt->fetch();

        if (!$booking) {
            jsonError('Booking not found.', 404);
        }

        // ---- DEMO/PAYMENT SEPARATION GUARDS ----
        // A simulated payment must NEVER be confused with a genuine one.
        // 1. Never overwrite an already-verified/real payment status.
        $blockedStatuses = ['paid', 'verified'];
        if (in_array($booking['payment_status'], $blockedStatuses, true)) {
            jsonError('This booking already has a verified payment. Demo simulation is not allowed.', 409);
        }

        // 2. Only Pending bookings may be demo-paid; cancelled/rejected/
        //    confirmed bookings cannot go through the demo flow again.
        if ($booking['booking_status'] !== 'Pending') {
            jsonError('Demo payment is only available for pending bookings.', 409);
        }

        // 3. A booking with a REAL UPI attempt in progress/pending
        //    verification must not be demo-simulated.
        $pdostmt = $pdo->prepare("
            SELECT COUNT(*) FROM payment_attempt
            WHERE booking_id = ? AND payment_status IN ('pending_qr', 'pending_verification', 'verified')
        ");
        $pdostmt->execute([$bookingId]);
        if ((int)$pdostmt->fetchColumn() > 0) {
            jsonError('This booking has an active UPI payment attempt — demo simulation is disabled.', 409);
        }

        // Determine schema capabilities explicitly (no silent catch-fallbacks)
        $colStmt = $pdo->query(
            "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'payment_status'"
        );
        $paymentColumnType = $colStmt->fetchColumn() ?: null;   // false/null when column absent
        $supportsDemoStatus = $paymentColumnType !== null
            && strpos($paymentColumnType, 'demo_completed') !== false;

        // DEMO ONLY: Mark payment_status as 'demo_completed'
        // This is NEVER treated as real payment. Booking status remains 'Pending'.
        // Admin must still review and confirm the booking manually.
        if ($supportsDemoStatus) {
            // The enum explicitly supports demo_completed (migration 013 applied)
            $pdo->prepare('UPDATE booking SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?')
                ->execute(['demo_completed', $bookingId]);
        } elseif ($paymentColumnType !== null) {
            // Column exists but enum lacks demo_completed — demo is NOT supported:
            // refuse instead of silently writing a fake "success" state.
            error_log('[TravelEase Demo] payment_status enum has no demo_completed value — run migration 013.');
            jsonError('Demo payments are disabled until the demo-payment migration is applied.', 503);
        } else {
            // Legacy schema without payment_status: note the simulation so admin
            // review remains possible; never implies any real payment.
            try {
                $pdo->prepare("UPDATE booking SET special_requests = CONCAT(COALESCE(special_requests,''), '[DEMO PAYMENT SIMULATED]') WHERE booking_id = ?")
                    ->execute([$bookingId]);
            } catch (Exception $e) {
                error_log('[TravelEase Demo] Could not record simulation note: ' . $e->getMessage());
                jsonError('Demo payment could not be recorded.', 500);
            }
        }

        // Safe server-side diagnostic (no personal data — only booking ID/amount)
        error_log('[TravelEase DEMO] Simulated demo payment for booking_id=' . $bookingId
            . ' amount=INR' . $booking['total_cost']
            . ' — NO REAL TRANSACTION, booking remains Pending');

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
