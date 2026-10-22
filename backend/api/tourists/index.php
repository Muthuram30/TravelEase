<?php
// ============================================================
// GET  /api/tourists/index.php              → list/search tourists (admin)
// GET  /api/tourists/index.php?id=N         → single tourist
// POST /api/tourists/index.php              → create tourist (admin, requires CSRF)
// PUT  /api/tourists/index.php?id=N         → update tourist (admin, requires CSRF)
// DELETE /api/tourists/index.php?id=N       → delete tourist (admin, requires CSRF)
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

try {
    $pdo = getDbConnection();

    // ---- GET single tourist ----
    if ($method === 'GET' && isset($_GET['id'])) {
        $id   = (int) $_GET['id'];
        $stmt = $pdo->prepare('SELECT * FROM tourist WHERE tourist_id = ?');
        $stmt->execute([$id]);
        $tourist = $stmt->fetch();
        if (!$tourist) jsonError('Tourist not found.', 404);
        jsonSuccess($tourist);
    }

    // ---- GET list with optional search ----
    if ($method === 'GET') {
        $sql    = 'SELECT * FROM tourist WHERE 1=1';
        $params = [];

        if (!empty($_GET['search'])) {
            // SQL QUERY: LIKE search across multiple columns
            $like    = '%' . $_GET['search'] . '%';
            $sql    .= ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ?)';
            $params  = [$like, $like, $like, $like];
        }

        $sql .= ' ORDER BY tourist_id ASC';

        $stmt     = $pdo->prepare($sql);
        $stmt->execute($params);
        $tourists = $stmt->fetchAll();

        jsonSuccess($tourists);
    }

    // Validate tourist fields (shared between POST and PUT)
    function validateTourist(array $body): array {
        $name    = trim($body['name']    ?? '');
        $phone   = trim($body['phone']   ?? '');
        $email   = trim($body['email']   ?? '');
        $address = trim($body['address'] ?? '');

        $errors = [];
        if (!$name)  $errors[] = 'Tourist name is required.';
        if (!$phone) $errors[] = 'Phone number is required.';

        return compact('name', 'phone', 'email', 'address', 'errors');
    }

    $body = getJsonBody();

    // ---- CREATE ----
    if ($method === 'POST') {
        $v = validateTourist($body);
        if ($v['errors']) jsonError(implode(' ', $v['errors']));

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO tourist (name, phone, email, address) VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([
                $v['name'],
                $v['phone'],
                $v['email'] ?: null,
                $v['address'] ?: null,
            ]);
            $newId   = (int) $pdo->lastInsertId();
            $fetch   = $pdo->prepare('SELECT * FROM tourist WHERE tourist_id = ?');
            $fetch->execute([$newId]);
            $tourist = $fetch->fetch();
            jsonSuccess($tourist, 201);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                jsonError('A tourist with this email already exists.', 409);
            }
            throw $e;
        }
    }

    // ---- UPDATE ----
    if ($method === 'PUT') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Tourist ID is required.');

        $v = validateTourist($body);
        if ($v['errors']) jsonError(implode(' ', $v['errors']));

        try {
            $stmt = $pdo->prepare(
                'UPDATE tourist SET name=?, phone=?, email=?, address=? WHERE tourist_id=?'
            );
            $stmt->execute([
                $v['name'],
                $v['phone'],
                $v['email'] ?: null,
                $v['address'] ?: null,
                $id,
            ]);
            if ($stmt->rowCount() === 0) jsonError('Tourist not found.', 404);

            $fetch   = $pdo->prepare('SELECT * FROM tourist WHERE tourist_id = ?');
            $fetch->execute([$id]);
            $tourist = $fetch->fetch();
            jsonSuccess($tourist);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                jsonError('A tourist with this email already exists.', 409);
            }
            throw $e;
        }
    }

    // ---- DELETE ----
    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('Tourist ID is required.');

        try {
            $stmt = $pdo->prepare('DELETE FROM tourist WHERE tourist_id = ?');
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) jsonError('Tourist not found.', 404);
            jsonSuccess(['message' => 'Tourist deleted successfully.']);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                jsonError('Cannot delete this tourist. They have existing bookings.', 409);
            }
            throw $e;
        }
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('[TravelEase DB] Tourist error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
