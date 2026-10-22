<?php
// ============================================================
// Admin Booking Management API
// GET    /api/bookings/admin.php               → list bookings (with search/filter)
// GET    /api/bookings/admin.php?id=N          → single booking details
// POST   /api/bookings/admin.php?action=confirm&id=N  (requires CSRF)
// POST   /api/bookings/admin.php?action=cancel&id=N   (requires CSRF)
// POST   /api/bookings/admin.php?action=reject&id=N   (requires CSRF)
// DELETE /api/bookings/admin.php?id=N          (requires CSRF)
// ============================================================

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

// ---- HELPER: full booking JOIN query ----
function fetchBookingById(PDO $pdo, int $id): ?array {
    $stmt = $pdo->prepare('
        SELECT
            b.booking_id,
            b.booking_date,
            b.travel_date,
            b.number_of_persons,
            b.total_cost,
            b.booking_status,
            b.created_at,
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
        WHERE b.booking_id = ?
    ');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
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
        $search = trim($_GET['search'] ?? '');
        $status = trim($_GET['status'] ?? '');

        // SQL QUERY: 3-table JOIN — complete booking info
        $sql    = '
            SELECT
                b.booking_id,
                b.booking_date,
                b.travel_date,
                b.number_of_persons,
                b.total_cost,
                b.booking_status,
                b.created_at,
                t.name        AS customer_name,
                t.email       AS customer_email,
                t.phone       AS customer_phone,
                p.package_name,
                p.destination
            FROM booking b
            JOIN tourist      t ON b.tourist_id = t.tourist_id
            JOIN tour_package p ON b.package_id = p.package_id
            WHERE 1=1
        ';
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

        $sql .= ' ORDER BY b.booking_id DESC';

        $stmt     = $pdo->prepare($sql);
        $stmt->execute($params);
        $bookings = $stmt->fetchAll();

        jsonSuccess($bookings);
    }

    // ---- POST: status change actions ----
    if ($method === 'POST') {
        $action = trim($_GET['action'] ?? '');
        $id     = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Booking ID is required.');

        $pdo->beginTransaction();

        $booking = fetchBookingById($pdo, $id);
        if (!$booking) {
            $pdo->rollBack();
            jsonError('Booking not found.', 404);
        }

        $currentStatus = $booking['booking_status'];

        // ---- CONFIRM ----
        if ($action === 'confirm') {
            if ($currentStatus !== 'Pending') {
                $pdo->rollBack();
                jsonError('Only Pending bookings can be confirmed.');
            }

            // Check availability
            $availStmt = $pdo->prepare('SELECT availability FROM tour_package WHERE package_id = ?');
            $availStmt->execute([$booking['package_id']]);
            $pkg = $availStmt->fetch();

            if ($pkg['availability'] < $booking['number_of_persons']) {
                $pdo->rollBack();
                jsonError('Not enough availability to confirm this booking.', 409);
            }

            $pdo->prepare('UPDATE booking SET booking_status = ? WHERE booking_id = ?')
                ->execute(['Confirmed', $id]);
            $pdo->prepare('UPDATE tour_package SET availability = availability - ? WHERE package_id = ?')
                ->execute([$booking['number_of_persons'], $booking['package_id']]);

            $pdo->commit();
            jsonSuccess(['message' => "Booking #$id confirmed."]);
        }

        // ---- CANCEL ----
        if ($action === 'cancel') {
            if ($currentStatus === 'Cancelled') {
                $pdo->rollBack();
                jsonError('Booking is already cancelled.');
            }

            // If was confirmed, restore availability
            if ($currentStatus === 'Confirmed') {
                $pdo->prepare('UPDATE tour_package SET availability = availability + ? WHERE package_id = ?')
                    ->execute([$booking['number_of_persons'], $booking['package_id']]);
            }

            $pdo->prepare('UPDATE booking SET booking_status = ? WHERE booking_id = ?')
                ->execute(['Cancelled', $id]);

            $pdo->commit();
            jsonSuccess(['message' => "Booking #$id cancelled. Availability restored."]);
        }

        // ---- REJECT ----
        if ($action === 'reject') {
            if ($currentStatus !== 'Pending') {
                $pdo->rollBack();
                jsonError('Only Pending bookings can be rejected.');
            }

            $pdo->prepare('UPDATE booking SET booking_status = ? WHERE booking_id = ?')
                ->execute(['Rejected', $id]);

            $pdo->commit();
            jsonSuccess(['message' => "Booking #$id rejected."]);
        }

        $pdo->rollBack();
        jsonError('Unknown action.', 400);
    }

    // ---- DELETE ----
    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Booking ID is required.');

        // If confirmed, restore availability before deletion
        $booking = fetchBookingById($pdo, $id);
        if (!$booking) jsonError('Booking not found.', 404);

        $pdo->beginTransaction();

        if ($booking['booking_status'] === 'Confirmed') {
            $pdo->prepare('UPDATE tour_package SET availability = availability + ? WHERE package_id = ?')
                ->execute([$booking['number_of_persons'], $booking['package_id']]);
        }

        $pdo->prepare('DELETE FROM booking WHERE booking_id = ?')->execute([$id]);
        $pdo->commit();

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
