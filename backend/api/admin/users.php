<?php
// ============================================================
// Admin User & Premium Management API
// GET  /api/admin/users.php                → list registered users (search/filter)
// GET  /api/admin/users.php?id=N           → user detail incl. booking history
// POST /api/admin/users.php?action=...&id=N → mutations, all require CSRF
//      actions: set_active (activate/deactivate account)
//               set_premium (grant premium) | revoke_premium
//
// Security model:
//   * Requires admin session (helpers.requireAdminSession) on every call
//     and a valid CSRF token for every mutation.
//   * Password hashes are NEVER selected or returned.
//   * An admin can never act on their own account (self role/lockout
//     escalation) and can never demote, lock, or delete another admin.
//   * Role changes downgrade/upgrade to premium only — this endpoint
//     cannot create new administrator accounts.
// Notes:
//   * There is no pending premium-request workflow in this project yet
//     (Upgrade page is informational) — premium access is granted
//     directly through this endpoint.
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

if ($method === 'GET') {
    requireAdminSession();
} else {
    requireAdminSessionWithCsrf();
}

startSession();
$adminId = (int) ($_SESSION['user_id'] ?? 0);

try {
    $pdo = getDbConnection();

    // ---- Helper: fetch user safely (never exposes password_hash) ----
    function fetchUserById(PDO $pdo, int $id): ?array {
        $stmt = $pdo->prepare('
            SELECT user_id, email, full_name, phone, role, theme_preference,
                   profile_image, email_verified, is_active,
                   premium_since, premium_expiry, premium_features,
                   last_login, created_at, updated_at
            FROM users
            WHERE user_id = ?
        ');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // ---- GET: single user detail with booking history ----
    if ($method === 'GET' && isset($_GET['id'])) {
        $id   = (int) $_GET['id'];
        $user = fetchUserById($pdo, $id);
        if (!$user) jsonError('User not found.', 404);

        // Booking history: created by this account, or guest bookings whose
        // tourist record shares the account email.
        $bookingStmt = $pdo->prepare('
            SELECT
                b.booking_id, b.booking_date, b.travel_date, b.number_of_persons,
                b.total_cost, b.booking_status, b.payment_status, b.created_at,
                p.package_name, p.destination
            FROM booking b
            JOIN tour_package p ON b.package_id = p.package_id
            LEFT JOIN tourist t ON b.tourist_id = t.tourist_id
            WHERE b.user_id = ? OR t.email = ?
            ORDER BY b.booking_id DESC
            LIMIT 50
        ');
        $bookingStmt->execute([$user['user_id'], $user['email']]);
        $bookings = $bookingStmt->fetchAll();

        $user['bookings'] = $bookings;
        jsonSuccess($user);
    }

    // ---- GET: user list with search + filters ----
    if ($method === 'GET') {
        $search     = trim($_GET['search'] ?? '');
        $role       = trim($_GET['role'] ?? '');      // user | premium | admin
        $accountSts = trim($_GET['status'] ?? '');    // active | inactive
        $page       = max(1, (int) ($_GET['page'] ?? 1));
        $limit      = min(50, max(1, (int) ($_GET['limit'] ?? 20)));
        $offset     = ($page - 1) * $limit;

        $sql = '
            SELECT user_id, email, full_name, phone, role,
                   email_verified, is_active,
                   premium_since, premium_expiry,
                   last_login, created_at
            FROM users
            WHERE 1=1
        ';
        $params = [];

        if ($search) {
            $like     = '%' . $search . '%';
            $sql     .= ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $params   = array_merge($params, [$like, $like, $like]);
        }
        if ($role && in_array($role, ['user', 'premium', 'admin'], true)) {
            $sql     .= ' AND role = ?';
            $params[] = $role;
        }
        if ($accountSts && in_array($accountSts, ['active', 'inactive'], true)) {
            $sql     .= $accountSts === 'active' ? ' AND is_active = TRUE' : ' AND is_active = FALSE';
        }

        $countSql  = "SELECT COUNT(*) AS total FROM users WHERE 1=1";
        $countPrms = [];
        if ($search) {
            $like = '%' . $search . '%';
            $countSql .= ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $countPrms = [$like, $like, $like];
        }
        if ($role && in_array($role, ['user', 'premium', 'admin'], true)) {
            $countSql .= ' AND role = ?';
            $countPrms[] = $role;
        }
        if ($accountSts && in_array($accountSts, ['active', 'inactive'], true)) {
            $countSql .= $accountSts === 'active' ? ' AND is_active = TRUE' : ' AND is_active = FALSE';
        }
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($countPrms);
        $total = (int) $countStmt->fetch()['total'];

        $sql .= ' ORDER BY user_id ASC LIMIT ? OFFSET ?';
        $params[] = $limit;
        $params[] = $offset;

        $stmt  = $pdo->prepare($sql);
        $stmt->execute($params);
        $users = $stmt->fetchAll();

        jsonSuccess([
            'data' => $users,
            'pagination' => [
                'page'  => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => max(1, (int) ceil($total / $limit)),
            ],
        ]);
    }

    // ---- Common mutation guards ----
    if ($method === 'POST') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) jsonError('User ID is required.');
        if (!$action) jsonError('Action is required (set_active, set_premium, revoke_premium).');

        $target = fetchUserById($pdo, $id);
        if (!$target) jsonError('User not found.', 404);

        // ---- SECURITY: never allow an admin to act on themselves ----
        // Prevents self role changes and self lockouts through forged requests.
        if ($id === $adminId) {
            jsonError('Administrators cannot change their own account through this panel.', 403);
        }

        // ---- SECURITY: other admin accounts are fully protected ----
        // Prevents privilege escalation chains (demote admin → replace credentials) and lockout.
        if ($target['role'] === 'admin') {
            jsonError('Administrator accounts cannot be modified from the dashboard for security reasons.', 403);
        }

        // ---- Activate / deactivate account ----
        if ($action === 'set_active') {
            $body     = getJsonBody();
            $isActive = filter_var($body['is_active'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isActive === null) {
                jsonError('Field "is_active" (boolean) is required.');
            }

            $newActive = (int) $isActive;
            if ((int) filter_var($target['is_active'], FILTER_VALIDATE_BOOLEAN) === (bool) $newActive) {
                jsonSuccess([
                    'message'          => $newActive ? 'Account is already active.' : 'Account is already deactivated.',
                    'already_in_state' => true,
                    'user_id'          => $id,
                ]);
            }

            $pdo->prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
                ->execute([$newActive, $id]);

            logAdminAction($pdo, $newActive ? 'user_activate' : 'user_deactivate', 'user', $id, [
                'email' => $target['email'],
            ], $target['is_active'] ? 'active' : 'inactive',
               $newActive ? 'active' : 'inactive');

            jsonSuccess(['message' => $newActive
                ? 'Account activated. The user can log in again.'
                : 'Account deactivated. The user can no longer log in.',
                'user_id' => $id]);
        }

        // ---- Grant premium access ----
        if ($action === 'set_premium') {
            if ($target['role'] === 'premium') {
                jsonSuccess([
                    'message'          => 'User already has premium access.',
                    'already_in_state' => true,
                    'user_id'          => $id,
                ]);
            }

            $body   = getJsonBody();
            $months = (int) ($body['months'] ?? 12);
            if ($months < 1 || $months > 60) {
                jsonError('months must be between 1 and 60.');
            }

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('
                    UPDATE users
                    SET role = "premium",
                        premium_since = COALESCE(premium_since, CURDATE()),
                        premium_expiry = DATE_ADD(CURDATE(), INTERVAL ? MONTH),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                ');
                $stmt->execute([$months, $id]);
                $pdo->commit();
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }

            logAdminAction($pdo, 'premium_grant', 'user', $id, [
                'email'  => $target['email'],
                'months' => $months,
            ], 'role: ' . $target['role'], 'premium');

            jsonSuccess(['message' => "Premium access granted to {$target['full_name']} for $months month(s)."]);
        }

        // ---- Revoke premium access ----
        if ($action === 'revoke_premium') {
            if ($target['role'] !== 'premium') {
                jsonSuccess([
                    'message'          => 'User is not a premium member.',
                    'already_in_state' => true,
                    'user_id'          => $id,
                ]);
            }

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('
                    UPDATE users
                    SET role = "user",
                        premium_expiry = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                ');
                $stmt->execute([$id]);
                $pdo->commit();
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }

            logAdminAction($pdo, 'premium_revoke', 'user', $id, [
                'email' => $target['email'],
            ], 'premium', 'user');

            jsonSuccess([
                'message' => "Premium access revoked for {$target['full_name']}. Their role is back to regular user; past premium bookings are unaffected.",
            ]);
        }

        jsonError('Unknown action.', 400);
    }

    jsonError('Method not allowed', 405);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[TravelEase DB] Admin users error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
