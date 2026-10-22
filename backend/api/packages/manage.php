<?php
// ============================================================
// Admin Package CRUD
// POST   /api/packages/manage.php          → create (requires CSRF)
// PUT    /api/packages/manage.php?id=N     → update / activate / deactivate (requires CSRF)
// DELETE /api/packages/manage.php?id=N     → delete (requires CSRF, hard-delete
//                                            only when the package has no
//                                            booking/payment history)
// 
// Security: Requires admin session + CSRF token validation
// Deactivate-vs-delete: packages with booking or payment history are
// NEVER hard-deleted — set is_active = FALSE instead (PUT). Deactivated
// packages keep their booking history but cannot be newly booked.
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
requireAdminSessionWithCsrf(); // Enforces both session and CSRF

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDbConnection();
    $body = getJsonBody();

    // ---- Detect which optional tour_package columns exist (001/010/011 migrations) ----
    $colStmt = $pdo->query("
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tour_package'
    ");
    $pkgCols = $colStmt->fetchAll(PDO::FETCH_COLUMN);
    $hasDescription = in_array('description', $pkgCols, true);
    $hasIsActive    = in_array('is_active', $pkgCols, true);
    $hasCoverImg    = in_array('cover_image_url', $pkgCols, true);

    // ---- Sanitise & validate shared fields ----
    function validatePackageBody(array $body): array {
        $name         = trim($body['package_name'] ?? '');
        $destination  = trim($body['destination']   ?? '');
        $duration     = (int) ($body['duration']     ?? 0);
        $cost         = (float) ($body['cost']       ?? 0);
        $availability = (int) ($body['availability'] ?? 0);
        $description  = trim($body['description']    ?? '');
        $coverImage   = trim($body['cover_image_url'] ?? '');
        $isActive     = $body['is_active'] ?? null;

        $errors = [];
        if (!$name)            $errors[] = 'Package name is required.';
        if (mb_strlen($name) > 100)    $errors[] = 'Package name must be at most 100 characters.';
        if (!$destination)     $errors[] = 'Destination is required.';
        if (mb_strlen($destination) > 100) $errors[] = 'Destination must be at most 100 characters.';
        if ($duration <= 0 || $duration > 365) $errors[] = 'Duration must be a positive integer (1–365 days).';
        if ($cost <= 0 || $cost > 99999999)    $errors[] = 'Cost must be a positive number.';
        if ($availability < 0 || $availability > 1000000) $errors[] = 'Availability cannot be negative.';
        if (mb_strlen($description) > 10000) $errors[] = 'Description is too long (max 10,000 characters).';
        // cover_image_url is validated against existing historical values' shape (VARCHAR 500)
        if ($coverImage !== '' && (strlen($coverImage) > 500 || !preg_match('#^(https?://|/|\.\./)#i', $coverImage))) {
            $errors[] = 'Cover image URL must be a valid HTTP(S) URL or a relative path.';
        }

        return compact('name', 'destination', 'duration', 'cost', 'availability', 'description', 'coverImage', 'isActive', 'errors');
    }

    // ---- Build the column list + values shared by CREATE and UPDATE ----
    function buildPackageColumns(array $v, bool $hasDescription, bool $hasIsActive, bool $hasCoverImg): array {
        $cols = ['package_name', 'destination', 'duration', 'cost', 'availability'];
        $vals = [$v['name'], $v['destination'], $v['duration'], $v['cost'], $v['availability']];

        if ($hasDescription) { $cols[] = 'description'; $vals[] = $v['description'] ?: null; }
        if ($hasCoverImg)    { $cols[] = 'cover_image_url'; $vals[] = $v['coverImage'] ?: null; }
        if ($hasIsActive && $v['isActive'] !== null) { $cols[] = 'is_active'; $vals[] = (int) filter_var($v['isActive'], FILTER_VALIDATE_BOOLEAN); }

        return [$cols, $vals];
    }

    // ---- CREATE ----
    if ($method === 'POST') {
        $v = validatePackageBody($body);
        if ($v['errors']) jsonError(implode(' ', $v['errors']));

        [$cols, $vals] = buildPackageColumns($v, $hasDescription, $hasIsActive, $hasCoverImg);

        $stmt = $pdo->prepare(
            'INSERT INTO tour_package (' . implode(', ', $cols) . ')
             VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')'
        );
        $stmt->execute($vals);
        $newId  = (int) $pdo->lastInsertId();
        $fetch  = $pdo->prepare('SELECT * FROM tour_package WHERE package_id = ?');
        $fetch->execute([$newId]);
        $pkg    = $fetch->fetch();

        logAdminAction($pdo, 'package_create', 'package', $newId, [
            'package_name' => $v['name'],
            'destination'  => $v['destination'],
        ], null, "package_id=$newId");

        jsonSuccess($pkg, 201);
    }

    // ---- UPDATE (including activate / deactivate) ----
    if ($method === 'PUT') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Package ID is required.');

        $checkStmt = $pdo->prepare('SELECT * FROM tour_package WHERE package_id = ?');
        $checkStmt->execute([$id]);
        $existing = $checkStmt->fetch();
        if (!$existing) {
            jsonError('Package not found.', 404);
        }

        // Support PUT ?action=activate|deactivate so the archive workflow
        // never requires sending the whole field set.
        $action = trim($_GET['action'] ?? '');
        if ($action === 'activate' || $action === 'deactivate') {
            if (!$hasIsActive) {
                jsonError('This database does not support package deactivation (is_active column missing). Run database/migrations to upgrade the schema.', 409);
            }
            $newState = $action === 'activate';

            if ((bool) $existing['is_active'] === $newState) {
                jsonSuccess([
                    'message' => $action === 'activate' ? 'Package is already active.' : 'Package is already deactivated.',
                    'package' => $existing,
                    'already_in_state' => true,
                ]);
            }

            $pdo->prepare('UPDATE tour_package SET is_active = ? WHERE package_id = ?')
                ->execute([(int) $newState, $id]);
            $fetch = $pdo->prepare('SELECT * FROM tour_package WHERE package_id = ?');
            $fetch->execute([$id]);
            $pkg = $fetch->fetch();

            logAdminAction($pdo, $action === 'activate' ? 'package_activate' : 'package_deactivate', 'package', $id, [
                'package_name' => $existing['package_name'],
                'note' => $action === 'activate'
                    ? 'Package re-activated and bookable again'
                    : 'Package deactivated — hidden from public listing; bookable stopping; existing bookings preserved',
            ], 'active', $newState ? 'active' : 'inactive');

            jsonSuccess([
                'message' => $action === 'activate'
                    ? 'Package activated. It is visible in the public listing and can be booked again.'
                    : 'Package deactivated. It no longer appears in the public listing and cannot be newly booked. Existing bookings are preserved.',
                'package' => $pkg,
            ]);
        }

        $v = validatePackageBody($body);
        if ($v['errors']) jsonError(implode(' ', $v['errors']));

        [$cols, $vals] = buildPackageColumns($v, $hasDescription, $hasIsActive, $hasCoverImg);
        $setClause = implode(', ', array_map(fn($c) => "$c = ?", $cols));
        $vals[] = $id;

        $stmt = $pdo->prepare(
            "UPDATE tour_package SET $setClause WHERE package_id=?"
        );
        $stmt->execute($vals);

        // Return updated package (rowCount may be 0 if no fields changed, which is valid)
        if ($hasIsActive && $v['isActive'] !== null && (bool) $existing['is_active'] !== (bool) filter_var($v['isActive'], FILTER_VALIDATE_BOOLEAN)) {
            logAdminAction($pdo, (int) filter_var($v['isActive'], FILTER_VALIDATE_BOOLEAN) ? 'package_activate' : 'package_deactivate', 'package', $id, [
                'package_name' => $v['name'],
            ], $existing['is_active'] ? 'active' : 'inactive',
               (int) filter_var($v['isActive'], FILTER_VALIDATE_BOOLEAN) ? 'active' : 'inactive');
        } else {
            logAdminAction($pdo, 'package_update', 'package', $id, [
                'package_name' => $v['name'],
                'destination'  => $v['destination'],
            ], null, null);
        }

        $fetch = $pdo->prepare('SELECT * FROM tour_package WHERE package_id = ?');
        $fetch->execute([$id]);
        $pkg   = $fetch->fetch();
        jsonSuccess($pkg);
    }

    // ---- DELETE (hard delete only when there is no booking/payment history) ----
    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Package ID is required.');

        $checkStmt = $pdo->prepare('SELECT package_name FROM tour_package WHERE package_id = ?');
        $checkStmt->execute([$id]);
        $existing = $checkStmt->fetch();
        if (!$existing) jsonError('Package not found.', 404);

        // Refuse to destroy packages that are referenced by bookings or payments.
        $refStmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM booking WHERE package_id = ?');
        $refStmt->execute([$id]);
        $bookingCount = (int) $refStmt->fetch()['cnt'];

        if ($bookingCount > 0) {
            if ($hasIsActive) {
                jsonError(
                    "This package has $bookingCount booking(s) with payment history and cannot be deleted. " .
                    'It was NOT deleted. Use "Deactivate" to archive it instead — history is preserved.',
                    409
                );
            }
            jsonError(
                "This package has $bookingCount booking(s) and cannot be deleted.",
                409
            );
        }

        try {
            $stmt = $pdo->prepare('DELETE FROM tour_package WHERE package_id = ?');
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) jsonError('Package not found.', 404);

            logAdminAction($pdo, 'package_delete', 'package', $id, [
                'package_name' => $existing['package_name'],
            ], null, null);

            jsonSuccess(['message' => 'Package deleted successfully.']);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                jsonError('Cannot delete this package. It has existing bookings. Deactivate it instead.', 409);
            }
            throw $e;
        }
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('[TravelEase DB] Package manage error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
