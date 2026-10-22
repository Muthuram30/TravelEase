<?php
// ============================================================
// TravelEase – Package Image Upload & Gallery Management
// ============================================================
// Endpoint: /api/packages/images.php
// Methods: POST (upload), GET (list), DELETE (remove)
// Auth: Admin session + CSRF token required for all methods
// Uploads: raster images only (JPEG/PNG/WebP) — no SVG (XSS vector)
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

// database.php already loads .env via loadEnv()
setCorsHeaders();

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

// ============================================================
// Configuration
// ============================================================
const UPLOAD_DIR = __DIR__ . '/../../storage/uploads/packages/';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
// SVG is deliberately NOT allowed: SVG can embed <script> payloads
// and becomes an XSS vector when served inline from this origin.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Every MIME type maps to the exact extensions it may be stored with.
const EXT_BY_MIME = [
    'image/jpeg' => ['jpg', 'jpeg'],
    'image/png'  => ['png'],
    'image/webp' => ['webp'],
];

try {
    // All methods (including listing) are admin-only.
    if ($method === 'GET') {
        requireAdminSession();
    } else {
        requireAdminSessionWithCsrf();
    }

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
        requireAdminSessionWithCsrf();

        // Validate package_id from form data
        $packageId = $_POST['package_id'] ?? null;
        if (!$packageId || !is_numeric($packageId)) {
            jsonError('package_id is required', 400);
        }

        // Verify package exists
        $stmt = $db->prepare("SELECT package_id FROM tour_package WHERE package_id = ?");
        $stmt->execute([$packageId]);
        if (!$stmt->fetch()) {
            jsonError('Package not found', 404);
        }

        if (empty($_FILES['images'])) {
            jsonError('No images uploaded', 400);
        }

        $uploadedImages = [];
        $errors = [];

        // Handle multiple file uploads
        $files = $_FILES['images'];
        $fileCount = is_array($files['name']) ? count($files['name']) : 1;

        for ($i = 0; $i < $fileCount; $i++) {
            // Extract file data (supports both single and multiple uploads)
            $fileName    = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $fileTmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $fileSize    = is_array($files['size']) ? $files['size'][$i] : $files['size'];
            $fileError   = is_array($files['error']) ? $files['error'][$i] : $files['error'];

            // Skip if upload error
            if ($fileError !== UPLOAD_ERR_OK) {
                $errors[] = "Upload error for file: $fileName";
                continue;
            }

            // Validate file size
            if ($fileSize > MAX_FILE_SIZE) {
                $errors[] = "File too large: $fileName (max 5MB)";
                continue;
            }

            // Sniff the REAL content type from file bytes.
            // $_FILES['type'] comes from the client and is never trusted.
            $finfo = @finfo_open(FILEINFO_MIME_TYPE);
            if (!$finfo) {
                $errors[] = "Server could not validate file: $fileName";
                continue;
            }
            $mimeType = @finfo_file($finfo, $fileTmpName) ?: '';
            @finfo_close($finfo);

            if (!in_array($mimeType, ALLOWED_MIME_TYPES, true)) {
                $errors[] = "Invalid file type for: $fileName (allowed: JPEG, PNG, WebP)";
                continue;
            }

            // Extension must be consistent with the detected content type
            $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            if (!in_array($fileExt, EXT_BY_MIME[$mimeType], true)) {
                $errors[] = "Invalid file extension for: $fileName";
                continue;
            }

            // Generate secure filename (never derived from user input)
            $secureFileName = sprintf(
                'pkg_%d_%s.%s',
                $packageId,
                bin2hex(random_bytes(8)),
                $fileExt
            );

            $targetPath = UPLOAD_DIR . $secureFileName;

            // Move uploaded file
            if (!move_uploaded_file($fileTmpName, $targetPath)) {
                $errors[] = "Failed to save file: $fileName";
                continue;
            }

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

                $stmt->execute([
                    $packageId,
                    $imageUrl,
                    $imageType,
                    $displayOrder,
                    $caption
                ]);

                // If this is a primary image, update the package's cover_image_url
                if ($imageType === 'primary') {
                    $updateStmt = $db->prepare("UPDATE tour_package SET cover_image_url = ? WHERE package_id = ?");
                    $updateStmt->execute([$imageUrl, $packageId]);
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
                error_log("Database error inserting image (pkg #$packageId): " . $e->getMessage());
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

            // Only allow deleting files that actually live inside the
            // uploads directory (defense against path traversal in DB values).
            $filePath = realpath(__DIR__ . '/../../' . ltrim($image['image_url'], '/'));
            $uploadRoot = realpath(UPLOAD_DIR);
            if ($filePath === false || $uploadRoot === false || strpos($filePath, $uploadRoot) !== 0) {
                jsonError('Invalid image path', 400);
            }

            // Delete from database
            $stmt = $db->prepare("DELETE FROM package_image WHERE image_id = ?");
            $stmt->execute([$imageId]);

            // Delete physical file
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

} catch (Exception $e) {
    error_log('[TravelEase] Images endpoint error: ' . $e->getMessage());
    jsonError('Server error.', 500);
}
