<?php
// ============================================================
// UPI QR Payment Endpoints
// POST /api/payments/upi.php?action=create_qr     → Generate UPI QR for booking
// GET  /api/payments/upi.php?payment_id=X        → Get payment details (with QR)
// POST /api/payments/upi.php?action=submit_utr   → Customer submits UTR
// POST /api/payments/upi.php?action=upload_receipt → Upload payment receipt
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

try {
    $pdo = getDbConnection();

    // ---- Helper: Get active UPI merchant config ----
    function getActiveUpiConfig(PDO $pdo): ?array {
        $stmt = $pdo->prepare('SELECT * FROM upi_merchant_config WHERE is_active = TRUE LIMIT 1');
        $stmt->execute();
        return $stmt->fetch() ?: null;
    }

    // ---- Helper: Generate UPI QR payload ----
    function generateUpiPayload(array $config, string $orderRef, float $amount, string $note): string {
        // UPI URI format: upi://pay?pa=MERCHANT_UPI_ID&pn=MERCHANT_NAME&am=AMOUNT&cu=INR&tn=NOTE&tr=ORDER_REF
        $params = [
            'pa' => $config['merchant_upi_id'],
            'pn' => $config['merchant_name'],
            'am' => number_format($amount, 2, '.', ''),
            'cu' => 'INR',
            'tn' => $note,
            'tr' => $orderRef,
        ];
        return 'upi://pay?' . http_build_query($params);
    }

    // ---- Helper: Generate QR code as SVG (inline) ----
    function generateQrSvg(string $payload): string {
        // Use Google Chart API for QR generation (no external library needed)
        // Note: In production, you might want a local QR library
        $url = 'https://chart.googleapis.com/chart?' . http_build_query([
            'cht' => 'qr',
            'chl' => $payload,
            'chs' => '300x300',
            'chld' => 'M|2', // Medium error correction, 2px margin
        ]);
        return $url;
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

    // ============================================================
    // POST: Create UPI QR for a booking
    // ============================================================
    if ($method === 'POST' && $action === 'create_qr') {
        requireAuthWithCsrf(); // Customer must be logged in; CSRF-checked mutation

        $body = getJsonBody();
        $bookingId = (int) ($body['booking_id'] ?? 0);

        if (!$bookingId) {
            jsonError('Booking ID is required.');
        }

        // Ownership check: the booking must belong to the authenticated
        // user (by booking.user_id, or by the tourist record created
        // during guest-style booking with the user's own email).
        // NOTE: possession of a booking/payment ID is NEVER sufficient.
        $user = getCurrentUser();
        $stmt = $pdo->prepare('
            SELECT b.*, t.email, t.name
            FROM booking b
            JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE b.booking_id = ?
              AND (b.user_id = ? OR t.email = ?)
        ');
        $stmt->execute([$bookingId, $user['user_id'] ?? 0, $user['email']]);
        $booking = $stmt->fetch();

        if (!$booking) {
            jsonError('Booking not found or access denied.', 404);
        }

        // Check if booking is in a state that allows payment
        if (!in_array($booking['booking_status'], ['Pending', 'Confirmed'])) {
            jsonError('Payment not allowed for this booking status.');
        }

        // Get active UPI config
        $config = getActiveUpiConfig($pdo);
        if (!$config) {
            jsonError('UPI payment not configured. Please contact support.', 503);
        }

        // Check for existing pending payment attempt
        $stmt = $pdo->prepare('
            SELECT * FROM payment_attempt 
            WHERE booking_id = ? AND payment_status IN (\'pending_qr\', \'pending_verification\')
            ORDER BY created_at DESC LIMIT 1
        ');
        $stmt->execute([$bookingId]);
        $existingPayment = $stmt->fetch();

        if ($existingPayment) {
            // Return existing payment with QR
            $qrUrl = generateQrSvg($existingPayment['qr_payload']);
            jsonSuccess([
                'payment_id' => $existingPayment['payment_id'],
                'booking_id' => $bookingId,
                'amount_expected' => $existingPayment['amount_expected'],
                'currency' => $existingPayment['currency'],
                'merchant_name' => $existingPayment['merchant_name'],
                'upi_order_ref' => $existingPayment['upi_order_ref'],
                'qr_payload' => $existingPayment['qr_payload'],
                'qr_url' => $qrUrl,
                'payment_status' => $existingPayment['payment_status'],
                'expires_at' => $existingPayment['expires_at'],
                'message' => 'Existing payment attempt found.',
            ]);
        }

        // Create new payment attempt
        $orderRef = 'TE' . $bookingId . '_' . bin2hex(random_bytes(4)); // TE123_abc123
        $amount = (float) $booking['total_cost'];
        $note = "TravelEase Booking #{$bookingId} - {$booking['package_name']}";

        $qrPayload = generateUpiPayload($config, $orderRef, $amount, $note);
        $qrUrl = generateQrSvg($qrPayload);

        // Expiry: 30 minutes from now
        $expiresAt = date('Y-m-d H:i:s', time() + 1800);

        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare('
                INSERT INTO payment_attempt
                (booking_id, user_id, payment_method, amount_expected, currency,
                 merchant_upi_id, merchant_name, upi_order_ref, qr_payload,
                 payment_status, expires_at)
                VALUES (?, ?, \'upi_qr\', ?, \'INR\', ?, ?, ?, \'pending_qr\', ?)
            ');
            $stmt->execute([
                $bookingId,
                $user['user_id'] ?? null,
                $amount,
                $config['merchant_upi_id'],
                $config['merchant_name'],
                $orderRef,
                $qrPayload,
                $expiresAt,
            ]);
            $paymentId = (int) $pdo->lastInsertId();

            // Link payment to booking
            $pdo->prepare('UPDATE booking SET payment_id = ? WHERE booking_id = ?')
                ->execute([$paymentId, $bookingId]);

            // Log audit
            logAudit($pdo, $paymentId, $bookingId, null, 'pending_qr', 'customer', $user['user_id'] ?? null, $user['name'] ?? 'Customer');

            $pdo->commit();

            jsonSuccess([
                'payment_id' => $paymentId,
                'booking_id' => $bookingId,
                'amount_expected' => $amount,
                'currency' => 'INR',
                'merchant_name' => $config['merchant_name'],
                'upi_order_ref' => $orderRef,
                'qr_payload' => $qrPayload,
                'qr_url' => $qrUrl,
                'payment_status' => 'pending_qr',
                'expires_at' => $expiresAt,
                'message' => 'UPI QR generated. Please scan and pay.',
            ], 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ============================================================
    // GET: Get payment details (with QR)
    // ============================================================
    if ($method === 'GET' && isset($_GET['payment_id'])) {
        requireAuth();
        $paymentId = (int) $_GET['payment_id'];

        $user = getCurrentUser();
        $stmt = $pdo->prepare('
            SELECT pa.*, b.booking_id, b.total_cost, b.booking_status, t.email
            FROM payment_attempt pa
            JOIN booking b ON pa.booking_id = b.booking_id
            JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE pa.payment_id = ? AND (b.user_id = ? OR t.email = ?)
        ');
        $stmt->execute([$paymentId, $user['email'], $user['user_id'] ?? 0]);
        $payment = $stmt->fetch();

        if (!$payment) {
            jsonError('Payment not found or access denied.', 404);
        }

        $qrUrl = generateQrSvg($payment['qr_payload']);

        jsonSuccess([
            'payment_id' => $payment['payment_id'],
            'booking_id' => $payment['booking_id'],
            'amount_expected' => $payment['amount_expected'],
            'currency' => $payment['currency'],
            'merchant_name' => $payment['merchant_name'],
            'upi_order_ref' => $payment['upi_order_ref'],
            'qr_payload' => $payment['qr_payload'],
            'qr_url' => $qrUrl,
            'payment_status' => $payment['payment_status'],
            'submitted_utr' => $payment['submitted_utr'],
            'receipt_path' => $payment['receipt_path'],
            'expires_at' => $payment['expires_at'],
            'created_at' => $payment['created_at'],
        ]);
    }

    // ============================================================
    // POST: Customer submits UTR after payment
    // ============================================================
    if ($method === 'POST' && $action === 'submit_utr') {
        requireAuthWithCsrf();

        $body = getJsonBody();
        $paymentId = (int) ($body['payment_id'] ?? 0);
        $utr = trim($body['utr'] ?? '');

        if (!$paymentId || !$utr) {
            jsonError('Payment ID and UTR are required.');
        }

        // Basic UTR validation (alphanumeric, 12-22 chars typical for UPI)
        if (!preg_match('/^[A-Za-z0-9]{10,30}$/', $utr)) {
            jsonError('Invalid UTR format. Please check and re-enter.');
        }

        $user = getCurrentUser();
        $stmt = $pdo->prepare('
            SELECT pa.*, b.booking_id, t.email
            FROM payment_attempt pa
            JOIN booking b ON pa.booking_id = b.booking_id
            JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE pa.payment_id = ? AND (b.user_id = ? OR t.email = ?)
        ');
        $stmt->execute([$paymentId, $user['email'], $user['user_id'] ?? 0]);
        $payment = $stmt->fetch();

        if (!$payment) {
            jsonError('Payment not found or access denied.', 404);
        }

        if ($payment['payment_status'] !== 'pending_qr' && $payment['payment_status'] !== 'pending_verification') {
            jsonError('This payment cannot accept UTR submission.');
        }

        // Reject submissions on expired payment attempts — our verification
        // team can re-issue a QR; an expired attempt must not stay payable.
        if (!empty($payment['expires_at']) && strtotime($payment['expires_at']) < time()) {
            jsonError('This payment attempt has expired. Please start a new payment attempt.', 410);
        }

        // Check for duplicate UTR (same UTR used for different booking)
        $stmt = $pdo->prepare('
            SELECT payment_id, booking_id FROM payment_attempt 
            WHERE submitted_utr = ? AND payment_status IN (\'pending_verification\', \'verified\')
            AND payment_id != ?
        ');
        $stmt->execute([$utr, $paymentId]);
        $duplicate = $stmt->fetch();

        if ($duplicate) {
            jsonError('This UTR has already been used for another payment.', 409);
        }

        $oldStatus = $payment['payment_status'];
        $newStatus = 'pending_verification';

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE payment_attempt SET submitted_utr = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?')
                ->execute([$utr, $newStatus, $paymentId]);

            // Update booking payment_status to pending_verification
            $pdo->prepare('UPDATE booking SET payment_status = ? WHERE booking_id = ?')
                ->execute(['pending_verification', $payment['booking_id']]);

            logAudit($pdo, $paymentId, $payment['booking_id'], $oldStatus, $newStatus, 'customer', $user['user_id'] ?? null, $user['name'] ?? 'Customer', ['utr' => $utr]);

            $pdo->commit();

            jsonSuccess([
                'payment_id' => $paymentId,
                'payment_status' => $newStatus,
                'message' => 'UTR submitted. Payment is now pending verification by our team.',
            ]);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ============================================================
    // POST: Upload payment receipt (optional)
    // ============================================================
    if ($method === 'POST' && $action === 'upload_receipt') {
        requireAuthWithCsrf();

        if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
            jsonError('Receipt file is required.');
        }

        $paymentId = (int) ($_POST['payment_id'] ?? 0);
        if (!$paymentId) {
            jsonError('Payment ID is required.');
        }

        $user = getCurrentUser();
        $stmt = $pdo->prepare('
            SELECT pa.*, b.booking_id, t.email
            FROM payment_attempt pa
            JOIN booking b ON pa.booking_id = b.booking_id
            JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE pa.payment_id = ? AND (b.user_id = ? OR t.email = ?)
        ');
        $stmt->execute([$paymentId, $user['email'], $user['user_id'] ?? 0]);
        $payment = $stmt->fetch();

        if (!$payment) {
            jsonError('Payment not found or access denied.', 404);
        }

        // Validate file
        $file = $_FILES['receipt'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        $extByMime = [
            'image/jpeg'      => ['jpg', 'jpeg'],
            'image/png'       => ['png'],
            'image/webp'      => ['webp'],
            'application/pdf' => ['pdf'],
        ];
        $maxSize = 5 * 1024 * 1024; // 5MB

        // NEVER trust $_FILES['type'] (client-controlled). Sniff the real bytes.
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if (!$finfo) {
            jsonError('Server could not validate the file.', 500);
        }
        $mimeType = @finfo_file($finfo, $file['tmp_name']) ?: '';
        @finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes, true)) {
            jsonError('Invalid file type. Allowed: JPEG, PNG, WebP, PDF.');
        }

        // Extension must match the detected content type
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExts = $extByMime[$mimeType];
        if (!in_array($ext, $allowedExts, true)) {
            jsonError('File extension does not match the actual file type.');
        }

        if ($file['size'] > $maxSize) {
            jsonError('File too large. Maximum 5MB.');
        }

        // Secure filename (never derived from user input except validated extension)
        $safeName = 'receipt_' . $paymentId . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $uploadDir = dirname(__DIR__, 2) . '/storage/payment_receipts';
        
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $destPath = $uploadDir . '/' . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            jsonError('Failed to save receipt.');
        }

        // Store relative path
        $relativePath = 'storage/payment_receipts/' . $safeName;
        $pdo->prepare('UPDATE payment_attempt SET receipt_path = ? WHERE payment_id = ?')
            ->execute([$relativePath, $paymentId]);

        logAudit($pdo, $paymentId, $payment['booking_id'], $payment['payment_status'], $payment['payment_status'], 'customer', $user['user_id'] ?? null, $user['name'] ?? 'Customer', ['receipt_uploaded' => $relativePath]);

        jsonSuccess([
            'receipt_path' => $relativePath,
            'message' => 'Receipt uploaded successfully.',
        ]);
    }

    // ============================================================
    // POST: Cancel payment attempt (customer)
    // ============================================================
    if ($method === 'POST' && $action === 'cancel') {
        requireAuthWithCsrf();

        $body = getJsonBody();
        $paymentId = (int) ($body['payment_id'] ?? 0);

        if (!$paymentId) {
            jsonError('Payment ID is required.');
        }

        $user = getCurrentUser();
        $stmt = $pdo->prepare('
            SELECT pa.*, b.booking_id, t.email
            FROM payment_attempt pa
            JOIN booking b ON pa.booking_id = b.booking_id
            JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE pa.payment_id = ? AND (b.user_id = ? OR t.email = ?)
        ');
        $stmt->execute([$paymentId, $user['email'], $user['user_id'] ?? 0]);
        $payment = $stmt->fetch();

        if (!$payment) {
            jsonError('Payment not found or access denied.', 404);
        }

        if (!in_array($payment['payment_status'], ['pending_qr', 'pending_verification'])) {
            jsonError('Cannot cancel payment in current status.');
        }

        $oldStatus = $payment['payment_status'];
        $newStatus = 'cancelled';

        $pdo->prepare('UPDATE payment_attempt SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?')
            ->execute([$newStatus, $paymentId]);

        logAudit($pdo, $paymentId, $payment['booking_id'], $oldStatus, $newStatus, 'customer', $user['user_id'] ?? null, $user['name'] ?? 'Customer');

        jsonSuccess(['message' => 'Payment attempt cancelled.']);
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('[TravelEase DB] UPI Payment error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
} catch (Exception $e) {
    error_log('[TravelEase] UPI Payment error: ' . $e->getMessage());
    jsonError($e->getMessage(), 500);
}