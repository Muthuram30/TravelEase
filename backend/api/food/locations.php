<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

// database.php already loads .env via loadEnv()
setCorsHeaders();

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

// GET: List active food locations or single location by ID
if ($method === 'GET') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $city = $_GET['city'] ?? null;
    $cuisine = $_GET['cuisine'] ?? null;
    $price_range = $_GET['price_range'] ?? null;
    
    try {
        if ($id) {
            $stmt = $db->prepare("
                SELECT 
                    l.*,
                    m.business_name,
                    m.owner_name,
                    m.email AS merchant_email,
                    m.phone AS merchant_phone,
                    m.status AS merchant_status
                FROM foodspot_location l
                INNER JOIN foodspot_merchant m ON l.merchant_id = m.merchant_id
                WHERE l.location_id = ? AND l.is_active = TRUE AND m.status = 'approved'
            ");
            $stmt->execute([$id]);
            $location = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$location) {
                jsonError('Food spot location not found', 404);
            }

            // Images
            $imgStmt = $db->prepare("SELECT * FROM foodspot_image WHERE location_id = ? ORDER BY display_order ASC");
            $imgStmt->execute([$id]);
            $location['images'] = $imgStmt->fetchAll(PDO::FETCH_ASSOC);

            // Tags
            $tagStmt = $db->prepare("
                SELECT t.tag_name, t.tag_slug
                FROM foodspot_tag t
                INNER JOIN foodspot_location_tag lt ON t.tag_id = lt.tag_id
                WHERE lt.location_id = ?
            ");
            $tagStmt->execute([$id]);
            $location['tags'] = $tagStmt->fetchAll(PDO::FETCH_ASSOC);

            // Hours
            $hoursStmt = $db->prepare("SELECT day_of_week, open_time, close_time, is_closed FROM foodspot_hours WHERE location_id = ?");
            $hoursStmt->execute([$id]);
            $location['hours'] = $hoursStmt->fetchAll(PDO::FETCH_ASSOC);

            // Menu Items
            $menuStmt = $db->prepare("
                SELECT menu_item_id, item_name, description, price, category, is_vegetarian, is_vegan, is_available
                FROM foodspot_menu_item
                WHERE location_id = ? AND is_available = TRUE
                ORDER BY display_order ASC, category ASC
            ");
            $menuStmt->execute([$id]);
            $location['menu_items'] = $menuStmt->fetchAll(PDO::FETCH_ASSOC);

            jsonSuccess($location);
        }

        $sql = "
            SELECT 
                l.location_id,
                l.venue_name,
                l.address,
                l.city,
                l.state,
                l.latitude,
                l.longitude,
                l.description,
                l.cuisine_type,
                l.price_range,
                l.has_parking,
                l.has_wifi,
                l.is_vegetarian_only,
                m.business_name,
                m.status AS merchant_status
            FROM foodspot_location l
            INNER JOIN foodspot_merchant m ON l.merchant_id = m.merchant_id
            WHERE l.is_active = TRUE AND m.status = 'approved'
        ";
        
        $params = [];
        
        if ($city) {
            $sql .= " AND l.city = ?";
            $params[] = $city;
        }
        
        if ($cuisine) {
            $sql .= " AND l.cuisine_type = ?";
            $params[] = $cuisine;
        }
        
        if ($price_range) {
            $sql .= " AND l.price_range = ?";
            $params[] = $price_range;
        }
        
        $sql .= " ORDER BY l.venue_name ASC";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fetch images, tags, and menu items for each location
        foreach ($locations as &$location) {
            $stmt = $db->prepare("
                SELECT image_url, image_type, caption
                FROM foodspot_image
                WHERE location_id = ?
                ORDER BY display_order ASC
                LIMIT 5
            ");
            $stmt->execute([$location['location_id']]);
            $location['images'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Fetch tags
            $stmt = $db->prepare("
                SELECT t.tag_name, t.tag_slug
                FROM foodspot_tag t
                INNER JOIN foodspot_location_tag lt ON t.tag_id = lt.tag_id
                WHERE lt.location_id = ?
            ");
            $stmt->execute([$location['location_id']]);
            $location['tags'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch menu items preview
            $stmt = $db->prepare("
                SELECT menu_item_id, item_name, description, price, category, is_vegetarian
                FROM foodspot_menu_item
                WHERE location_id = ? AND is_available = TRUE
                ORDER BY display_order ASC
                LIMIT 6
            ");
            $stmt->execute([$location['location_id']]);
            $location['menu_items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch hours
            $stmt = $db->prepare("
                SELECT day_of_week, open_time, close_time, is_closed
                FROM foodspot_hours
                WHERE location_id = ?
            ");
            $stmt->execute([$location['location_id']]);
            $location['hours'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        jsonSuccess(['locations' => $locations, 'count' => count($locations)]);
        
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        jsonError('Database error', 500);
    }
}

// POST: Create location (merchant only, requires authentication)
if ($method === 'POST') {
    // TODO: Implement merchant session authentication
    jsonError('Not implemented - requires merchant authentication', 501);
}

jsonError('Method not allowed', 405);
