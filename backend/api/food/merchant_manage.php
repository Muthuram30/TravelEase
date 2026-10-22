<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];
startSession();

$merchantId = $_SESSION['food_merchant_id'] ?? null;
if (!$merchantId) {
    jsonError('Authentication required. Please log in as a merchant.', 401);
}

// Mutations require a valid CSRF token (issued by merchant_auth.php login/me)
if ($method !== 'GET') {
    validateCsrfToken();
}

try {
    // Verify merchant exists and get status
    $stmt = $db->prepare("SELECT merchant_id, business_name, status FROM foodspot_merchant WHERE merchant_id = ?");
    $stmt->execute([$merchantId]);
    $merchant = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$merchant) {
        unset($_SESSION['food_merchant_id']);
        jsonError('Merchant account not found', 404);
    }

    // GET: Get merchant locations & menus
    if ($method === 'GET') {
        $stmt = $db->prepare("
            SELECT * FROM foodspot_location
            WHERE merchant_id = ?
            ORDER BY location_id DESC
        ");
        $stmt->execute([$merchantId]);
        $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($locations as &$loc) {
            $mStmt = $db->prepare("SELECT * FROM foodspot_menu_item WHERE location_id = ? ORDER BY category, display_order");
            $mStmt->execute([$loc['location_id']]);
            $loc['menu_items'] = $mStmt->fetchAll(PDO::FETCH_ASSOC);

            $hStmt = $db->prepare("SELECT * FROM foodspot_hours WHERE location_id = ?");
            $hStmt->execute([$loc['location_id']]);
            $loc['hours'] = $hStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        jsonSuccess([
            'merchant' => $merchant,
            'locations' => $locations
        ]);
    }

    // POST: Create or Update Location, or Add Menu Item
    if ($method === 'POST') {
        $action = $_GET['action'] ?? 'save_location';
        $data = getJsonBody();

        if ($action === 'save_location') {
            $venueName = trim($data['venue_name'] ?? '');
            $address = trim($data['address'] ?? '');
            $city = trim($data['city'] ?? '');
            $state = trim($data['state'] ?? 'India');
            $cuisine = trim($data['cuisine_type'] ?? 'Regional');
            $priceRange = $data['price_range'] ?? '$$';
            $description = trim($data['description'] ?? '');
            $hasParking = !empty($data['has_parking']) ? 1 : 0;
            $hasWifi = !empty($data['has_wifi']) ? 1 : 0;
            $isVeg = !empty($data['is_vegetarian_only']) ? 1 : 0;
            $lat = !empty($data['latitude']) ? (float)$data['latitude'] : 20.5937;
            $lng = !empty($data['longitude']) ? (float)$data['longitude'] : 78.9629;

            if (!$venueName || !$address || !$city) {
                jsonError('Venue name, address, and city are required', 400);
            }

            // Check if existing location for this merchant
            $existingStmt = $db->prepare("SELECT location_id FROM foodspot_location WHERE merchant_id = ? LIMIT 1");
            $existingStmt->execute([$merchantId]);
            $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Update
                $upStmt = $db->prepare("
                    UPDATE foodspot_location
                    SET venue_name = ?, address = ?, city = ?, state = ?, cuisine_type = ?,
                        price_range = ?, description = ?, has_parking = ?, has_wifi = ?,
                        is_vegetarian_only = ?, latitude = ?, longitude = ?
                    WHERE location_id = ? AND merchant_id = ?
                ");
                $upStmt->execute([
                    $venueName, $address, $city, $state, $cuisine, $priceRange,
                    $description, $hasParking, $hasWifi, $isVeg, $lat, $lng,
                    $existing['location_id'], $merchantId
                ]);
                $locationId = $existing['location_id'];
            } else {
                // Insert
                $inStmt = $db->prepare("
                    INSERT INTO foodspot_location (
                        merchant_id, venue_name, address, city, state, cuisine_type,
                        price_range, description, has_parking, has_wifi, is_vegetarian_only,
                        latitude, longitude, is_active
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, 1
                    )
                ");
                $inStmt->execute([
                    $merchantId, $venueName, $address, $city, $state, $cuisine,
                    $priceRange, $description, $hasParking, $hasWifi, $isVeg,
                    $lat, $lng
                ]);
                $locationId = (int)$db->lastInsertId();

                // Add standard hours
                $days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                $hStmt = $db->prepare("INSERT IGNORE INTO foodspot_hours (location_id, day_of_week, open_time, close_time) VALUES (?, ?, '09:00:00', '22:30:00')");
                foreach ($days as $day) {
                    $hStmt->execute([$locationId, $day]);
                }
            }

            jsonSuccess(['location_id' => $locationId, 'message' => 'Venue profile saved successfully']);
        }

        if ($action === 'add_menu_item') {
            $locationId = (int)($data['location_id'] ?? 0);
            $itemName = trim($data['item_name'] ?? '');
            $itemDesc = trim($data['description'] ?? '');
            $price = (float)($data['price'] ?? 0);
            $category = $data['category'] ?? 'main_course';
            $isVeg = !empty($data['is_vegetarian']) ? 1 : 0;

            if (!$itemName || $price <= 0) {
                jsonError('Item name and a positive price are required', 400);
            }

            // Verify merchant owns location
            $locCheck = $db->prepare("SELECT location_id FROM foodspot_location WHERE location_id = ? AND merchant_id = ?");
            $locCheck->execute([$locationId, $merchantId]);
            if (!$locCheck->fetch()) {
                jsonError('Location not found or access denied', 403);
            }

            $mStmt = $db->prepare("
                INSERT INTO foodspot_menu_item (location_id, item_name, description, price, category, is_vegetarian, is_available)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            ");
            $mStmt->execute([$locationId, $itemName, $itemDesc, $price, $category, $isVeg]);
            $itemId = (int)$db->lastInsertId();

            jsonSuccess(['menu_item_id' => $itemId, 'message' => 'Menu item added successfully']);
        }

        if ($action === 'delete_menu_item') {
            $itemId = (int)($data['menu_item_id'] ?? 0);
            if (!$itemId) {
                jsonError('Menu item ID required', 400);
            }

            // Ensure item belongs to location owned by merchant
            $delStmt = $db->prepare("
                DELETE m FROM foodspot_menu_item m
                INNER JOIN foodspot_location l ON m.location_id = l.location_id
                WHERE m.menu_item_id = ? AND l.merchant_id = ?
            ");
            $delStmt->execute([$itemId, $merchantId]);

            jsonSuccess(['message' => 'Menu item deleted']);
        }
    }

} catch (PDOException $e) {
    error_log("Merchant manage error: " . $e->getMessage());
    jsonError('Database operation failed: ' . $e->getMessage(), 500);
}

jsonError('Method not allowed', 405);
