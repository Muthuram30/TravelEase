<?php
// ============================================================
// GET /api/admin/dashboard.php
// Admin Dashboard Statistics
// Aggregates: COUNT, SUM, GROUP BY across booking/tourist/package
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

    // ---- SQL AGGREGATE QUERIES: COUNT() and SUM() ----

    // Total tourists
    $totalTourists = (int) $pdo->query('SELECT COUNT(*) FROM tourist')->fetchColumn();

    // Total packages
    $totalPackages = (int) $pdo->query('SELECT COUNT(*) FROM tour_package')->fetchColumn();

    // Total bookings
    $totalBookings = (int) $pdo->query('SELECT COUNT(*) FROM booking')->fetchColumn();

    // Booking status breakdown
    $statusCounts = $pdo->query('
        SELECT booking_status, COUNT(*) AS cnt
        FROM booking
        GROUP BY booking_status
    ')->fetchAll();

    $statusMap = ['Pending' => 0, 'Confirmed' => 0, 'Cancelled' => 0, 'Rejected' => 0];
    foreach ($statusCounts as $row) {
        $statusMap[$row['booking_status']] = (int) $row['cnt'];
    }

    // Total revenue from confirmed AND paid bookings.
    // A confirmed-but-unpaid booking (e.g. Pay Later) is never collected revenue.
    $totalRevenue = (float) $pdo->query('
        SELECT COALESCE(SUM(total_cost), 0)
        FROM booking
        WHERE booking_status = \'Confirmed\'
          AND payment_status = \'paid\'
    ')->fetchColumn();

    // ---- Next client to assist (oldest pending booking) ----
    $stmt = $pdo->prepare('
        SELECT
            b.booking_id,
            b.booking_date,
            b.travel_date,
            b.number_of_persons,
            b.total_cost,
            b.booking_status,
            b.created_at,
            t.name   AS customer_name,
            t.email  AS customer_email,
            t.phone  AS customer_phone,
            p.package_name,
            p.destination
        FROM booking b
        JOIN tourist      t ON b.tourist_id = t.tourist_id
        JOIN tour_package p ON b.package_id = p.package_id
        WHERE b.booking_status = \'Pending\'
        ORDER BY b.created_at ASC
        LIMIT 1
    ');
    $stmt->execute();
    $nextClient = $stmt->fetch() ?: null;

    // ---- Revenue by destination (GROUP BY demo) ----
    $revenueByDestination = $pdo->query('
        SELECT
            p.destination,
            COUNT(b.booking_id)  AS total_bookings,
            SUM(b.total_cost)    AS total_revenue
        FROM booking b
        JOIN tour_package p ON b.package_id = p.package_id
        WHERE b.booking_status = \'Confirmed\'
          AND b.payment_status = \'paid\'
        GROUP BY p.destination
        ORDER BY total_revenue DESC
        LIMIT 5
    ')->fetchAll();

    // ---- Recent bookings (last 5) ----
    $recentBookings = $pdo->query('
        SELECT
            b.booking_id,
            b.booking_date,
            b.booking_status,
            b.total_cost,
            t.name        AS customer_name,
            p.package_name,
            p.destination
        FROM booking b
        JOIN tourist      t ON b.tourist_id = t.tourist_id
        JOIN tour_package p ON b.package_id = p.package_id
        ORDER BY b.booking_id DESC
        LIMIT 5
    ')->fetchAll();

    jsonSuccess([
        'total_tourists'        => $totalTourists,
        'total_packages'        => $totalPackages,
        'total_bookings'        => $totalBookings,
        'pending_bookings'      => $statusMap['Pending'],
        'confirmed_bookings'    => $statusMap['Confirmed'],
        'cancelled_bookings'    => $statusMap['Cancelled'],
        'rejected_bookings'     => $statusMap['Rejected'],
        'total_revenue'         => $totalRevenue,
        'next_client'           => $nextClient,
        'revenue_by_destination'=> $revenueByDestination,
        'recent_bookings'       => $recentBookings,
    ]);

} catch (PDOException $e) {
    error_log('[TravelEase DB] Dashboard error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
