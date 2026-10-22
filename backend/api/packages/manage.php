<?php
// ============================================================
// Admin Package CRUD
// POST   /api/packages/manage.php          → create
// PUT    /api/packages/manage.php?id=N     → update
// DELETE /api/packages/manage.php?id=N     → delete
// 
// Security: Requires admin session + CSRF token validation
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
requireAdminSessionWithCsrf(); // Enforces both session and CSRF

$method = $_SERVER['REQUEST_METHOD'];

// ---- Sanitise & validate shared fields ----
function validatePackageBody(array $body): array {
    $name         = trim($body['package_name'] ?? '');
    $destination  = trim($body['destination']   ?? '');
    $duration     = (int) ($body['duration']     ?? 0);
    $cost         = (float) ($body['cost']       ?? 0);
    $availability = (int) ($body['availability'] ?? 0);

    $errors = [];
    if (!$name)         $errors[] = 'Package name is required.';
    if (!$destination)  $errors[] = 'Destination is required.';
    if ($duration <= 0) $errors[] = 'Duration must be a positive integer.';
    if ($cost <= 0)     $errors[] = 'Cost must be a positive number.';
    if ($availability < 0) $errors[] = 'Availability cannot be negative.';

    return compact('name', 'destination', 'duration', 'cost', 'availability', 'errors');
}

try {
    $pdo  = getDbConnection();
    $body = getJsonBody();

    // CREATE
    if ($method === 'POST') {
        $v = validatePackageBody($body);
        if ($v['errors']) jsonError(implode(' ', $v['errors']));

        $stmt = $pdo->prepare(
            'INSERT INTO tour_package (package_name, destination, duration, cost, availability)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$v['name'], $v['destination'], $v['duration'], $v['cost'], $v['availability']]);
        $newId  = (int) $pdo->lastInsertId();
        $fetch  = $pdo->prepare('SELECT * FROM tour_package WHERE package_id = ?');
        $fetch->execute([$newId]);
        $pkg    = $fetch->fetch();
        jsonSuccess($pkg, 201);
    }

    // UPDATE
    if ($method === 'PUT') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Package ID is required.');

        // Check if package exists first
        $checkStmt = $pdo->prepare('SELECT package_id FROM tour_package WHERE package_id = ?');
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            jsonError('Package not found.', 404);
        }

        $v = validatePackageBody($body);
        if ($v['errors']) jsonError(implode(' ', $v['errors']));

        $stmt = $pdo->prepare(
            'UPDATE tour_package SET package_name=?, destination=?, duration=?, cost=?, availability=?
             WHERE package_id=?'
        );
        $stmt->execute([$v['name'], $v['destination'], $v['duration'], $v['cost'], $v['availability'], $id]);

        // Return updated package (rowCount may be 0 if no fields changed, which is valid)
        $fetch = $pdo->prepare('SELECT * FROM tour_package WHERE package_id = ?');
        $fetch->execute([$id]);
        $pkg   = $fetch->fetch();
        jsonSuccess($pkg);
    }

    // DELETE
    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Package ID is required.');

        try {
            $stmt = $pdo->prepare('DELETE FROM tour_package WHERE package_id = ?');
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) jsonError('Package not found.', 404);
            jsonSuccess(['message' => 'Package deleted successfully.']);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                jsonError('Cannot delete this package. It has existing bookings.', 409);
            }
            throw $e;
        }
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('[TravelEase DB] Package manage error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
