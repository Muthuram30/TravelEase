<?php
// ============================================================
// Check Premium Features API Endpoint
// ============================================================
// GET /api/auth/check-premium.php
// Returns user's role and available features
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

try {
    startSession();
    $user = getCurrentUser();
    
    if (!$user) {
        jsonSuccess([
            'authenticated' => false,
            'role' => 'guest',
            'features' => []
        ]);
    }
    
    // Define available features per role
    $allFeatures = [
        'basic_search' => 'Basic package search',
        'smart_recommendations' => 'Smart travel recommendations',
        'bookings' => 'Tour bookings',
        'route_planner' => 'Interactive route planner',
        'food_discovery' => 'Food spots discovery',
        'priority_support' => '24/7 priority support',
        'advanced_filters' => 'Advanced search filters',
        'unlimited_bookings' => 'Unlimited monthly bookings',
        'admin_panel' => 'Admin dashboard access'
    ];
    
    // Role-based feature mapping
    $roleFeatures = [
        'user' => [
            'basic_search' => true,
            'smart_recommendations' => true,
            'bookings' => true,
            'booking_limit' => 3 // per month
        ],
        'premium' => [
            'basic_search' => true,
            'smart_recommendations' => true,
            'bookings' => true,
            'route_planner' => true,
            'food_discovery' => true,
            'priority_support' => true,
            'advanced_filters' => true,
            'unlimited_bookings' => true
        ],
        'admin' => [
            'basic_search' => true,
            'smart_recommendations' => true,
            'bookings' => true,
            'route_planner' => true,
            'food_discovery' => true,
            'priority_support' => true,
            'advanced_filters' => true,
            'unlimited_bookings' => true,
            'admin_panel' => true
        ]
    ];
    
    $userRole = $user['role'] ?? 'user';
    $features = $roleFeatures[$userRole] ?? $roleFeatures['user'];
    
    // Get booking limits if user
    if ($userRole === 'user') {
        $db = getDbConnection();
        $bookingLimits = getBookingLimits($db, $user['user_id']);
        $features['bookings_used'] = $bookingLimits['count'];
        $features['bookings_remaining'] = $bookingLimits['limit'] - $bookingLimits['count'];
    }
    
    jsonSuccess([
        'authenticated' => true,
        'user_id' => $user['user_id'],
        'email' => $user['email'],
        'role' => $userRole,
        'theme' => $user['theme_preference'],
        'features' => $features,
        'premium_active' => in_array($userRole, ['premium', 'admin'])
    ]);
    
} catch (Exception $e) {
    jsonError($e->getMessage(), 500);
}
