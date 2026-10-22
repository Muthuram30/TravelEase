<?php
// ============================================================
// Public Booking Endpoints
// POST /api/bookings/index.php                     → create booking
// GET  /api/bookings/index.php?token=X&email=Y     → check status by token (NEW secure)
// GET  /api/bookings/index.php?booking_id=N&email=Y → check status by ID (deprecated)
// GET  /api/bookings/index.php?confirm_id=N        → confirmation page data
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

// Creating a booking always requires a signed-in customer,
// and mutations require a valid CSRF token (X-CSRF-Token header).
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    startSession();
    if (empty($_SESSION['user_id'])) {
        jsonError('Please log in or sign up before booking.', 401);
    }
    validateCsrfToken();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    
    // NEW: Status check by confirmation token (secure method)
    if (!empty($_GET['token']) && !empty($_GET['email'])) {
        $token = trim($_GET['token']);
        $email = trim($_GET['email']);
        
        try {
            $pdo = getDbConnection();
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
                    b.special_requests,
                    b.created_at,
                    t.name        AS customer_name,
                    t.email       AS customer_email,
                    t.phone       AS customer_phone,
                    p.package_name,
                    p.destination,
                    p.duration,
                    p.cost        AS package_cost
                FROM booking b
                JOIN tourist      t ON b.tourist_id = t.tourist_id
                JOIN tour_package p ON b.package_id = p.package_id
                WHERE b.confirmation_token = ? AND t.email = ?
            ');
            $stmt->execute([$token, $email]);
            $booking = $stmt->fetch();
            
            if (!$booking) {
                jsonError('No booking found with this token and email.', 404);
            }
            
            jsonSuccess($booking);
            
        } catch (PDOException $e) {
            error_log('[TravelEase DB] Token status check error: ' . $e->getMessage());
            jsonError('Database error. Please try again.', 500);
        }
    }
    
    // DEPRECATED: Status check by booking_id (kept for backward compatibility)
    if (!empty($_GET['booking_id']) && !empty($_GET['email'])) {
        $bookingId = (int) $_GET['booking_id'];
        $email     = trim($_GET['email']);

        try {
            $pdo  = getDbConnection();
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
                    b.special_requests,
                    b.created_at,
                    t.name        AS customer_name,
                    t.email       AS customer_email,
                    t.phone       AS customer_phone,
                    p.package_name,
                    p.destination,
                    p.duration,
                    p.cost        AS package_cost
                FROM booking b
                JOIN tourist      t ON b.tourist_id = t.tourist_id
                JOIN tour_package p ON b.package_id = p.package_id
                WHERE b.booking_id = ? AND t.email = ?
            ');
            $stmt->execute([$bookingId, $email]);
            $booking = $stmt->fetch();

            if (!$booking) {
                jsonError('No booking found with this ID and email.', 404);
            }

            jsonSuccess($booking);

        } catch (PDOException $e) {
            error_log('[TravelEase DB] Status check error: ' . $e->getMessage());
            jsonError('Database error. Please try again.', 500);
        }
    }
    
    // Confirmation page by token
    if (!empty($_GET['confirm_token'])) {
        $token = trim($_GET['confirm_token']);
        
        try {
            $pdo  = getDbConnection();
            $stmt = $pdo->prepare('
                SELECT
                    b.*,
                    t.name        AS customer_name,
                    t.email       AS customer_email,
                    t.phone       AS customer_phone,
                    p.package_name,
                    p.destination,
                    p.duration,
                    p.cost        AS package_cost
                FROM booking b
                JOIN tourist      t ON b.tourist_id = t.tourist_id
                JOIN tour_package p ON b.package_id = p.package_id
                WHERE b.confirmation_token = ?
            ');
            $stmt->execute([$token]);
            $booking = $stmt->fetch();

            if (!$booking) {
                jsonError('Booking not found.', 404);
            }

            jsonSuccess($booking);

        } catch (PDOException $e) {
            error_log('[TravelEase DB] Confirmation error: ' . $e->getMessage());
            jsonError('Database error. Please try again.', 500);
        }
    }

    // OLD: Confirmation page by booking_id (deprecated but kept)
    if (!empty($_GET['confirm_id'])) {
        $id = (int) $_GET['confirm_id'];

        try {
            $pdo  = getDbConnection();
            $stmt = $pdo->prepare('
                SELECT
                    b.*,
                    t.name        AS customer_name,
                    t.email       AS customer_email,
                    t.phone       AS customer_phone,
                    p.package_name,
                    p.destination,
                    p.duration,
                    p.cost        AS package_cost
                FROM booking b
                JOIN tourist      t ON b.tourist_id = t.tourist_id
                JOIN tour_package p ON b.package_id = p.package_id
                WHERE b.booking_id = ?
            ');
            $stmt->execute([$id]);
            $booking = $stmt->fetch();

            if (!$booking) {
                jsonError('Booking not found.', 404);
            }

            jsonSuccess($booking);

        } catch (PDOException $e) {
            error_log('[TravelEase DB] Confirmation error: ' . $e->getMessage());
            jsonError('Database error. Please try again.', 500);
        }
    }
} // end GET block

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create a new customer booking
    $body = getJsonBody();

    $customerName    = trim($body['customer_name']    ?? '');
    $customerEmail   = trim($body['customer_email']   ?? '');
    $customerPhone   = trim($body['customer_phone']   ?? '');
    $customerAddress = trim($body['customer_address'] ?? '');
    $packageId       = (int) ($body['package_id']     ?? 0);
    $bookingDate     = trim($body['booking_date']      ?? '');
    $travelDate      = trim($body['travel_date']       ?? '');
    $numPersons      = (int) ($body['number_of_persons'] ?? 0);
    $payLater        = (bool) ($body['pay_later'] ?? false);
    $idempotencyKey  = trim((string) ($body['idempotency_key'] ?? ''));

    // Validation
    if (!$customerName)  jsonError('Customer name is required.');
    if (!$customerPhone) jsonError('Phone number is required.');
    if (!$packageId)     jsonError('Please select a tour package.');
    if (!$bookingDate)   jsonError('Booking date is required.');
    if ($numPersons <= 0) jsonError('Number of persons must be at least 1.');

    // travel_date validation — not required but if provided must be valid date
    if ($travelDate && !strtotime($travelDate)) {
        jsonError('Travel date is invalid.');
    }

    if ($idempotencyKey !== '' && !preg_match('/^[A-Za-z0-9\-_]{8,64}$/', $idempotencyKey)) {
        jsonError('Invalid request identifier.');
    }

    try {
        $pdo = getDbConnection();
        $pdo->beginTransaction();

        // ---- Duplicate-booking guard: reuse the booking for a repeated submit ----
        if ($idempotencyKey !== '') {
            $dupStmt = $pdo->prepare('
                SELECT b.booking_id, b.confirmation_token, b.total_cost, b.booking_status,
                       b.payment_status, p.package_name, p.destination
                FROM booking b
                JOIN tour_package p ON b.package_id = p.package_id
                WHERE b.idempotency_key = ?
                LIMIT 1
            ');
            $dupStmt->execute([$idempotencyKey]);
            $existingBooking = $dupStmt->fetch();
            if ($existingBooking) {
                $pdo->commit();
                jsonSuccess([
                    'booking_id'         => (int) $existingBooking['booking_id'],
                    'confirmation_token' => $existingBooking['confirmation_token'],
                    'total_cost'         => (float) $existingBooking['total_cost'],
                    'package_name'       => $existingBooking['package_name'],
                    'destination'        => $existingBooking['destination'],
                    'booking_status'     => $existingBooking['booking_status'],
                    'payment_status'     => $existingBooking['payment_status'],
                    'pay_later'          => $payLater,
                    'reused'             => true,
                ], 200);
            }
        }

        // ---- Verify package exists ----
        $stmt = $pdo->prepare(
            'SELECT package_id, package_name, destination, cost, availability FROM tour_package WHERE package_id = ?'
        );
        $stmt->execute([$packageId]);
        $package = $stmt->fetch();

        if (!$package) {
            $pdo->rollBack();
            jsonError('Selected tour package not found.', 404);
        }

        // ---- Admin-deactivated packages cannot be newly booked ----
        // (existing bookings are untouched; only new bookings are blocked).
        // is_active ships with the base schema (migration 001); if a very old
        // database is missing it, the catch below simply skips the check
        // instead of breaking booking creation.
        try {
            $activeStmt = $pdo->prepare('SELECT is_active FROM tour_package WHERE package_id = ?');
            $activeStmt->execute([$packageId]);
            $activeRow = $activeStmt->fetch(PDO::FETCH_ASSOC);
            if ($activeRow && (int) $activeRow['is_active'] === 0) {
                $pdo->rollBack();
                jsonError('This package is currently not accepting new bookings. Please choose another package.', 409);
            }
        } catch (PDOException $e) {
            // Legacy schema without is_active — allow booking as before.
        }

        if ($numPersons > $package['availability']) {
            $pdo->rollBack();
            jsonError(
                "Not enough slots available. Available: {$package['availability']}, Requested: $numPersons.",
                409
            );
        }

        // ---- Check booking limits for free users ----
        $userId = $_SESSION['user_id'];
        $bookingLimits = getBookingLimits($pdo, $userId);
        
        if (!$bookingLimits['can_book']) {
            $pdo->rollBack();
            jsonError(
                "You have reached your monthly booking limit ({$bookingLimits['limit']} bookings). Upgrade to premium for unlimited bookings.",
                403
            );
        }

        // ---- Server-side total cost calculation (NEVER trust frontend price) ----
        $totalCost = round($package['cost'] * $numPersons, 2);

        // ---- Find or create tourist ----
        // ---- Find or create tourist ----
        $touristId = null;

        if ($customerEmail) {
            $s = $pdo->prepare('SELECT tourist_id FROM tourist WHERE email = ?');
            $s->execute([$customerEmail]);
            $row = $s->fetch();
            if ($row) $touristId = $row['tourist_id'];
        }

        // Only check by phone if no tourist found by email
        if (!$touristId && $customerPhone) {
            $s = $pdo->prepare('SELECT tourist_id FROM tourist WHERE phone = ?');
            $s->execute([$customerPhone]);
            $row = $s->fetch();
            // Only use phone match if the email also matches or no email was provided
            if ($row && (!$customerEmail || $row['email'] === $customerEmail)) {
                $touristId = $row['tourist_id'];
            }
        }

        if (!$touristId) {
            $s = $pdo->prepare(
                'INSERT INTO tourist (name, phone, email, address) VALUES (?, ?, ?, ?)'
            );
            $s->execute([
                $customerName,
                $customerPhone,
                $customerEmail ?: null,
                $customerAddress ?: null,
            ]);
            $touristId = (int) $pdo->lastInsertId();
        }

        // ---- Detect which optional columns exist in booking table ----
        $colCheckStmt = $pdo->query("
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'booking'
            AND COLUMN_NAME IN ('travel_date', 'user_id', 'payment_status', 'idempotency_key')
        ");
        $existingCols = $colCheckStmt->fetchAll(PDO::FETCH_COLUMN);
        $hasTravelDate = in_array('travel_date', $existingCols);
        $hasUserIdCol  = in_array('user_id', $existingCols);
        $hasPaymentStatus = in_array('payment_status', $existingCols);
        $hasIdempotencyKey = in_array('idempotency_key', $existingCols);

        // ---- Build INSERT dynamically based on existing columns ----
        $insertCols = ['tourist_id', 'package_id', 'booking_date', 'number_of_persons', 'total_cost', 'booking_status'];
        $insertVals = [$touristId, $packageId, $bookingDate, $numPersons, $totalCost, 'Pending'];

        if ($hasTravelDate) {
            $effectiveTravelDate = ($travelDate && strtotime($travelDate)) ? $travelDate : $bookingDate;
            $insertCols[] = 'travel_date';
            $insertVals[] = $effectiveTravelDate;
        }

        if ($hasUserIdCol) {
            $insertCols[] = 'user_id';
            $insertVals[] = $_SESSION['user_id'];
        }

        // Payment state is tracked separately from booking state. Both Pay Now
        // and Pay Later start unpaid; only an admin-verified payment can flip it.
        if ($hasPaymentStatus) {
            $insertCols[] = 'payment_status';
            $insertVals[] = 'pending';
        }

        if ($hasIdempotencyKey && $idempotencyKey !== '') {
            $insertCols[] = 'idempotency_key';
            $insertVals[] = $idempotencyKey;
        }

        $placeholders = implode(', ', array_fill(0, count($insertCols), '?'));
        $colList = implode(', ', $insertCols);
        $stmt = $pdo->prepare("INSERT INTO booking ($colList) VALUES ($placeholders)");
        $stmt->execute($insertVals);
        $bookingId = (int) $pdo->lastInsertId();
        
        // ---- Generate cryptographic confirmation token ----
        $confirmationToken = bin2hex(random_bytes(64)); // 128 characters
        
        $tokenStmt = $pdo->prepare('UPDATE booking SET confirmation_token = ? WHERE booking_id = ?');
        $tokenStmt->execute([$confirmationToken, $bookingId]);

        // Persist the destination theme for this authenticated customer.
        $destination = strtolower($package['destination'] ?? '');
        $theme = 'neutral-fallback';
        if (preg_match('/kerala|munnar|wayanad|alleppey|alappuzha|kochi/', $destination)) $theme = 'monsoon-forest';
        elseif (preg_match('/goa|kovalam|varkala|andaman|lakshadweep|beach|coast/', $destination)) $theme = 'coastal-sea';
        elseif (preg_match('/manali|ladakh|gulmarg|spiti|kashmir/', $destination)) $theme = 'alpine-snow';
        // Try to update theme – gracefully handle if users table doesn't exist
        try {
            $themeStmt = $pdo->prepare('UPDATE users SET theme_preference = ? WHERE user_id = ?');
            $themeStmt->execute([$theme, $_SESSION['user_id']]);
        } catch (Exception $ignored) {}
        $_SESSION['theme_preference'] = $theme;

        // NOTE: Availability is reduced only when admin CONFIRMS.
        // Pending bookings do not reduce availability.

        $pdo->commit();

        jsonSuccess([
            'booking_id'          => $bookingId,
            'confirmation_token'  => $confirmationToken,  // NEW: Use this for status lookups
            'total_cost'          => $totalCost,
            'package_name'        => $package['package_name'],
            'destination'         => $package['destination'],
            'booking_status'      => 'Pending',
            'payment_status'      => 'pending',
            'pay_later'           => $payLater,
            'reused'              => false,
        ], 201);

    } catch (PDOException $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        // Unique idempotency key race: another request already stored the booking.
        if ($e->getCode() === '23000' && $idempotencyKey !== '') {
            try {
                $dupStmt = $pdo->prepare('
                    SELECT b.booking_id, b.confirmation_token, b.total_cost, b.booking_status,
                           b.payment_status, p.package_name, p.destination
                    FROM booking b
                    JOIN tour_package p ON b.package_id = p.package_id
                    WHERE b.idempotency_key = ?
                    LIMIT 1
                ');
                $dupStmt->execute([$idempotencyKey]);
                $existingBooking = $dupStmt->fetch();
                if ($existingBooking) {
                    jsonSuccess([
                        'booking_id'         => (int) $existingBooking['booking_id'],
                        'confirmation_token' => $existingBooking['confirmation_token'],
                        'total_cost'         => (float) $existingBooking['total_cost'],
                        'package_name'       => $existingBooking['package_name'],
                        'destination'        => $existingBooking['destination'],
                        'booking_status'     => $existingBooking['booking_status'],
                        'payment_status'     => $existingBooking['payment_status'],
                        'pay_later'          => $payLater,
                        'reused'             => true,
                    ], 200);
                }
            } catch (PDOException $ignored) {}
        }

        error_log('[TravelEase DB] Create booking error: ' . $e->getMessage());
        jsonError('Database error. Please try again.', 500);
    }
}

jsonError('Method not allowed', 405);