<?php
// ============================================================
// Smart Travel Assistant API Endpoint
// ============================================================
// POST /api/recommendations/smart-assistant.php
// Returns personalized package recommendations with explanations
//
// Request Body:
// {
//   "budget": 50000,
//   "duration": 5,
//   "month": 12,
//   "group_type": "family",
//   "interests": ["nature", "beach", "food"],
//   "destination": "Kerala",
//   "accessibility": ["senior", "child"],
//   "limit": 6
// }
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

try {
    $db = getDbConnection();
    
    // Get request data
    $input = getJsonBody();
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }

    // Validate required fields
    if (!isset($input['budget']) || !isset($input['duration'])) {
        throw new Exception('Budget and duration are required');
    }

    // Get user info from session (if logged in)
    startSession();
    $user = getCurrentUser();
    $userId = $user['user_id'] ?? null;
    $userTheme = $user['theme_preference'] ?? 'kerala-green';
    $userRole = $user['role'] ?? 'guest';
    
    // Check if user is using advanced filters (premium feature)
    $hasAdvancedFilters = !empty($input['accessibility']) || 
                          (!empty($input['interests']) && count($input['interests']) > 3);
    
    // Role-based feature limits
    $limits = [
        'guest' => [
            'max_results' => 3,
            'advanced_filters' => false,
            'explanation_detail' => 'basic'
        ],
        'user' => [
            'max_results' => 6,
            'advanced_filters' => false,
            'explanation_detail' => 'standard'
        ],
        'premium' => [
            'max_results' => 12,
            'advanced_filters' => true,
            'explanation_detail' => 'detailed'
        ],
        'admin' => [
            'max_results' => 20,
            'advanced_filters' => true,
            'explanation_detail' => 'detailed'
        ]
    ];
    
    $userLimits = $limits[$userRole] ?? $limits['guest'];
    
    // Check if user is trying to use premium features
    if ($hasAdvancedFilters && !$userLimits['advanced_filters']) {
        throw new Exception('Advanced filters require a premium account. Please upgrade to use accessibility options and multiple interests.');
    }
    
    // Limit results based on role
    $requestedLimit = $input['limit'] ?? 6;
    $input['limit'] = min($requestedLimit, $userLimits['max_results']);

    // Create recommendation engine
    $engine = new RecommendationEngine($db, false);

    // Get recommendations
    $result = $engine->getRecommendations($input, $userId, $userTheme);

    // Track interaction (non-blocking)
    if ($userId && !empty($result['packages'])) {
        try {
            foreach ($result['packages'] as $package) {
                $stmt = $db->prepare("
                    INSERT INTO user_recommendation_prefs (user_id, package_id, interaction_type)
                    VALUES (?, ?, 'view')
                ");
                $stmt->execute([$userId, $package['package_id']]);
            }
        } catch (Exception $e) {
            // Silently fail - don't break recommendation response
            error_log("Failed to track recommendation view: " . $e->getMessage());
        }
    }

    // Return results with user limits info
    jsonSuccess([
        'packages' => $result['packages'],
        'suggestions' => $result['suggestions'],
        'total_candidates' => $result['total_candidates'],
        'scoring_weights' => $result['scoring_weights'],
        'user' => [
            'user_id' => $userId,
            'role' => $userRole,
            'theme' => $userTheme,
            'limits' => $userLimits,
            'is_authenticated' => $userId !== null
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    jsonError($e->getMessage(), 400);
}