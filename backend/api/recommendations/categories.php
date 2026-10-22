<?php
// ============================================================
// Get Interest Categories for Recommendations
// ============================================================
// GET /api/recommendations/categories.php
// Returns list of available interest categories

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

try {
    $db = getDbConnection();
    
    $stmt = $db->prepare("
        SELECT 
            category_id,
            category_name,
            category_slug,
            description,
            icon,
            display_order
        FROM package_categories
        WHERE is_active = TRUE
        ORDER BY display_order ASC
    ");
    
    $stmt->execute();
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonSuccess($categories);

} catch (Exception $e) {
    jsonError('Failed to load categories', 500);
}