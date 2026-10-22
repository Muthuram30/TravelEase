<?php
require_once 'D:/#My Files/dbms/TravelEase/backend/api/config/database.php';

$pdo = getDbConnection();

echo "Starting Database Seeding...\n";

// 1. Ensure compatibility columns on tour_package
try {
    $pdo->exec("ALTER TABLE tour_package ADD COLUMN cost DECIMAL(10,2) DEFAULT NULL");
    echo "Added 'cost' column to tour_package\n";
} catch (Exception $e) { /* already exists */ }

try {
    $pdo->exec("ALTER TABLE tour_package ADD COLUMN availability INT DEFAULT 20");
    echo "Added 'availability' column to tour_package\n";
} catch (Exception $e) { /* already exists */ }

// Disable foreign key checks for clean seed
$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
$pdo->exec("TRUNCATE TABLE package_tag_assignment");
$pdo->exec("TRUNCATE TABLE package_inclusion");
$pdo->exec("TRUNCATE TABLE package_exclusion");
$pdo->exec("TRUNCATE TABLE package_itinerary_day");
$pdo->exec("TRUNCATE TABLE package_image");
$pdo->exec("TRUNCATE TABLE tour_package");

$pdo->exec("TRUNCATE TABLE foodspot_location_tag");
$pdo->exec("TRUNCATE TABLE foodspot_image");
$pdo->exec("TRUNCATE TABLE foodspot_menu_item");
$pdo->exec("TRUNCATE TABLE foodspot_hours");
$pdo->exec("TRUNCATE TABLE foodspot_location");
$pdo->exec("TRUNCATE TABLE foodspot_merchant");
$pdo->exec("TRUNCATE TABLE merchant_application_audit");
$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

// Seed packages 1 to 10
$packages = [
    [
        'id' => 1,
        'name' => 'Golden Triangle Royal Odyssey',
        'destination' => 'Delhi',
        'dest_id' => 7,
        'price' => 25000.00,
        'duration' => '7 Days',
        'type' => 'cultural',
        'difficulty' => 'easy',
        'season' => 'Oct - Mar',
        'min_group' => 2,
        'max_group' => 20,
        'featured' => 1,
        'desc' => 'Discover the regal history of Delhi, Agra, and Jaipur. Marvel at the Taj Mahal, explore Red Fort, and wander through the pink sandstone palaces of Jaipur.',
        'cover' => 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80',
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80'
        ],
        'tags' => ['heritage', 'culture', 'photography', 'family'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Arrival in Historic Old & New Delhi', 'desc' => 'Visit Qutub Minar, India Gate, and Humayun Tomb before enjoying a rickshaw ride in Chandni Chowk.'],
            ['day' => 2, 'title' => 'Delhi to Agra - City of the Taj', 'desc' => 'Drive through Yamuna Expressway to Agra. Sunset visit to Mehtab Bagh overlooking the Taj Mahal.'],
            ['day' => 3, 'title' => 'Dawn at Taj Mahal & Agra Fort', 'desc' => 'Sunrise entry at the iconic Taj Mahal. Afternoon tour of Agra Fort.'],
            ['day' => 4, 'title' => 'Fatehpur Sikri to Jaipur Pink City', 'desc' => 'En route to Jaipur, explore the abandoned Mughal city of Fatehpur Sikri.'],
            ['day' => 5, 'title' => 'Amber Fort & Hawa Mahal', 'desc' => 'Morning ascend to Amber Fort. Photo stop at Hawa Mahal and City Palace.'],
            ['day' => 6, 'title' => 'Jaipur Craft Bazaars & Chokhi Dhani', 'desc' => 'Artisan block printing workshop followed by traditional Rajasthani dinner at Chokhi Dhani.'],
            ['day' => 7, 'title' => 'Return to Delhi Departure', 'desc' => 'Leisure morning and transfer back to New Delhi airport for onward flights.']
        ]
    ],
    [
        'id' => 2,
        'name' => 'Kerala Backwaters & Houseboat Serenade',
        'destination' => 'Alappuzha',
        'dest_id' => 2,
        'price' => 18000.00,
        'duration' => '5 Days',
        'type' => 'relaxation',
        'difficulty' => 'easy',
        'season' => 'Sep - Apr',
        'min_group' => 2,
        'max_group' => 15,
        'featured' => 1,
        'desc' => 'Cruise the tranquil palm-fringed canals of Alleppey on a traditional luxury Kettuvallam houseboat. Savor authentic Sadya and rejuvenate with Ayurvedic massage.',
        'cover' => 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80',
            'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800&q=80'
        ],
        'tags' => ['backwater', 'relaxation', 'honeymoon', 'ayurveda'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Cochin Arrival & Drive to Alleppey', 'desc' => 'Scenic transfer past coir villages and paddy fields. Check into backwater resort.'],
            ['day' => 2, 'title' => 'Board Luxury Houseboat at Punnamada', 'desc' => 'Cruise Vembanad Lake, witness village life, and enjoy fresh Karimeen fish curry.'],
            ['day' => 3, 'title' => 'Shikara Canoe Canal Expedition', 'desc' => 'Narrow canal canoe tour into quiet village inlets unreachable by larger boats.'],
            ['day' => 4, 'title' => 'Ayurvedic Wellness & Marari Beach Sunset', 'desc' => 'Traditional Abhyanga herbal massage followed by evening relaxation at Marari Beach.'],
            ['day' => 5, 'title' => 'Departure via Fort Kochi', 'desc' => 'Visit historic Chinese fishing nets in Fort Kochi before airport transfer.']
        ]
    ],
    [
        'id' => 3,
        'name' => 'Goa Sun, Sand & Portuguese Heritage',
        'destination' => 'Goa',
        'dest_id' => 3,
        'price' => 12000.00,
        'duration' => '4 Days',
        'type' => 'relaxation',
        'difficulty' => 'easy',
        'season' => 'Nov - Apr',
        'min_group' => 2,
        'max_group' => 25,
        'featured' => 1,
        'desc' => 'Lounge on golden sands, explore Fontainhas Latin Quarter, visit UNESCO-listed Old Goa churches, and indulge in Portuguese-Goan seafood dinners.',
        'cover' => 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80'
        ],
        'tags' => ['beach', 'water-sports', 'luxury', 'food-tour'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Panaji Arrival & Sunset Beach Stroll', 'desc' => 'Check in at coastal resort. Evening sunset cocktail walk at Miramar beach.'],
            ['day' => 2, 'title' => 'Old Goa Basilicas & Spice Plantation', 'desc' => 'Basilica of Bom Jesus, Se Cathedral, followed by organic spice farm lunch with Feni tasting.'],
            ['day' => 3, 'title' => 'Fontainhas Walking Tour & Catamaran Cruise', 'desc' => 'Explore colorful heritage Latin Quarter followed by Mandovi river sunset catamaran.'],
            ['day' => 4, 'title' => 'Watersports & Departure', 'desc' => 'Morning parasailing and jet-ski at Candolim. Transfer to Goa airport / station.']
        ]
    ],
    [
        'id' => 4,
        'name' => 'Himalayan High Altitude Solang & Rohtang',
        'destination' => 'Manali',
        'dest_id' => 5,
        'price' => 35000.00,
        'duration' => '8 Days',
        'type' => 'adventure',
        'difficulty' => 'challenging',
        'season' => 'May - Oct',
        'min_group' => 2,
        'max_group' => 10,
        'featured' => 1,
        'desc' => 'Conquer Himalayan passes, experience snow sports in Solang Valley, cross the Atal Tunnel into Lahaul, and breathe in crisp pine-scented alpine air.',
        'cover' => 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=800&q=80'
        ],
        'tags' => ['mountain', 'adventure', 'snow-activities', 'trekking'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Chandigarh to Manali Scenic Drive', 'desc' => 'Drive along Beas River valley through Kullu apple orchards.'],
            ['day' => 2, 'title' => 'Old Manali & Hadimba Temple', 'desc' => 'Cedar forests, ancient wooden Hadimba temple, and cafe hopping in Old Manali.'],
            ['day' => 3, 'title' => 'Solang Valley Adventure Day', 'desc' => 'Paragliding, zorbing, and ropeway ride overlooking snowcapped Pir Panjal range.'],
            ['day' => 4, 'title' => 'Atal Tunnel & Sissu Lahaul Valley', 'desc' => 'Cross world-renowned Atal Tunnel into cold-desert Lahaul valley. Waterfall trek at Sissu.'],
            ['day' => 5, 'title' => 'Rohtang Snow Pass Excursion', 'desc' => 'High-altitude snow viewpoint at 13,058 ft elevation.'],
            ['day' => 6, 'title' => 'Jogini Waterfalls & Vashisht Hot Springs', 'desc' => 'Scenic alpine forest trek to Jogini falls and natural sulfur hot baths.'],
            ['day' => 7, 'title' => 'Naggar Castle & Roerich Art Gallery', 'desc' => 'Medieval wooden castle of Kullu kings and Himalayan art collection.'],
            ['day' => 8, 'title' => 'Return Transfer to Chandigarh', 'desc' => 'Farewell to the Himalayas with scenic drive back to Chandigarh.']
        ]
    ],
    [
        'id' => 5,
        'name' => 'Thar Desert Royal Safari & Golden Fort',
        'destination' => 'Jaisalmer',
        'dest_id' => 6,
        'price' => 28000.00,
        'duration' => '6 Days',
        'type' => 'cultural',
        'difficulty' => 'moderate',
        'season' => 'Oct - Mar',
        'min_group' => 2,
        'max_group' => 12,
        'featured' => 0,
        'desc' => 'Live the Arabian Nights fantasy among golden sand dunes. Ride camels into sunset, sleep under star-studded desert skies, and explore Sonar Qila.',
        'cover' => 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=80'
        ],
        'tags' => ['camping', 'heritage', 'photography', 'culture'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Arrival in the Golden City', 'desc' => 'Check in at heritage Haveli. Sunset view from Gadisar Lake.'],
            ['day' => 2, 'title' => 'Jaisalmer Fort & Patwon Ki Haveli', 'desc' => 'Explore the living fort with intricate sandstone jali carvings.'],
            ['day' => 3, 'title' => 'Sam Sand Dunes Camel Safari', 'desc' => 'Venture into the Thar Desert for a camel safari and dune sunset.'],
            ['day' => 4, 'title' => 'Desert Campfire & Kalbelia Folk Dance', 'desc' => 'Traditional Rajasthani feast under desert stars with live folk performers.'],
            ['day' => 5, 'title' => 'Kuldhara Ghost Village & Tanot Shrine', 'desc' => 'Visit the enigmatic abandoned village of Kuldhara and Indo-Pak border shrine.'],
            ['day' => 6, 'title' => 'Departure from Jaisalmer', 'desc' => 'Souvenir shopping for camel leather and mirror embroidery before departure.']
        ]
    ],
    [
        'id' => 6,
        'name' => 'Lakshadweep Coral Atoll Paradise',
        'destination' => 'Lakshadweep',
        'dest_id' => 4,
        'price' => 32000.00,
        'duration' => '5 Days',
        'type' => 'relaxation',
        'difficulty' => 'easy',
        'season' => 'Oct - May',
        'min_group' => 2,
        'max_group' => 8,
        'featured' => 1,
        'desc' => 'India’s premier pristine coral archipelago. Turquoise lagoons, kaleidoscope coral reefs, sea turtle snorkeling, and secluded white sand beaches.',
        'cover' => 'https://images.unsplash.com/photo-1586861256632-9ba3c4c0e0b7?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80'
        ],
        'tags' => ['beach', 'water-sports', 'honeymoon', 'eco-tourism'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Fly Kochi to Agatti Atoll', 'desc' => 'Spectacular aerial view landing on the narrow island strip. Boat to Bangaram.'],
            ['day' => 2, 'title' => 'Bangaram Lagoon Scuba Diving', 'desc' => 'Discover living coral gardens and manta rays with certified divemasters.'],
            ['day' => 3, 'title' => 'Thinnakara Uninhabited Island Picnic', 'desc' => 'Castaway style Robinson Crusoe day on pristine uninhabited island.'],
            ['day' => 4, 'title' => 'Glass Bottom Kayaking & Bioluminescence', 'desc' => 'Paddle over crystal reefs and witness magical evening lagoon sparkles.'],
            ['day' => 5, 'title' => 'Return via Agatti', 'desc' => 'Speedboat back to Agatti airstrip for flight to Kochi.']
        ]
    ],
    [
        'id' => 7,
        'name' => 'Munnar Misty Tea Highlands Retreat',
        'destination' => 'Munnar',
        'dest_id' => 1,
        'price' => 15000.00,
        'duration' => '4 Days',
        'type' => 'relaxation',
        'difficulty' => 'easy',
        'season' => 'Sep - May',
        'min_group' => 2,
        'max_group' => 18,
        'featured' => 0,
        'desc' => 'High-altitude emerald tea carpets, crisp mountain mists, spice plantation trails, and rare Nilgiri Tahr sightings at Eravikulam National Park.',
        'cover' => 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80'
        ],
        'tags' => ['nature', 'mountain', 'family', 'relaxation'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Scenic Ascent from Kochi to Munnar', 'desc' => 'Pass Cheeyappara and Valara waterfalls climbing into high tea hills.'],
            ['day' => 2, 'title' => 'Tea Museum & Kolukkumalai Sunrise', 'desc' => 'Jeep safari to the world’s highest tea estate and tea tasting session.'],
            ['day' => 3, 'title' => 'Eravikulam National Park & Mattupetty', 'desc' => 'Spot endangered Nilgiri Tahr at Rajamalai and boat on Mattupetty Dam.'],
            ['day' => 4, 'title' => 'Spice Garden Tour & Return', 'desc' => 'Guided cardamom and pepper plantation walk before returning down to Kochi.']
        ]
    ],
    [
        'id' => 8,
        'name' => 'Hampi UNESCO Boulder & Temple Empire',
        'destination' => 'Hampi',
        'dest_id' => 8,
        'price' => 10000.00,
        'duration' => '3 Days',
        'type' => 'cultural',
        'difficulty' => 'moderate',
        'season' => 'Oct - Mar',
        'min_group' => 1,
        'max_group' => 30,
        'featured' => 0,
        'desc' => 'Step into the 14th century Vijayanagara Empire. Marvel at the stone chariot of Vittala Temple, Virupaksha gopurams, and surreal granite boulder landscapes.',
        'cover' => 'https://images.unsplash.com/photo-1600100397608-f010f443b7be?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80'
        ],
        'tags' => ['heritage', 'culture', 'photography', 'solo-travel'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Virupaksha & Hemakuta Sunset', 'desc' => 'Sacred center exploration, elephant blessings, and sunset over Hemakuta Hill.'],
            ['day' => 2, 'title' => 'Vittala Temple Stone Chariot & Coracle Boat', 'desc' => 'Musical pillars, Stone Chariot, and traditional round coracle boat ride on Tungabhadra.'],
            ['day' => 3, 'title' => 'Royal Enclosure & Lotus Mahal', 'desc' => 'Queen’s bath, Elephant Stables, and Lotus Mahal before departure.']
        ]
    ],
    [
        'id' => 9,
        'name' => 'Wayanad Rainforest & Wildlife Sanctuary',
        'destination' => 'Wayanad',
        'dest_id' => 9,
        'price' => 22000.00,
        'duration' => '5 Days',
        'type' => 'adventure',
        'difficulty' => 'moderate',
        'season' => 'Sep - May',
        'min_group' => 2,
        'max_group' => 14,
        'featured' => 0,
        'desc' => 'Dense evergreen forests, prehistoric Edakkal caves, treehouse stays, bamboo rafting on Kuruva Island, and wild elephant tracking in Muthanga.',
        'cover' => 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80'
        ],
        'tags' => ['nature', 'wildlife', 'trekking', 'eco-tourism'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Calicut to Wayanad Forest Lodge', 'desc' => 'Drive through the 9 hairpin curves of Thamarassery Churam.'],
            ['day' => 2, 'title' => 'Edakkal Neolithic Caves & Chembra Peak', 'desc' => 'Hike to prehistoric rock petroglyphs and view of the heart-shaped lake.'],
            ['day' => 3, 'title' => 'Muthanga Wildlife Jeep Safari', 'desc' => 'Early morning safari to spot wild Asian elephants, gaur, and deer.'],
            ['day' => 4, 'title' => 'Kuruva Island Bamboo Rafting', 'desc' => 'Float down delta streams on eco-friendly bamboo rafts.'],
            ['day' => 5, 'title' => 'Banasura Sagar Dam & Departure', 'desc' => 'Visit India’s largest earthen dam before transfer to Calicut.']
        ]
    ],
    [
        'id' => 10,
        'name' => 'Kovalam Coastal Lighthouse & Sunset Bay',
        'destination' => 'Kovalam',
        'dest_id' => 10,
        'price' => 20000.00,
        'duration' => '6 Days',
        'type' => 'relaxation',
        'difficulty' => 'easy',
        'season' => 'Sep - Apr',
        'min_group' => 2,
        'max_group' => 16,
        'featured' => 0,
        'desc' => 'Crescent-shaped beaches separated by rocky headlands. Climb the red-and-white striped lighthouse, swim in calm bays, and indulge in daily seaside Ayurveda.',
        'cover' => 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=1000&q=80',
        'gallery' => [
            'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&q=80'
        ],
        'tags' => ['beach', 'ayurveda', 'relaxation', 'honeymoon'],
        'itinerary' => [
            ['day' => 1, 'title' => 'Trivandrum Arrival & Kovalam Transfer', 'desc' => 'Short transfer to Lighthouse Beach resort. Evening sea breeze stroll.'],
            ['day' => 2, 'title' => 'Lighthouse Climb & Hawah Beach', 'desc' => 'Panoramic Arabian Sea views from top of Vizhinjam lighthouse.'],
            ['day' => 3, 'title' => 'Poovar Golden Sand Island Backwater', 'desc' => 'Excursion where sea, river, lake, and beach meet.'],
            ['day' => 4, 'title' => 'Full Day Ayurvedic Rejuvenation', 'desc' => 'Shirodhara and Panchakarma therapies conducted by licensed Vaidyas.'],
            ['day' => 5, 'title' => 'Padmanabhaswamy Temple & Kanyakumari', 'desc' => 'Day tour to the sacred Trivandrum temple and sunset at Land’s End.'],
            ['day' => 6, 'title' => 'Departure from Trivandrum', 'desc' => 'Final morning beach breakfast and transfer to Trivandrum Airport.']
        ]
    ]
];

// Insert Packages
$pkgStmt = $pdo->prepare("
    INSERT INTO tour_package (
        package_id, package_name, destination, destination_id, price, cost,
        duration, package_type, difficulty_level, best_season, min_group_size,
        max_group_size, availability, is_featured, is_active, description
    ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, 1, ?
    )
");

$imgStmt = $pdo->prepare("
    INSERT INTO package_image (package_id, image_url, image_type, display_order, caption)
    VALUES (?, ?, ?, ?, ?)
");

$itinStmt = $pdo->prepare("
    INSERT INTO package_itinerary_day (package_id, day_number, title, description)
    VALUES (?, ?, ?, ?)
");

$incStmt = $pdo->prepare("
    INSERT INTO package_inclusion (package_id, item, display_order)
    VALUES (?, ?, ?)
");

$excStmt = $pdo->prepare("
    INSERT INTO package_exclusion (package_id, item, display_order)
    VALUES (?, ?, ?)
");

$tagAssignStmt = $pdo->prepare("
    INSERT IGNORE INTO package_tag_assignment (package_id, tag_id)
    SELECT ?, tag_id FROM package_tag WHERE tag_name = ? OR tag_slug = ? LIMIT 1
");

foreach ($packages as $p) {
    $pkgStmt->execute([
        $p['id'], $p['name'], $p['destination'], $p['dest_id'], $p['price'], $p['price'],
        $p['duration'], $p['type'], $p['difficulty'], $p['season'], $p['min_group'],
        $p['max_group'], $p['max_group'], $p['featured'], $p['desc']
    ]);

    // Cover image
    $imgStmt->execute([$p['id'], $p['cover'], 'primary', 1, $p['name']]);
    
    // Gallery images
    $order = 2;
    foreach ($p['gallery'] as $g) {
        $imgStmt->execute([$p['id'], $g, 'gallery', $order++, $p['name'] . ' Highlight']);
    }

    // Itinerary days
    foreach ($p['itinerary'] as $day) {
        $itinStmt->execute([$p['id'], $day['day'], $day['title'], $day['desc']]);
    }

    // Inclusions
    $inclusions = [
        "Premium accommodation with daily breakfast",
        "Private AC transport with experienced English-speaking chauffeur",
        "All sightseeing tours and entry permits mentioned in itinerary",
        "24/7 dedicated TravelEase trip concierge support"
    ];
    $io = 1;
    foreach ($inclusions as $inc) {
        $incStmt->execute([$p['id'], $inc, $io++]);
    }

    // Exclusions
    $exclusions = [
        "Airfare or train fare to/from reporting destination",
        "Personal expenses like laundry, minibar, and telephone calls",
        "Optional water sports, camera permits, and personal tipping"
    ];
    $eo = 1;
    foreach ($exclusions as $exc) {
        $excStmt->execute([$p['id'], $exc, $eo++]);
    }

    // Tags
    foreach ($p['tags'] as $tag) {
        $tagAssignStmt->execute([$p['id'], $tag, $tag]);
    }
}
echo "Seeded 10 tour packages with images, itineraries, inclusions, exclusions, and tags!\n";

// 2. Seed Food Platform: Merchants & Locations & Menus
$merchants = [
    [
        'id' => 1,
        'business' => 'Malabar Bay Coastal Kitchen LLP',
        'owner' => 'K. V. Joseph',
        'email' => 'partner@malabarbay.com',
        'phone' => '+91 98471 22334',
        'pass' => password_hash('merchant123', PASSWORD_BCRYPT),
        'venue' => 'Malabar Bay Heritage Dining',
        'address' => '14/233 River Road, Fort Kochi',
        'city' => 'Kochi',
        'state' => 'Kerala',
        'lat' => 9.9656,
        'lng' => 76.2421,
        'cuisine' => 'Kerala Coastal',
        'price' => '$$',
        'parking' => 1,
        'wifi' => 1,
        'veg' => 0,
        'desc' => 'Signature Karimeen Pollichathu, Malabar Chemmeen Biryani, and fresh claypot fish curries prepared with wood-pressed virgin coconut oil.',
        'cover' => 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
        'menu' => [
            ['name' => 'Karimeen Pollichathu', 'desc' => 'Pearl spot fish marinated in freshly pounded shallot-chilli masala wrapped in charred banana leaf.', 'price' => 580.00, 'cat' => 'main_course', 'veg' => 0],
            ['name' => 'Appam with Coconut Vegetable Stew', 'desc' => 'Crisp-edged fermented rice hoppers served with aromatic cardamom spiced coconut stew.', 'price' => 260.00, 'cat' => 'main_course', 'veg' => 1],
            ['name' => 'Fort Kochi Crab Roast', 'desc' => 'Mud crabs tossed in toasted black pepper, curry leaves, and toasted coconut slivers.', 'price' => 640.00, 'cat' => 'special', 'veg' => 0],
            ['name' => 'Elaneer Payasam', 'desc' => 'Chilled tender coconut kheer infused with crushed green cardamom and golden raisins.', 'price' => 180.00, 'cat' => 'dessert', 'veg' => 1]
        ]
    ],
    [
        'id' => 2,
        'business' => 'Highland Spice Plantations & Bistro',
        'owner' => 'Mathew Cherian',
        'email' => 'info@highlandspice.in',
        'phone' => '+91 94470 55667',
        'pass' => password_hash('merchant123', PASSWORD_BCRYPT),
        'venue' => 'Highland Spice Terrace',
        'address' => 'Tea Valley View, Nullatanni, Munnar',
        'city' => 'Munnar',
        'state' => 'Kerala',
        'lat' => 10.0889,
        'lng' => 77.0595,
        'cuisine' => 'Malabar Traditional',
        'price' => '$$',
        'parking' => 1,
        'wifi' => 1,
        'veg' => 1,
        'desc' => 'Pure vegetarian garden cafe serving estate-grown spiced tea infusions, banana blossom vadai, and steamed puttu with black chickpeas.',
        'cover' => 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
        'menu' => [
            ['name' => 'Organic Munnar Cardamom Chai', 'desc' => 'Estate-harvested broken orange pekoe tea brewed with mountain cardamom and fresh farm milk.', 'price' => 90.00, 'cat' => 'beverage', 'veg' => 1],
            ['name' => 'Vazhappoo (Banana Blossom) Cutlets', 'desc' => 'Crispy patties crafted from minced banana florets, roasted peanuts, and mild green chillies.', 'price' => 220.00, 'cat' => 'appetizer', 'veg' => 1],
            ['name' => 'Red Rice Puttu & Kadala Curry', 'desc' => 'Steamed cylinders of red rice flour layered with grated coconut served with spicy black chickpea gravy.', 'price' => 240.00, 'cat' => 'main_course', 'veg' => 1],
            ['name' => 'Pazham Pori with Honey', 'desc' => 'Golden batter-fried ripe Nendran plantains drizzled with wild forest honey.', 'price' => 140.00, 'cat' => 'dessert', 'veg' => 1]
        ]
    ],
    [
        'id' => 3,
        'business' => 'Fisherman’s Wharf Hospitality Ltd',
        'owner' => 'Armando De Souza',
        'email' => 'contact@wharfgoa.com',
        'phone' => '+91 98221 88990',
        'pass' => password_hash('merchant123', PASSWORD_BCRYPT),
        'venue' => 'Fisherman’s Wharf Sunset Dine',
        'address' => 'Riverside Promenade, Panaji',
        'city' => 'Panaji',
        'state' => 'Goa',
        'lat' => 15.4989,
        'lng' => 73.8278,
        'cuisine' => 'Goan Seafood',
        'price' => '$$$',
        'parking' => 1,
        'wifi' => 1,
        'veg' => 0,
        'desc' => 'Heritage riverside venue celebrated for Portuguese-Goan peri-peri tiger prawns, kokum solkadhi, and warm Bebinca pudding.',
        'cover' => 'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=800&q=80',
        'menu' => [
            ['name' => 'Goan Peri-Peri King Prawns', 'desc' => 'Jumbo prawns pan-seared in house-made Kashmiri chili and Toddy vinegar reduction.', 'price' => 690.00, 'cat' => 'special', 'veg' => 0],
            ['name' => 'Traditional Fish Curry with Rice', 'desc' => 'Kingfish simmered in creamy coconut paste with sour dried kokum petals and Goan red rice.', 'price' => 450.00, 'cat' => 'main_course', 'veg' => 0],
            ['name' => 'Chilled Kokum Solkadhi', 'desc' => 'Refreshing digestive made from pressed coconut milk, wild mangosteen extract, and coriander.', 'price' => 120.00, 'cat' => 'beverage', 'veg' => 1],
            ['name' => 'Traditional 7-Layer Bebinca', 'desc' => 'Warm caramelized Indo-Portuguese layered pudding baked with coconut milk and pure ghee.', 'price' => 250.00, 'cat' => 'dessert', 'veg' => 1]
        ]
    ],
    [
        'id' => 4,
        'business' => 'Himalayan Hearth & Dhaba Foods',
        'owner' => 'Ramesh Thakur',
        'email' => 'hearth@manalifoods.com',
        'phone' => '+91 98160 44332',
        'pass' => password_hash('merchant123', PASSWORD_BCRYPT),
        'venue' => 'Himalayan Hearth & Mountain Kitchen',
        'address' => 'Old Manali Bridge Road, Manali',
        'city' => 'Manali',
        'state' => 'Himachal Pradesh',
        'lat' => 32.2432,
        'lng' => 77.1892,
        'cuisine' => 'Himachali Cuisine',
        'price' => '$',
        'parking' => 0,
        'wifi' => 1,
        'veg' => 1,
        'desc' => 'Wood-fired mountain cafe serving stuffed walnut Siddu, Kullu Dham lentils, and spiced mountain herb teas overlooking snow ridges.',
        'cover' => 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80',
        'menu' => [
            ['name' => 'Steamed Walnut & Poppy Siddu', 'desc' => 'Traditional fermented wheat dough bun stuffed with spiced mountain walnuts, served with melted desi ghee.', 'price' => 190.00, 'cat' => 'main_course', 'veg' => 1],
            ['name' => 'Kullu Sepu Vadi Curry', 'desc' => 'Steamed lentil dumplings simmered in rich yoghurt and mustard-seed gravy.', 'price' => 240.00, 'cat' => 'main_course', 'veg' => 1],
            ['name' => 'Kullu Mountain Rhododendron Tea', 'desc' => 'Wild-foraged crimson Buransh flower brew sweetened with raw forest honey.', 'price' => 110.00, 'cat' => 'beverage', 'veg' => 1],
            ['name' => 'Sweet Mittha Rice', 'desc' => 'Saffron-infused Basmati rice slow cooked with dry fruits and green cardamom.', 'price' => 160.00, 'cat' => 'dessert', 'veg' => 1]
        ]
    ]
];

$merchStmt = $pdo->prepare("
    INSERT INTO foodspot_merchant (merchant_id, business_name, owner_name, email, phone, password_hash, status)
    VALUES (?, ?, ?, ?, ?, ?, 'approved')
");

$locStmt = $pdo->prepare("
    INSERT INTO foodspot_location (
        location_id, merchant_id, venue_name, address, city, state,
        latitude, longitude, description, cuisine_type, price_range,
        has_parking, has_wifi, is_vegetarian_only, is_active
    ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, 1
    )
");

$menuStmt = $pdo->prepare("
    INSERT INTO foodspot_menu_item (
        location_id, item_name, description, price, category, is_vegetarian, is_available
    ) VALUES (?, ?, ?, ?, ?, ?, 1)
");

$hoursStmt = $pdo->prepare("
    INSERT INTO foodspot_hours (location_id, day_of_week, open_time, close_time, is_closed)
    VALUES (?, ?, '09:00:00', '22:30:00', 0)
");

$foodImgStmt = $pdo->prepare("
    INSERT INTO foodspot_image (location_id, image_url, image_type, caption)
    VALUES (?, ?, 'cover', ?)
");

$auditStmt = $pdo->prepare("
    INSERT INTO merchant_application_audit (merchant_id, action, notes)
    VALUES (?, 'approved', 'Initial contracted verified partner enrollment')
");

$days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

foreach ($merchants as $m) {
    $merchStmt->execute([
        $m['id'], $m['business'], $m['owner'], $m['email'], $m['phone'], $m['pass']
    ]);

    $locStmt->execute([
        $m['id'], $m['id'], $m['venue'], $m['address'], $m['city'], $m['state'],
        $m['lat'], $m['lng'], $m['desc'], $m['cuisine'], $m['price'],
        $m['parking'], $m['wifi'], $m['veg']
    ]);

    $foodImgStmt->execute([$m['id'], $m['cover'], $m['venue']]);
    $auditStmt->execute([$m['id']]);

    // Hours
    foreach ($days as $day) {
        $hoursStmt->execute([$m['id'], $day]);
    }

    // Menus
    foreach ($m['menu'] as $item) {
        $menuStmt->execute([
            $m['id'], $item['name'], $item['desc'], $item['price'], $item['cat'], $item['veg']
        ]);
    }
}

echo "Seeded 4 approved food merchants with full menus, operating hours, and location data!\n";
echo "DATABASE SEED COMPLETE!\n";
