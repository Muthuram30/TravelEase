<?php
// ============================================================
// Destinations API
// GET /api/destinations/index.php              → List all active destinations
// GET /api/destinations/index.php?id=1         → Single destination by ID
// GET /api/destinations/index.php?slug=...     → Single destination by slug
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

try {
    $pdo = getDbConnection();
    
    // Single destination by ID
    if (!empty($_GET['id'])) {
        $id = (int) $_GET['id'];
        
        $stmt = $pdo->prepare('
            SELECT d.*, 
                   COUNT(p.package_id) as package_count
            FROM destination d
            LEFT JOIN tour_package p ON d.destination_id = p.destination_id 
                                     AND p.is_active = TRUE
            WHERE d.destination_id = ? AND d.is_active = TRUE
            GROUP BY d.destination_id
        ');
        $stmt->execute([$id]);
        $dest = $stmt->fetch();
        
        if (!$dest) {
            jsonError('Destination not found', 404);
        }
        
        jsonSuccess($dest);
    }
    
    // Single destination by slug
    if (!empty($_GET['slug'])) {
        $slug = trim($_GET['slug']);
        
        $stmt = $pdo->prepare('
            SELECT d.*, 
                   COUNT(p.package_id) as package_count
            FROM destination d
            LEFT JOIN tour_package p ON d.destination_id = p.destination_id 
                                     AND p.is_active = TRUE
            WHERE d.slug = ? AND d.is_active = TRUE
            GROUP BY d.destination_id
        ');
        $stmt->execute([$slug]);
        $dest = $stmt->fetch();
        
        if (!$dest) {
            jsonError('Destination not found', 404);
        }
        
        jsonSuccess($dest);
    }
    
    // List all active destinations
    $search = trim($_GET['search'] ?? '');
    
    if ($search) {
        $stmt = $pdo->prepare('
            SELECT d.*, 
                   COUNT(p.package_id) as package_count
            FROM destination d
            LEFT JOIN tour_package p ON d.destination_id = p.destination_id 
                                     AND p.is_active = TRUE
            WHERE d.is_active = TRUE
              AND (d.name LIKE ? OR d.region LIKE ? OR d.description LIKE ?)
            GROUP BY d.destination_id
            ORDER BY d.featured_order ASC, d.name ASC
        ');
        $searchTerm = "%$search%";
        $stmt->execute([$searchTerm, $searchTerm, $searchTerm]);
    } else {
        $stmt = $pdo->prepare('
            SELECT d.*, 
                   COUNT(p.package_id) as package_count
            FROM destination d
            LEFT JOIN tour_package p ON d.destination_id = p.destination_id 
                                     AND p.is_active = TRUE
            WHERE d.is_active = TRUE
            GROUP BY d.destination_id
            ORDER BY d.featured_order ASC, d.name ASC
        ');
        $stmt->execute();
    }
    
    $destinations = $stmt->fetchAll();
    jsonSuccess($destinations);
    
} catch (PDOException $e) {
    error_log('[TravelEase DB] Destinations error: ' . $e->getMessage());
    jsonError('Database error. Please try again.', 500);
}
