<?php
// ============================================================
// Update User Theme Preference
// ============================================================
// PUT /api/auth/update-theme
// Body: { theme_preference: 'default' | 'kerala-green' }

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Method not allowed', 405);
}

try {
    startSession();

    if (!isset($_SESSION['user_id'])) {
        jsonError('Not authenticated', 401);
    }

    $db = getDbConnection();
    $data = getJsonBody();

    if (empty($data['theme_preference'])) {
        throw new Exception('Theme preference is required');
    }

    $theme = $data['theme_preference'];
    $allowed_themes = ['default', 'kerala-green'];

    if (!in_array($theme, $allowed_themes)) {
        throw new Exception('Invalid theme preference');
    }

    // Update theme in database
    $stmt = $db->prepare("UPDATE users SET theme_preference = ? WHERE user_id = ?");
    $stmt->execute([$theme, $_SESSION['user_id']]);

    // Update session
    $_SESSION['theme_preference'] = $theme;

    jsonSuccess([
        'message' => 'Theme updated successfully',
        'theme_preference' => $theme
    ]);

} catch (Exception $e) {
    jsonError($e->getMessage(), 400);
}