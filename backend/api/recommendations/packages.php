<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

// database.php already loads .env via loadEnv()
setCorsHeaders();

$db = getDbConnection();

/**
 * Hybrid recommendation algorithm
 * 
 * Uses:
 * - Content-based filtering (tags, destination attributes)
 * - Rule-based scoring (price, duration, theme match)
 * - Popularity signals (package features)
 * 
 * Does NOT fabricate data or override hard filters
 */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getJsonBody();
    
    // User preferences
    $budget_min = $data['budget_min'] ?? 0;
    $budget_max = $data['budget_max'] ?? 999999;
    $duration_days = $data['duration_days'] ?? null;
    $environment_prefs = $data['environment'] ?? []; // ['coastal', 'backwater']
    $theme_prefs = $data['theme'] ?? []; // ['ocean_blue', 'monsoon_green']
    $package_type_prefs = $data['package_type'] ?? []; // ['honeymoon', 'adventure']
    $origin_lat = $data['origin_lat'] ?? null;
    $origin_lng = $data['origin_lng'] ?? null;
    
    try {
        // Build base query
        $sql = "
            SELECT 
                p.package_id,
                p.package_name,
                p.destination,
                p.price,
                p.duration,
                p.package_type,
                p.difficulty_level,
                p.is_featured,
                p.description,
                d.name AS destination_name,
                d.theme_variant,
                d.environment_category,
                d.latitude,
                d.longitude,
                d.region,
                d.state,
                0 AS score
            FROM tour_package p
            LEFT JOIN destination d ON p.destination_id = d.destination_id
            WHERE p.is_active = TRUE
                AND p.price BETWEEN ? AND ?
        ";
        
        $params = [$budget_min, $budget_max];
        
        // Duration filter (approximate)
        if ($duration_days) {
            // Extract numeric days from duration string (e.g., "3 Days")
            $sql .= " AND CAST(SUBSTRING_INDEX(p.duration, ' ', 1) AS UNSIGNED) BETWEEN ? AND ?";
            $params[] = max(1, $duration_days - 1);
            $params[] = $duration_days + 1;
        }
        
        // Environment filter
        if (!empty($environment_prefs)) {
            $placeholders = implode(',', array_fill(0, count($environment_prefs), '?'));
            $sql .= " AND d.environment_category IN ($placeholders)";
            $params = array_merge($params, $environment_prefs);
        }
        
        // Theme filter
        if (!empty($theme_prefs)) {
            $placeholders = implode(',', array_fill(0, count($theme_prefs), '?'));
            $sql .= " AND d.theme_variant IN ($placeholders)";
            $params = array_merge($params, $theme_prefs);
        }
        
        // Package type filter
        if (!empty($package_type_prefs)) {
            $placeholders = implode(',', array_fill(0, count($package_type_prefs), '?'));
            $sql .= " AND p.package_type IN ($placeholders)";
            $params = array_merge($params, $package_type_prefs);
        }
        
        $sql .= " ORDER BY p.is_featured DESC, p.price ASC LIMIT 20";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $packages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Score packages
        foreach ($packages as &$package) {
            $score = 0;
            $explanations = [];
            
            // Featured boost
            if ($package['is_featured']) {
                $score += 10;
                $explanations[] = 'Featured package';
            }
            
            // Theme match
            if (in_array($package['theme_variant'], $theme_prefs)) {
                $score += 15;
                $explanations[] = "Matches your {$package['theme_variant']} preference";
            }
            
            // Environment match
            if (in_array($package['environment_category'], $environment_prefs)) {
                $score += 15;
                $explanations[] = "Perfect for {$package['environment_category']} lovers";
            }
            
            // Package type match
            if (in_array($package['package_type'], $package_type_prefs)) {
                $score += 20;
                $explanations[] = "Great for {$package['package_type']} travelers";
            }
            
            // Budget fit (closer to midpoint is better)
            $budget_midpoint = ($budget_min + $budget_max) / 2;
            $price_diff = abs($package['price'] - $budget_midpoint);
            $price_score = max(0, 10 - ($price_diff / $budget_midpoint) * 10);
            $score += $price_score;
            if ($price_score > 5) {
                $explanations[] = 'Fits your budget perfectly';
            }
            
            // Distance score (if origin provided)
            if ($origin_lat && $origin_lng && $package['latitude'] && $package['longitude']) {
                $distance = calculateDistance(
                    $origin_lat, $origin_lng,
                    $package['latitude'], $package['longitude']
                );
                $package['distance_km'] = round($distance);
                
                // Closer destinations get slight boost (but not dominating)
                if ($distance < 500) {
                    $score += 5;
                    $explanations[] = 'Convenient distance from your location';
                }
            }
            
            $package['recommendation_score'] = $score;
            $package['recommendation_reasons'] = $explanations;
            
            // Fetch tags
            $stmt = $db->prepare("
                SELECT t.tag_name
                FROM package_tag t
                INNER JOIN package_tag_assignment pta ON t.tag_id = pta.tag_id
                WHERE pta.package_id = ?
            ");
            $stmt->execute([$package['package_id']]);
            $package['tags'] = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'tag_name');
            
            // Fetch images
            $stmt = $db->prepare("
                SELECT image_url, image_type
                FROM package_image
                WHERE package_id = ?
                ORDER BY display_order ASC
                LIMIT 3
            ");
            $stmt->execute([$package['package_id']]);
            $package['images'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Sort by score descending
        usort($packages, function($a, $b) {
            return $b['recommendation_score'] - $a['recommendation_score'];
        });
        
        jsonSuccess([
            'recommendations' => $packages,
            'count' => count($packages),
            'filters_applied' => [
                'budget_range' => [$budget_min, $budget_max],
                'duration_days' => $duration_days,
                'environment' => $environment_prefs,
                'theme' => $theme_prefs,
                'package_type' => $package_type_prefs
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        jsonError('Recommendation engine error', 500);
    }
}

/**
 * Haversine distance calculation
 */
function calculateDistance($lat1, $lon1, $lat2, $lon2) {
    $earth_radius = 6371; // km
    
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    
    $a = sin($dLat/2) * sin($dLat/2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLon/2) * sin($dLon/2);
    
    $c = 2 * atan2(sqrt($a), sqrt(1-$a));
    
    return $earth_radius * $c;
}

jsonError('Method not allowed', 405);
