<?php
// ============================================================
// TravelEase – OmniRoute/Ollama AI Chatbot Proxy
// ============================================================
// Frontend → PHP → OmniRoute/Ollama → Frontend
// Automatically detects configuration and falls back gracefully
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

// database.php already loads .env via loadEnv()
setCorsHeaders();

$db = getDbConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$data = getJsonBody();
$userMessage = trim($data['message'] ?? '');

if (!$userMessage) {
    jsonError('Message is required', 400);
}

// Rate limiting per session
startSession();
$lastRequest = $_SESSION['chatbot_last_request'] ?? 0;
if (time() - $lastRequest < 3) {
    jsonError('Please wait before sending another message', 429);
}
$_SESSION['chatbot_last_request'] = time();

// Try OmniRoute first, then Ollama, then fallback
$omnirouteUrl = $_ENV['OMNIROUTE_BASE_URL'] ?? '';
$omnirouteKey = $_ENV['OMNIROUTE_API_KEY'] ?? '';
$omnirouteModel = $_ENV['OMNIROUTE_MODEL'] ?? 'gpt-4o-mini';

$ollamaUrl = 'http://127.0.0.1:11434/api/generate';
$ollamaModel = 'travelease-ai';

// Build context from database
$context = buildContextFromDatabase($db, $userMessage);

$systemPrompt = "You are TravelEase Assistant, a helpful travel advisor for India. Be concise and professional. Base recommendations on provided data. Never invent package IDs, prices, or availability. Contact: 9000000000.";

// Try OmniRoute
if (!empty($omnirouteUrl)) {
    try {
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage . "\n\nContext:\n" . $context]
        ];
        
        $ch = curl_init($omnirouteUrl . '/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $omnirouteModel,
                'messages' => $messages,
                'max_tokens' => 500,
                'temperature' => 0.7
            ]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $omnirouteKey
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        @curl_close($ch);
        
        if ($httpCode === 200) {
            $result = json_decode($response, true);
            if (isset($result['choices'][0]['message']['content'])) {
                $assistantMessage = trim($result['choices'][0]['message']['content']);
                jsonSuccess(['response' => $assistantMessage, 'source' => 'omniroute']);
            }
        }
    } catch (Exception $e) {
        error_log("OmniRoute error: " . $e->getMessage());
    }
}

// Try Ollama fallback
try {
    $ch = curl_init($ollamaUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $ollamaModel,
            'system' => $systemPrompt . "\n\nContext:\n" . $context,
            'prompt' => $userMessage,
            'stream' => false,
            'options' => ['temperature' => 0.3, 'top_p' => 0.8]
        ]),
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 60
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    @curl_close($ch);
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if (isset($result['response'])) {
            $answer = trim($result['response']);
            // Remove thinking tags if present
            $answer = preg_replace('/<think>.*?<\/think>/is', '', $answer);
            $answer = trim($answer);
            if ($answer) {
                jsonSuccess(['response' => $answer, 'source' => 'ollama']);
            }
        }
    }
} catch (Exception $e) {
    error_log("Ollama error: " . $e->getMessage());
}

// Intelligent database-grounded response fallback when external LLM is unreachable
$fallbackResponse = generateSmartFallback($db, $userMessage, $context);

jsonSuccess([
    'response' => $fallbackResponse,
    'source' => 'db_grounded_assistant'
]);

/**
 * Build context from database
 */
function buildContextFromDatabase($db, $query) {
    $context = [];
    $queryLower = strtolower($query);
    
    // Package recommendations
    if (preg_match('/\b(package|tour|trip|destination|visit|travel)\b/i', $query)) {
        try {
            $stmt = $db->prepare("
                SELECT p.package_id, p.package_name, p.price, p.duration, d.name AS destination
                FROM tour_package p
                LEFT JOIN destination d ON p.destination_id = d.destination_id
                WHERE p.is_active = TRUE
                ORDER BY p.is_featured DESC, p.price ASC
                LIMIT 5
            ");
            $stmt->execute();
            $packages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($packages)) {
                $context[] = "Available packages:";
                foreach ($packages as $pkg) {
                    $context[] = "- {$pkg['package_name']} to {$pkg['destination']}: ₹{$pkg['price']} for {$pkg['duration']}";
                }
            }
        } catch (PDOException $e) {
            error_log("Context error: " . $e->getMessage());
        }
    }
    
    // Food spots
    if (preg_match('/\b(food|restaurant|eat|cuisine|dining)\b/i', $query)) {
        try {
            $stmt = $db->prepare("
                SELECT venue_name, city, cuisine_type
                FROM foodspot_location l
                INNER JOIN foodspot_merchant m ON l.merchant_id = m.merchant_id
                WHERE l.is_active = TRUE AND m.status = 'approved'
                LIMIT 3
            ");
            $stmt->execute();
            $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($locations)) {
                $context[] = "\nFood spots:";
                foreach ($locations as $loc) {
                    $context[] = "- {$loc['venue_name']} in {$loc['city']} ({$loc['cuisine_type']})";
                }
            }
        } catch (PDOException $e) {
            error_log("Food context error: " . $e->getMessage());
        }
    }
    
    return empty($context) ? "General travel assistance" : implode("\n", $context);
}

/**
 * Generate intelligent fallback response when remote LLM is offline
 */
function generateSmartFallback($db, $userQuery, $context) {
    $q = strtolower($userQuery);

    // 1. Food / dining intent
    if (preg_match('/\b(food|eat|restaurant|cuisine|dining|dish|lunch|dinner)\b/i', $q)) {
        try {
            $stmt = $db->query("
                SELECT venue_name, city, cuisine_type, price_range 
                FROM foodspot_location l
                INNER JOIN foodspot_merchant m ON l.merchant_id = m.merchant_id
                WHERE l.is_active = TRUE AND m.status = 'approved'
                LIMIT 3
            ");
            $spots = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($spots)) {
                $out = "Here are top-rated contracted culinary partners across India:\n\n";
                foreach ($spots as $s) {
                    $out .= "• **{$s['venue_name']}** ({$s['city']}) — {$s['cuisine_type']}, {$s['price_range']}\n";
                }
                $out .= "\nYou can view full menus, chef specialties, and operating hours on our **Food Spots** page!";
                return $out;
            }
        } catch (Exception $e) {}
        return "TravelEase partners with certified regional restaurants across Kerala, Goa, and Himachal Pradesh. Check our Food Spots section to explore authentic culinary destinations!";
    }

    // 2. Route / Map intent
    if (preg_match('/\b(route|map|direction|distance|drive|fly|car|transport)\b/i', $q)) {
        return "You can plan customized multimodal journeys using our **Route Planner**! It calculates road distances, luxury chauffeur options, and flight corridors powered by high-precision vector maps.";
    }

    // 3. Booking / Status intent
    if (preg_match('/\b(book|booking|reserve|status|confirmation|token)\b/i', $q)) {
        return "To book a tour, visit our **Plan & Book** page, choose your desired package, and select your travel dates. Our concierge team confirms bookings within 24 hours! If you already have a booking, track it using **My Booking** with your booking ID or confirmation token.";
    }

    // 4. Packages / Destinations intent
    if (preg_match('/\b(package|tour|trip|destination|kerala|goa|manali|munnar|delhi|hampi|jaisalmer|lakshadweep)\b/i', $q)) {
        try {
            $stmt = $db->query("
                SELECT package_name, destination, price, duration 
                FROM tour_package 
                WHERE is_active = TRUE 
                ORDER BY is_featured DESC, price ASC 
                LIMIT 3
            ");
            $pkgs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($pkgs)) {
                $out = "Here are our most popular verified tour packages:\n\n";
                foreach ($pkgs as $p) {
                    $priceFmt = number_format($p['price']);
                    $out .= "• **{$p['package_name']}** ({$p['destination']}) — {$p['duration']}, ₹{$priceFmt}/person\n";
                }
                $out .= "\nClick **Tour Packages** in the top navigation to browse full itineraries or launch our 3D Explorer!";
                return $out;
            }
        } catch (Exception $e) {}
    }

    // 5. Contact intent
    if (preg_match('/\b(contact|phone|call|help|support|number|email)\b/i', $q)) {
        return "You can reach our dedicated travel concierge 24/7 at **9000000000** 📞 or visit our **Contact** page. We're here to assist you anytime!";
    }

    // Default friendly assistant message
    return "I'm your TravelEase AI Assistant! I can help you discover packages across India, explore contracted regional food spots, calculate routes, or guide your booking. What would you like to explore today? You can also call us at **9000000000**.";
}

