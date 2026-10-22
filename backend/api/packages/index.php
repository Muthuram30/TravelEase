<?php
// ============================================================
// GET  /api/packages/index.php  → list all packages
// GET  ?id=N                    → single package
// GET  ?search=X                → search packages
// GET  ?destination=X           → filter by destination
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

try {
    $pdo = getDbConnection();

    // Single package by ID with all related data
    if (isset($_GET['id'])) {
        $id = (int) $_GET['id'];
        
        // Main package data
        $stmt = $pdo->prepare('SELECT * FROM tour_package WHERE package_id = ?');
        $stmt->execute([$id]);
        $pkg = $stmt->fetch();
        
        if (!$pkg) {
            jsonError('Package not found.', 404);
        }
        
        // Add destination data
        if ($pkg['destination_id']) {
            $destStmt = $pdo->prepare('SELECT * FROM destination WHERE destination_id = ?');
            $destStmt->execute([$pkg['destination_id']]);
            $pkg['destination'] = $destStmt->fetch();
        } else {
            $pkg['destination'] = null;
        }
        
        // Add images (ordered by display_order)
        $imgStmt = $pdo->prepare('
            SELECT * FROM package_image 
            WHERE package_id = ? 
            ORDER BY display_order ASC
        ');
        $imgStmt->execute([$id]);
        $rawImages = $imgStmt->fetchAll();
        $pkg['images'] = array_map(function ($img) {
            if (empty($img['image_url']) && !empty($img['image_path'])) {
                $img['image_url'] = $img['image_path'];
            } elseif (empty($img['image_path']) && !empty($img['image_url'])) {
                $img['image_path'] = $img['image_url'];
            }
            return $img;
        }, $rawImages);
        
        // Add itinerary days (ordered by day_number)
        $itinStmt = $pdo->prepare('
            SELECT * FROM package_itinerary_day 
            WHERE package_id = ? 
            ORDER BY day_number ASC
        ');
        $itinStmt->execute([$id]);
        $pkg['itinerary'] = $itinStmt->fetchAll();
        
        // Add inclusions (ordered by display_order)
        $inclStmt = $pdo->prepare('
            SELECT * FROM package_inclusion 
            WHERE package_id = ? 
            ORDER BY display_order ASC
        ');
        $inclStmt->execute([$id]);
        $pkg['inclusions'] = $inclStmt->fetchAll();
        
        // Add exclusions (ordered by display_order)
        $exclStmt = $pdo->prepare('
            SELECT * FROM package_exclusion 
            WHERE package_id = ? 
            ORDER BY display_order ASC
        ');
        $exclStmt->execute([$id]);
        $pkg['exclusions'] = $exclStmt->fetchAll();
        
        // Add tags
        $tagStmt = $pdo->prepare('
            SELECT t.* FROM package_tag t
            JOIN package_tag_assignment pta ON t.tag_id = pta.tag_id
            WHERE pta.package_id = ?
            ORDER BY t.tag_name
        ');
        $tagStmt->execute([$id]);
        $pkg['tags'] = $tagStmt->fetchAll();
        
        jsonSuccess($pkg);
    }

    // Build list query
    $sql    = 'SELECT * FROM tour_package WHERE 1=1';
    $params = [];

    if (!empty($_GET['search'])) {
        $like = '%' . $_GET['search'] . '%';
        $sql .= ' AND (package_name LIKE ? OR destination LIKE ?)';
        $params[] = $like;
        $params[] = $like;
    }

    if (!empty($_GET['destination'])) {
        $sql .= ' AND destination LIKE ?';
        $params[] = '%' . $_GET['destination'] . '%';
    }

    if (!empty($_GET['available'])) {
        $sql .= ' AND availability > 0';
    }

    // Hide admin-deactivated packages from the public listing (new listing only —
    // direct package links still resolve for customers with existing bookings).
    $isActiveCol = $pdo->query("
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tour_package'
        AND COLUMN_NAME = 'is_active'
    ")->fetchColumn();
    if ((int) $isActiveCol > 0 && empty($_GET['include_inactive'])) {
        $sql .= ' AND (is_active = TRUE OR is_active IS NULL)';
    }

    $sql .= ' ORDER BY package_id ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $packages = $stmt->fetchAll();

    jsonSuccess($packages);

} catch (PDOException $e) {
    error_log('[TravelEase DB] Packages list error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
