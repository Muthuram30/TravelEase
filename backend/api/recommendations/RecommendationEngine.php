<?php
// ============================================================
// Smart Travel Assistant - Recommendation Engine
// ============================================================
// Rule-based, explainable recommendation system
// NO AI/ML/LLM - Pure deterministic logic
//
// Scoring Weights:
// - Interest match: 35 points
// - Budget fit: 20 points
// - Duration fit: 15 points
// - Season suitability: 10 points
// - Group type fit: 10 points
// - Destination preference: 5 points
// - Past interactions: 5 points
// Total: 100 points
// ============================================================

class RecommendationEngine {
    private $db;
    private $debug = false;

    // Scoring weight constants
    const WEIGHT_INTEREST = 35;
    const WEIGHT_BUDGET = 20;
    const WEIGHT_DURATION = 15;
    const WEIGHT_SEASON = 10;
    const WEIGHT_GROUP = 10;
    const WEIGHT_DESTINATION = 5;
    const WEIGHT_HISTORY = 5;

    public function __construct($dbConnection, $debug = false) {
        $this->db = $dbConnection;
        $this->debug = $debug;
    }

    /**
     * Main recommendation method
     * Returns array of packages with scores, reasons, and warnings
     */
    public function getRecommendations($preferences, $userId = null, $userTheme = null) {
        // Extract preferences
        $budget = floatval($preferences['budget'] ?? 100000);
        $duration = intval($preferences['duration'] ?? 3);
        $month = intval($preferences['month'] ?? date('n'));
        $groupType = $preferences['group_type'] ?? 'couple';
        $interests = $preferences['interests'] ?? [];
        $destination = $preferences['destination'] ?? '';
        $accessibility = $preferences['accessibility'] ?? [];
        $limit = intval($preferences['limit'] ?? 6);

        // STEP 1: Apply hard filters
        $candidatePackages = $this->applyHardFilters($budget, $duration, $month, $accessibility);

        if (empty($candidatePackages)) {
            return [
                'packages' => [],
                'message' => 'No packages match your requirements. Try adjusting budget or duration.',
                'suggestions' => $this->getRelaxedSuggestions($budget, $duration)
            ];
        }

        // STEP 2: Score each package
        $scoredPackages = [];
        foreach ($candidatePackages as $package) {
            $score = $this->calculateScore(
                $package,
                $interests,
                $budget,
                $duration,
                $month,
                $groupType,
                $destination,
                $userId,
                $userTheme
            );

            $scoredPackages[] = array_merge($package, $score);
        }

        // STEP 3: Sort by total score descending
        usort($scoredPackages, function($a, $b) {
            return $b['total_score'] - $a['total_score'];
        });

        // STEP 4: Take top N
        $topPackages = array_slice($scoredPackages, 0, $limit);

        // STEP 5: Add badges
        $topPackages = $this->addBadges($topPackages, $groupType);

        // STEP 6: Generate assistive suggestions
        $suggestions = $this->getAssistiveSuggestions($preferences, $topPackages);

        return [
            'packages' => $topPackages,
            'suggestions' => $suggestions,
            'total_candidates' => count($candidatePackages),
            'scoring_weights' => [
                'interest' => self::WEIGHT_INTEREST,
                'budget' => self::WEIGHT_BUDGET,
                'duration' => self::WEIGHT_DURATION,
                'season' => self::WEIGHT_SEASON,
                'group' => self::WEIGHT_GROUP,
                'destination' => self::WEIGHT_DESTINATION,
                'history' => self::WEIGHT_HISTORY
            ]
        ];
    }

    /**
     * HARD FILTERS - Must pass all
     */
    private function applyHardFilters($budget, $duration, $month, $accessibility) {
        $sql = "
            SELECT DISTINCT
                p.package_id,
                p.package_name,
                p.description,
                p.destination,
                p.state,
                p.price,
                p.duration_days,
                p.duration_nights,
                p.accommodation_type,
                p.transport_mode,
                p.is_active,
                p.availability_status,
                d.name as destination_name,
                d.state as destination_state,
                d.description as destination_description
            FROM packages p
            LEFT JOIN destinations d ON p.destination_id = d.destination_id
            WHERE p.is_active = TRUE
                AND p.availability_status = 'available'
                AND p.price <= :budget
                AND p.duration_days >= :min_duration
                AND p.duration_days <= :max_duration
        ";

        $params = [
            ':budget' => $budget * 1.1, // Allow 10% budget stretch
            ':min_duration' => max(1, $duration - 1),
            ':max_duration' => $duration + 2
        ];

        // Accessibility filters - use parameterized approach
        $conditions = [];
        if (!empty($accessibility)) {
            if (in_array('wheelchair', $accessibility)) {
                $conditions[] = "EXISTS (
                    SELECT 1 FROM package_accessibility pa
                    WHERE pa.package_id = p.package_id
                    AND pa.wheelchair_accessible = TRUE
                )";
            }
            if (in_array('senior', $accessibility)) {
                $conditions[] = "EXISTS (
                    SELECT 1 FROM package_accessibility pa
                    WHERE pa.package_id = p.package_id
                    AND pa.senior_friendly = TRUE
                )";
            }
            if (in_array('child', $accessibility)) {
                $conditions[] = "EXISTS (
                    SELECT 1 FROM package_accessibility pa
                    WHERE pa.package_id = p.package_id
                    AND pa.child_friendly = TRUE
                )";
            }
        }
        
        if (!empty($conditions)) {
            $sql .= " AND " . implode(" AND ", $conditions);
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * CALCULATE SCORE with breakdown and reasons
     */
    private function calculateScore($package, $interests, $budget, $duration, $month, $groupType, $destination, $userId, $userTheme) {
        $breakdown = [];
        $reasons = [];
        $warnings = [];

        // 1. INTEREST MATCH (35 points)
        $interestScore = $this->scoreInterestMatch($package['package_id'], $interests, $breakdown, $reasons);

        // 2. BUDGET FIT (20 points)
        $budgetScore = $this->scoreBudgetFit($package['price'], $budget, $breakdown, $reasons, $warnings);

        // 3. DURATION FIT (15 points)
        $durationScore = $this->scoreDurationFit($package['duration_days'], $duration, $breakdown, $reasons, $warnings);

        // 4. SEASON SUITABILITY (10 points)
        $seasonScore = $this->scoreSeasonFit($package['package_id'], $month, $breakdown, $reasons, $warnings);

        // 5. GROUP TYPE FIT (10 points)
        $groupScore = $this->scoreGroupFit($package['package_id'], $groupType, $breakdown, $reasons);

        // 6. DESTINATION PREFERENCE (5 points)
        $destScore = $this->scoreDestinationFit($package, $destination, $breakdown, $reasons);

        // 7. PAST INTERACTIONS (5 points)
        $historyScore = $this->scoreHistory($package['package_id'], $userId, $breakdown, $reasons);

        // BONUS: Kerala Green Theme (up to 5 points)
        $themeBonus = 0;
        if ($userTheme === 'kerala-green') {
            $themeBonus = $this->scoreKeralaThemeBonus($package, $breakdown, $reasons);
        }

        $totalScore = $interestScore + $budgetScore + $durationScore + $seasonScore + $groupScore + $destScore + $historyScore + $themeBonus;
        $matchPercentage = round($totalScore);

        return [
            'total_score' => $totalScore,
            'match_percentage' => $matchPercentage,
            'score_breakdown' => $breakdown,
            'reasons' => $reasons,
            'warnings' => $warnings
        ];
    }

    /**
     * INTEREST MATCH SCORING (35 points max)
     */
    private function scoreInterestMatch($packageId, $interests, &$breakdown, &$reasons) {
        if (empty($interests)) {
            $breakdown['interest'] = 0;
            return 0;
        }

        // Get package categories
        $stmt = $this->db->prepare("
            SELECT pc.category_slug, pc.category_name, pcm.relevance_weight
            FROM package_category_mapping pcm
            JOIN package_categories pc ON pcm.category_id = pc.category_id
            WHERE pcm.package_id = ?
        ");
        $stmt->execute([$packageId]);
        $packageCategories = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($packageCategories)) {
            $breakdown['interest'] = 0;
            return 0;
        }

        // Calculate match
        $matchedCategories = [];
        $totalRelevance = 0;
        
        foreach ($packageCategories as $cat) {
            if (in_array($cat['category_slug'], $interests)) {
                $matchedCategories[] = $cat['category_name'];
                $totalRelevance += floatval($cat['relevance_weight']);
            }
        }

        if (empty($matchedCategories)) {
            $breakdown['interest'] = 0;
            return 0;
        }

        // Score: (matched / requested) * weight * average relevance
        $matchRatio = count($matchedCategories) / count($interests);
        $avgRelevance = $totalRelevance / count($matchedCategories);
        $score = round($matchRatio * self::WEIGHT_INTEREST * $avgRelevance, 2);

        $breakdown['interest'] = $score;
        $reasons[] = "Matches your interests: " . implode(', ', $matchedCategories);

        return $score;
    }

    /**
     * BUDGET FIT SCORING (20 points max)
     */
    private function scoreBudgetFit($price, $budget, &$breakdown, &$reasons, &$warnings) {
        $priceDiff = $budget - $price;
        $percentDiff = ($priceDiff / $budget) * 100;

        if ($price <= $budget * 0.7) {
            // Great value - under budget
            $score = self::WEIGHT_BUDGET;
            $reasons[] = sprintf("Excellent value at ₹%s (%.0f%% under budget)", number_format($price), abs($percentDiff));
        } elseif ($price <= $budget) {
            // Fits budget
            $score = self::WEIGHT_BUDGET * 0.9;
            $reasons[] = sprintf("Fits your budget at ₹%s", number_format($price));
        } elseif ($price <= $budget * 1.1) {
            // Slight stretch
            $score = self::WEIGHT_BUDGET * 0.6;
            $warnings[] = sprintf("Slightly over budget by ₹%s (%.0f%%)", number_format($price - $budget), abs($percentDiff));
        } else {
            $score = 0;
        }

        $breakdown['budget'] = round($score, 2);
        return $score;
    }

    /**
     * DURATION FIT SCORING (15 points max)
     */
    private function scoreDurationFit($packageDays, $requestedDays, &$breakdown, &$reasons, &$warnings) {
        $daysDiff = abs($packageDays - $requestedDays);

        if ($daysDiff === 0) {
            $score = self::WEIGHT_DURATION;
            $reasons[] = "Perfect duration match ({$packageDays} days)";
        } elseif ($daysDiff === 1) {
            $score = self::WEIGHT_DURATION * 0.9;
            $reasons[] = "Duration very close ({$packageDays} days)";
        } elseif ($daysDiff === 2) {
            $score = self::WEIGHT_DURATION * 0.7;
            if ($packageDays < $requestedDays) {
                $warnings[] = "Shorter trip ({$packageDays} vs {$requestedDays} days)";
            }
        } else {
            $score = self::WEIGHT_DURATION * 0.4;
        }

        $breakdown['duration'] = round($score, 2);
        return $score;
    }

    /**
     * SEASON FIT SCORING (10 points max)
     */
    private function scoreSeasonFit($packageId, $month, &$breakdown, &$reasons, &$warnings) {
        // Get package seasonal data
        $stmt = $this->db->prepare("
            SELECT season_month, suitability_score
            FROM package_seasonal
            WHERE package_id = ?
        ");
        $stmt->execute([$packageId]);
        $seasons = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($seasons)) {
            $breakdown['season'] = 5; // Neutral if no data
            return 5;
        }

        $monthScore = 0;
        foreach ($seasons as $season) {
            if ($season['season_month'] == $month) {
                $monthScore = $season['suitability_score'];
                break;
            }
        }

        if ($monthScore >= 8) {
            $score = self::WEIGHT_SEASON;
            $reasons[] = "Perfect season for this destination";
        } elseif ($monthScore >= 5) {
            $score = self::WEIGHT_SEASON * 0.7;
            $reasons[] = "Good season to visit";
        } elseif ($monthScore >= 3) {
            $score = self::WEIGHT_SEASON * 0.4;
            $warnings[] = "Shoulder season - some activities may be limited";
        } else {
            $score = self::WEIGHT_SEASON * 0.2;
            $warnings[] = "Off-season - limited availability expected";
        }

        $breakdown['season'] = round($score, 2);
        return $score;
    }

    /**
     * GROUP TYPE FIT SCORING (10 points max)
     */
    private function scoreGroupFit($packageId, $groupType, &$breakdown, &$reasons) {
        // Get package group suitability
        $stmt = $this->db->prepare("
            SELECT group_type, suitability_score
            FROM package_group_suitability
            WHERE package_id = ?
        ");
        $stmt->execute([$packageId]);
        $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($groups)) {
            $breakdown['group'] = 5; // Neutral
            return 5;
        }

        $matchScore = 0;
        foreach ($groups as $group) {
            if ($group['group_type'] === $groupType) {
                $matchScore = $group['suitability_score'];
                break;
            }
        }

        if ($matchScore >= 8) {
            $score = self::WEIGHT_GROUP;
            $reasons[] = "Ideal for {$groupType} travel";
        } elseif ($matchScore >= 5) {
            $score = self::WEIGHT_GROUP * 0.7;
            $reasons[] = "Suitable for {$groupType} travel";
        } else {
            $score = self::WEIGHT_GROUP * 0.3;
            $reasons[] = "Basic suitability for {$groupType}";
        }

        $breakdown['group'] = round($score, 2);
        return $score;
    }

    /**
     * DESTINATION PREFERENCE SCORING (5 points max)
     */
    private function scoreDestinationFit($package, $destination, &$breakdown, &$reasons) {
        if (empty($destination)) {
            $breakdown['destination'] = 0;
            return 0;
        }

        $pkgDest = strtolower($package['destination'] ?? '');
        $prefDest = strtolower($destination);
        $pkgState = strtolower($package['state'] ?? '');

        if (str_contains($pkgDest, $prefDest) || str_contains($pkgState, $prefDest)) {
            $score = self::WEIGHT_DESTINATION;
            $reasons[] = "Matches your preferred destination: {$destination}";
        } else {
            $score = 0;
        }

        $breakdown['destination'] = round($score, 2);
        return $score;
    }

    /**
     * PAST INTERACTIONS SCORING (5 points max)
     */
    private function scoreHistory($packageId, $userId, &$breakdown, &$reasons) {
        if (!$userId) {
            $breakdown['history'] = 0;
            return 0;
        }

        $stmt = $this->db->prepare("
            SELECT interaction_type, COUNT(*) as count
            FROM user_recommendation_prefs
            WHERE user_id = ? AND package_id = ?
            GROUP BY interaction_type
        ");
        $stmt->execute([$userId, $packageId]);
        $interactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $score = 0;
        foreach ($interactions as $interaction) {
            switch ($interaction['interaction_type']) {
                case 'booking': $score += 3 * $interaction['count']; break;
                case 'click': $score += 1 * $interaction['count']; break;
                case 'view': $score += 0.5 * $interaction['count']; break;
            }
        }

        $score = min($score, self::WEIGHT_HISTORY);
        
        if ($score > 0) {
            $reasons[] = "Based on your past interest";
        }

        $breakdown['history'] = round($score, 2);
        return $score;
    }

    /**
     * KERALA THEME BONUS (up to 5 points)
     */
    private function scoreKeralaThemeBonus($package, &$breakdown, &$reasons) {
        $destination = strtolower($package['destination'] ?? '');
        $state = strtolower($package['state'] ?? '');

        if (str_contains($destination, 'kerala') || str_contains($destination, 'munnar') 
            || str_contains($destination, 'wayanad') || str_contains($destination, 'alleppey')
            || str_contains($destination, 'kochi') || str_contains($state, 'kerala')) {
            $score = 5;
            $reasons[] = "Kerala Green theme bonus - this is your preferred destination!";
            $breakdown['theme_bonus'] = $score;
            return $score;
        }

        $breakdown['theme_bonus'] = 0;
        return 0;
    }

    /**
     * Add badges to top packages
     */
    private function addBadges($packages, $groupType) {
        foreach ($packages as &$pkg) {
            $badges = [];
            
            // Top match badge
            if ($pkg['match_percentage'] >= 90) {
                $badges[] = 'Perfect Match';
            } elseif ($pkg['match_percentage'] >= 80) {
                $badges[] = 'Highly Recommended';
            }
            
            // Budget badge
            if (!empty($pkg['score_breakdown']['budget']) && $pkg['score_breakdown']['budget'] >= 18) {
                $badges[] = 'Best Value';
            }
            
            // Group type badge
            if (!empty($pkg['score_breakdown']['group']) && $pkg['score_breakdown']['group'] >= 9) {
                $badges[] = "Great for {$groupType}s";
            }
            
            // Kerala theme badge
            if (!empty($pkg['score_breakdown']['theme_bonus'])) {
                $badges[] = 'Kerala Special';
            }

            $pkg['badges'] = $badges;
        }
        return $packages;
    }

    /**
     * Get assistive suggestions for improving results
     */
    private function getAssistiveSuggestions($preferences, $topPackages) {
        $suggestions = [];
        
        if (empty($topPackages)) {
            $suggestions[] = 'Try increasing your budget by 10-20%';
            $suggestions[] = 'Consider flexible travel dates';
            return $suggestions;
        }

        $topScore = $topPackages[0]['match_percentage'] ?? 0;
        
        if ($topScore < 70) {
            $suggestions[] = 'Results may not fully match your preferences. Consider adjusting filters.';
        }
        
        if (empty($preferences['interests'])) {
            $suggestions[] = 'Add your interests (nature, beach, culture, adventure) for better matches.';
        }
        
        if (empty($preferences['group_type']) || $preferences['group_type'] === 'couple') {
            $suggestions[] = 'Specify your travel group type (family, friends, solo) for tailored suggestions.';
        }

        return $suggestions;
    }

    /**
     * Get relaxed suggestions when no packages match
     */
    private function getRelaxedSuggestions($budget, $duration) {
        return [
            'Increase budget to ' . number_format($budget * 1.5),
            'Extend duration range to ' . ($duration + 3) . ' days',
            'Consider alternative destinations',
            'Remove accessibility filters if not essential'
        ];
    }
}