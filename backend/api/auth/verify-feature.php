<?php
// ============================================================
// Verify Feature Access API Endpoint
// ============================================================
// POST /api/auth/verify-feature.php
// Checks if user has access to a specific feature
//
// Request Body:
// {
//   "feature": "route_planner" | "food_discovery" | "advanced_filters"
// }
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

try {
    $input = getJsonBody();
    
    if (empty($input['feature'])) {
        jsonError('Feature name is required', 400);
    }
    
    $feature = $input['feature'];
    
    // Check authentication
    $user = getCurrentUser();
    if (!$user) {
        jsonError('Authentication required to access this feature', 401);
    }
    
    // Define feature requirements
    $featureRequirements = [
        'route_planner' => 'premium',
        'food_discovery' => 'premium',
        'advanced_filters' => 'premium',
        'priority_support' => 'premium',
        'unlimited_bookings' => 'premium',
        'admin_panel' => 'admin'
    ];
    
    $requiredRole = $featureRequirements[$feature] ?? null;
    
    if (!$requiredRole) {
        // Feature doesn't require premium (available to all)
        jsonSuccess([
            'has_access' => true,
            'feature' => $feature,
            'message' => 'Feature available to all users'
        ]);
    }
    
    // Check if user has required role
    $hasAccess = hasRole($requiredRole, true);
    
    if ($hasAccess) {
        jsonSuccess([
            'has_access' => true,
            'feature' => $feature,
            'user_role' => $user['role']
        ]);
    } else {
        jsonError(
            "This feature requires a $requiredRole account. Please upgrade to continue.",
            403
        );
    }
    
} catch (Exception $e) {
    jsonError($e->getMessage(), 500);
}
