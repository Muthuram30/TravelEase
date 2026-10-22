<?php
// ============================================================
// TravelEase – Package Image Upload & Gallery Management
// ============================================================
// Endpoint: /api/packages/images.php
// Methods: POST (upload), GET (list), DELETE (remove)
// Auth: Admin session + CSRF token required
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

// Custom error log for debugging
function debugLog($msg) {
    $logFile = __DIR__ . '/../../storage/debug.log';
    file_put_contents($logFile, date('Y-m-d H:i:s') . ' ' . $msg . PHP_EOL, FILE_APPEND);
}

// database.php already loads .env via loadEnv()
setCorsHeaders();
debugLog('=== images.php request started ===');

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

// ============================================================
// Configuration
// ============================================================
const UPLOAD_DIR = __DIR__ . '/../../storage/uploads/packages/';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'svg'];

// Ensure upload directory exists
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// ============================================================
// GET: List images for a package
// ============================================================
if ($method === 'GET') {
    $packageId = $_GET['package_id'] ?? null;
    
    if (!$packageId || !is_numeric($packageId)) {
        jsonError('package_id parameter required', 400);
    }

    try {
        $stmt = $db->prepare("
            SELECT 
                image_id,
                package_id,
                image_url,
                image_type,
                display_order,
                caption,
                created_at
            FROM package_image
            WHERE package_id = ?
            ORDER BY display_order ASC, created_at ASC
        ");
        $stmt->execute([$packageId]);
        $images = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        jsonSuccess(['images' => $images]);
    } catch (PDOException $e) {
        error_log("Database error fetching images: " . $e->getMessage());
        jsonError('Failed to fetch images', 500);
    }
}

// ============================================================
// POST: Upload new images (multi-file support)
// ============================================================
if ($method === 'POST') {
    debugLog('DEBUG images.php POST: package_id=' . ($_POST['package_id'] ?? 'none') . ' files=' . count($_FILES['images']['name'] ?? []));
    debugLog('DEBUG images.php: calling requireAdminSessionWithCsrf');
    requireAdminSessionWithCsrf();
    debugLog('DEBUG images.php: requireAdminSessionWithCsrf passed');

    // Validate package_id from form data
    $packageId = $_POST['package_id'] ?? null;
    debugLog('DEBUG images.php: packageId=' . var_export($packageId, true));
    if (!$packageId || !is_numeric($packageId)) {
        jsonError('package_id is required', 400);
    }

    // Verify package exists
    debugLog('DEBUG images.php: verifying package exists');
    try {
        $stmt = $db->prepare("SELECT package_id FROM tour_package WHERE package_id = ?");
        $stmt->execute([$packageId]);
        if (!$stmt->fetch()) {
            debugLog('DEBUG images.php: package not found');
            jsonError('Package not found', 404);
        }
        debugLog('DEBUG images.php: package verified');
    } catch (PDOException $e) {
        debugLog('DEBUG images.php: PDOException verifying package: ' . $e->getMessage());
        jsonError('Database error', 500);
    }

    // Check if files were uploaded
    debugLog('DEBUG images.php: checking FILES - count=' . count($_FILES['images']['name'] ?? []));
    if (empty($_FILES['images'])) {
        debugLog('DEBUG images.php: FILES empty');
        jsonError('No images uploaded', 400);
    }
    debugLog('DEBUG images.php: FILES not empty, proceeding');

    $uploadedImages = [];
    $errors = [];
    
    // Handle multiple file uploads
    $files = $_FILES['images'];
    $fileCount = is_array($files['name']) ? count($files['name']) : 1;
    
    for ($i = 0; $i < $fileCount; $i++) {
        debugLog("DEBUG images.php: processing file index $i");
        // Extract file data (supports both single and multiple uploads)
        $fileName = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $fileTmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $fileSize = is_array($files['size']) ? $files['size'][$i] : $files['size'];
        $fileError = is_array($files['error']) ? $files['error'][$i] : $files['error'];
        debugLog("DEBUG images.php: fileName=$fileName, fileTmpName=$fileTmpName, fileSize=$fileSize, fileError=$fileError");
        
        // Skip if upload error
        if ($fileError !== UPLOAD_ERR_OK) {
            debugLog("DEBUG images.php: upload error for $fileName, error code=$fileError");
            $errors[] = "Upload error for file: $fileName";
            continue;
        }
        debugLog("DEBUG images.php: upload error check passed");

        // Validate file size
        if ($fileSize > MAX_FILE_SIZE) {
            debugLog("DEBUG images.php: file too large: $fileSize > " . MAX_FILE_SIZE);
            $errors[] = "File too large: $fileName (max 5MB)";
            continue;
        }
        debugLog("DEBUG images.php: file size check passed ($fileSize <= " . MAX_FILE_SIZE . ")");

        // Validate MIME type
        debugLog("DEBUG images.php: detecting MIME type for $fileTmpName");
        try {
            $finfo = @finfo_open(FILEINFO_MIME_TYPE);
            debugLog("DEBUG images.php: finfo_open returned: " . var_export($finfo, true));
            if (!$finfo) {
                debugLog("DEBUG images.php: finfo_open failed");
            }
            $mimeType = @finfo_file($finfo, $fileTmpName);
            debugLog("DEBUG images.php: finfo_file returned: " . var_export($mimeType, true));
            finfo_close($finfo);
            debugLog("DEBUG images.php: detected MIME type: $mimeType, allowed: " . implode(', ', ALLOWED_MIME_TYPES));
        } catch (Throwable $e) {
            debugLog("DEBUG images.php: EXCEPTION in MIME detection: " . $e->getMessage());
            throw $e;
        }
        
        if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
            debugLog("DEBUG images.php: MIME type validation failed for $fileName");
            $errors[] = "Invalid file type for: $fileName (allowed: JPEG, PNG, WebP)";
            continue;
        }
        debugLog("DEBUG images.php: MIME type check passed");

        // Validate file extension
        $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        debugLog("DEBUG images.php: file extension: $fileExt, allowed: " . implode(', ', ALLOWED_EXTENSIONS));
        if (!in_array($fileExt, ALLOWED_EXTENSIONS)) {
            debugLog("DEBUG images.php: extension validation failed for $fileName");
            $errors[] = "Invalid file extension for: $fileName";
            continue;
        }
        debugLog("DEBUG images.php: extension check passed");

        // Generate secure filename (prevent path traversal)
        $secureFileName = sprintf(
            'pkg_%d_%s.%s',
            $packageId,
            bin2hex(random_bytes(8)),
            $fileExt
        );
        
        $targetPath = UPLOAD_DIR . $secureFileName;

        error_log('DEBUG images.php: about to move file to ' . $targetPath);
        // Move uploaded file
        if (!move_uploaded_file($fileTmpName, $targetPath)) {
            $errors[] = "Failed to save file: $fileName";
            error_log('DEBUG images.php: move_uploaded_file failed for ' . $fileName);
            continue;
        }
        error_log('DEBUG images.php: file moved successfully');

        // Get image type from POST data (default to 'gallery')
        $imageType = $_POST['image_type'] ?? 'gallery';
        if (!in_array($imageType, ['primary', 'gallery', 'thumbnail'])) {
            $imageType = 'gallery';
        }

        // Get caption if provided
        $caption = isset($_POST["caption_$i"]) ? trim($_POST["caption_$i"]) : null;

        // Get display order (auto-increment if not provided)
        $displayOrder = null;
        if (isset($_POST["display_order_$i"]) && is_numeric($_POST["display_order_$i"])) {
            $displayOrder = (int)$_POST["display_order_$i"];
        }

        debugLog('DEBUG images.php: UPLOAD_DIR=' . UPLOAD_DIR . ' targetPath=' . $targetPath);
        // Insert into database
        try {
            // If no display_order provided, get max + 1
            if ($displayOrder === null) {
                $stmtMax = $db->prepare("SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM package_image WHERE package_id = ?");
                $stmtMax->execute([$packageId]);
                $displayOrder = $stmtMax->fetch(PDO::FETCH_ASSOC)['next_order'];
            }

            $stmt = $db->prepare("
                INSERT INTO package_image (package_id, image_url, image_type, display_order, caption)
                VALUES (?, ?, ?, ?, ?)
            ");
            
            // Store relative URL path
            $imageUrl = "/storage/uploads/packages/$secureFileName";
            error_log('DEBUG images.php: imageUrl=' . $imageUrl);
            
            $stmt->execute([
                $packageId,
                $imageUrl,
                $imageType,
                $displayOrder,
                $caption
            ]);
            debugLog('DEBUG images.php: DB insert successful, image_id=' . $db->lastInsertId());

            // If this is a primary image, update the package's cover_image_url
            if ($imageType === 'primary') {
                $updateStmt = $db->prepare("UPDATE tour_package SET cover_image_url = ? WHERE package_id = ?");
                $updateStmt->execute([$imageUrl, $packageId]);
                debugLog('DEBUG images.php: Updated package cover_image_url to ' . $imageUrl);
            }

            $uploadedImages[] = [
                'image_id' => $db->lastInsertId(),
                'image_url' => $imageUrl,
                'image_type' => $imageType,
                'display_order' => $displayOrder,
                'caption' => $caption,
                'original_name' => $fileName
            ];

        } catch (PDOException $e) {
            error_log("Database error inserting image: " . $e->getMessage());
            // Clean up uploaded file if DB insert fails
            if (file_exists($targetPath)) {
                unlink($targetPath);
            }
            $errors[] = "Database error for file: $fileName";
        }
    }

    // Return results
    $response = [
        'uploaded' => $uploadedImages,
        'count' => count($uploadedImages)
    ];
    
    if (!empty($errors)) {
        $response['errors'] = $errors;
    }

    if (empty($uploadedImages)) {
        jsonError('No images were uploaded successfully', 400);
    }

    jsonSuccess($response);
}

// ============================================================
// DELETE: Remove an image
// ============================================================
if ($method === 'DELETE') {
    requireAdminSessionWithCsrf();

    $body = getJsonBody();
    $imageId = $body['image_id'] ?? null;

    if (!$imageId || !is_numeric($imageId)) {
        jsonError('image_id is required', 400);
    }

    try {
        // Get image details before deleting
        $stmt = $db->prepare("SELECT image_url FROM package_image WHERE image_id = ?");
        $stmt->execute([$imageId]);
        $image = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$image) {
            jsonError('Image not found', 404);
        }

        // Delete from database
        $stmt = $db->prepare("DELETE FROM package_image WHERE image_id = ?");
        $stmt->execute([$imageId]);

        // Delete physical file
        $filePath = __DIR__ . '/../../' . ltrim($image['image_url'], '/');
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        jsonSuccess(['message' => 'Image deleted successfully']);

    } catch (PDOException $e) {
        error_log("Database error deleting image: " . $e->getMessage());
        jsonError('Failed to delete image', 500);
    }
}

// ============================================================
// Method not allowed
// ============================================================
jsonError('Method not allowed', 405);
