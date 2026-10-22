# TravelEase Installation Verification Script
# Run this after completing setup to verify all components

Write-Host "`n🔍 TravelEase Installation Verification`n" -ForegroundColor Cyan

$errors = 0
$warnings = 0

# Test 1: Check PHP
Write-Host "Testing PHP..." -NoNewline
try {
    $phpVersion = php -v 2>&1 | Select-String "PHP (\d+\.\d+)"
    if ($phpVersion) {
        Write-Host " ✅ PHP installed: $($phpVersion.Matches.Groups[1].Value)" -ForegroundColor Green
    } else {
        Write-Host " ❌ PHP not found" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host " ❌ PHP not accessible" -ForegroundColor Red
    $errors++
}

# Test 2: Check MySQL
Write-Host "Testing MySQL..." -NoNewline
try {
    $result = mysql --version 2>&1
    if ($result -match "mysql") {
        Write-Host " ✅ MySQL installed" -ForegroundColor Green
    } else {
        Write-Host " ❌ MySQL not found" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host " ❌ MySQL not accessible" -ForegroundColor Red
    $errors++
}

# Test 3: Check Node.js
Write-Host "Testing Node.js..." -NoNewline
try {
    $nodeVersion = node -v 2>&1
    if ($nodeVersion -match "v\d+") {
        Write-Host " ✅ Node.js installed: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host " ❌ Node.js not found" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host " ❌ Node.js not accessible" -ForegroundColor Red
    $errors++
}

# Test 4: Check database connection
Write-Host "Testing database connection..." -NoNewline
try {
    $dbTest = mysql -u root tourism_db -e "SELECT 1;" 2>&1
    if ($dbTest -notmatch "ERROR") {
        Write-Host " ✅ Database accessible" -ForegroundColor Green
    } else {
        Write-Host " ❌ Cannot connect to tourism_db" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host " ❌ Database connection failed" -ForegroundColor Red
    $errors++
}

# Test 5: Check tables
Write-Host "Checking database tables..." -NoNewline
try {
    $tables = mysql -u root tourism_db -e "SHOW TABLES;" 2>&1 | Measure-Object -Line
    $tableCount = $tables.Lines - 1  # Subtract header row
    if ($tableCount -ge 19) {
        Write-Host " ✅ Found $tableCount tables" -ForegroundColor Green
    } else {
        Write-Host " ⚠️ Only $tableCount tables (expected 19)" -ForegroundColor Yellow
        $warnings++
    }
} catch {
    Write-Host " ❌ Cannot query tables" -ForegroundColor Red
    $errors++
}

# Test 6: Check destinations data
Write-Host "Checking destination data..." -NoNewline
try {
    $destCount = mysql -u root tourism_db -e "SELECT COUNT(*) FROM destination;" 2>&1 | Select-String "\d+"
    if ($destCount -match "10") {
        Write-Host " ✅ 10 destinations seeded" -ForegroundColor Green
    } else {
        Write-Host " ⚠️ Destination count: $destCount (expected 10)" -ForegroundColor Yellow
        $warnings++
    }
} catch {
    Write-Host " ❌ Cannot query destinations" -ForegroundColor Red
    $errors++
}

# Test 7: Check backend files
Write-Host "Checking backend API files..." -NoNewline
$apiFiles = Get-ChildItem -Path backend/api -Recurse -Include *.php -ErrorAction SilentlyContinue
if ($apiFiles.Count -ge 20) {
    Write-Host " ✅ Found $($apiFiles.Count) PHP files" -ForegroundColor Green
} else {
    Write-Host " ⚠️ Only $($apiFiles.Count) PHP files" -ForegroundColor Yellow
    $warnings++
}

# Test 8: Check PHP syntax
Write-Host "Validating PHP syntax..." -NoNewline
$syntaxErrors = 0
foreach ($file in $apiFiles) {
    $result = php -l $file.FullName 2>&1
    if ($result -match "error") {
        $syntaxErrors++
    }
}
if ($syntaxErrors -eq 0) {
    Write-Host " ✅ All PHP files valid" -ForegroundColor Green
} else {
    Write-Host " ❌ $syntaxErrors files have syntax errors" -ForegroundColor Red
    $errors++
}

# Test 9: Check frontend dependencies
Write-Host "Checking frontend dependencies..." -NoNewline
if (Test-Path "frontend/node_modules/three") {
    Write-Host " ✅ Three.js installed" -ForegroundColor Green
} else {
    Write-Host " ❌ Three.js missing - run: cd frontend; npm install" -ForegroundColor Red
    $errors++
}

if (Test-Path "frontend/node_modules/maplibre-gl") {
    Write-Host "  ✅ MapLibre installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ MapLibre missing - run: cd frontend; npm install" -ForegroundColor Red
    $errors++
}

# Test 10: Check critical components
Write-Host "Checking critical components..." -NoNewline
$components = @(
    "frontend/src/components/3d/DestinationGlobe.jsx",
    "frontend/src/components/3d/DestinationViewer3D.jsx",
    "frontend/src/components/map/RouteMapPlanner.jsx",
    "frontend/src/components/recommendations/RecommendationEngine.jsx",
    "frontend/src/pages/FoodSpots.jsx",
    "frontend/src/pages/Recommendations.jsx",
    "frontend/src/pages/RoutePlanner.jsx"
)
$missingComponents = 0
foreach ($comp in $components) {
    if (-not (Test-Path $comp)) {
        $missingComponents++
    }
}
if ($missingComponents -eq 0) {
    Write-Host " ✅ All components present" -ForegroundColor Green
} else {
    Write-Host " ❌ $missingComponents components missing" -ForegroundColor Red
    $errors++
}

# Test 11: Check environment file
Write-Host "Checking environment configuration..." -NoNewline
if (Test-Path "backend/.env") {
    Write-Host " ✅ backend/.env exists" -ForegroundColor Green
} else {
    Write-Host " ⚠️ backend/.env missing - copy from .env.example" -ForegroundColor Yellow
    $warnings++
}

# Test 12: Check storage directories
Write-Host "Checking storage directories..." -NoNewline
if (Test-Path "backend/storage/uploads/packages") {
    Write-Host " ✅ Upload directory exists" -ForegroundColor Green
} else {
    Write-Host " ⚠️ Upload directory missing" -ForegroundColor Yellow
    $warnings++
}

# Test 13: Check food merchants
Write-Host "Checking food platform data..." -NoNewline
try {
    $merchantCount = mysql -u root tourism_db -e "SELECT COUNT(*) FROM foodspot_merchant WHERE status='approved';" 2>&1 | Select-String "\d+"
    if ($merchantCount -match "[1-9]") {
        Write-Host " ✅ Approved merchants exist" -ForegroundColor Green
    } else {
        Write-Host " ⚠️ No approved merchants (normal for fresh install)" -ForegroundColor Yellow
        $warnings++
    }
} catch {
    Write-Host " ⚠️ Cannot query merchants" -ForegroundColor Yellow
    $warnings++
}

# Summary
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "`n✅ Perfect! All checks passed.`n" -ForegroundColor Green
    Write-Host "Your TravelEase platform is ready!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Start frontend: cd frontend; npm run dev"
    Write-Host "  2. Open: http://localhost:5173"
    Write-Host "  3. Smoke-test: bookings, admin login, image uploads"
} elseif ($errors -eq 0) {
    Write-Host "`n⚠️ Installation OK with $warnings warning(s).`n" -ForegroundColor Yellow
    Write-Host "Platform should work, but review warnings above." -ForegroundColor Yellow
} else {
    Write-Host "`n❌ Found $errors error(s) and $warnings warning(s).`n" -ForegroundColor Red
    Write-Host "Please fix errors before proceeding." -ForegroundColor Red
}

Write-Host "For deployment: See DEPLOYMENT_GUIDE.md`n" -ForegroundColor Cyan
