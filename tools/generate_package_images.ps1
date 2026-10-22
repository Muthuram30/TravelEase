# ============================================================
# TravelEase – Procedural Package Artwork Generator
# ============================================================
# Generates stylized, deterministic destination artwork for the
# 10 seed packages (3 variants each) into backend/storage/uploads/packages/
#
# Run from repo root:  powershell -File tools\generate_package_images.ps1
# Requires only .NET (System.Drawing) — no external services.
# ============================================================

param(
    [string]$OutDir = "backend\storage\uploads\packages",
    [int]$Width = 1200,
    [int]$Height = 800
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }

# ---------- destination scene definitions ----------
# palette: sky top, sky bottom, sun color, far hills, mid hills, near hills,
#          water top, water bottom (empty for land scenes), motif, caption
$Scenes = @(
    @{ n = 1;  dest = "Delhi · Agra · Jaipur";   sub = "Golden Triangle Royal Odyssey";
       day   = @("243,180,120", "250,220,170", "255,238,200", "205,140,90", "165,100,65",  "120,72,48", "", "");
       dusk  = @("150,80,90",    "240,160,110", "255,200,120", "150,85,60",  "110,62,45",  "80,45,32",  "", "");
       night = @("40,40,80",     "120,80,110",  "235,235,215", "60,45,70",   "45,33,52",   "32,22,36",  "", "");
       motif = "fort";  water = $false },
    @{ n = 2;  dest = "Alappuzha · Kerala";     sub = "Kerala Backwaters & Houseboat Serenade";
       day   = @("150,200,230",  "210,235,240", "255,245,210", "60,120,90",  "40,95,75",   "28,70,58",  "70,140,150", "45,100,115");
       dusk  = @("120,90,140",   "245,160,120", "255,210,130", "50,75,70",   "35,55,52",   "22,40,40",  "90,90,130",  "55,65,95");
       night = @("30,45,75",     "90,100,130",  "230,230,215", "22,38,36",   "16,28,28",   "10,18,20",  "35,55,75",   "22,38,55");
       motif = "boat";  water = $true },
    @{ n = 3;  dest = "Goa";                    sub = "Goa Sun, Sand & Portuguese Heritage";
       day   = @("120,190,235", "205,230,245", "255,240,200", "70,140,95",  "45,105,75",  "30,75,58",  "95,170,190", "70,140,165");
       dusk  = @("235,130,90",  "255,205,140", "255,235,180", "55,70,60",   "40,52,48",   "28,36,38",  "200,120,110", "150,85,95");
       night = @("35,40,80",    "110,90,130",  "235,235,220", "25,40,38",   "18,28,28",   "12,18,20",  "45,60,90",   "30,42,65");
       motif = "palms"; water = $true },
    @{ n = 4;  dest = "Manali · Himachal";      sub = "Himalayan High Altitude Solang & Rohtang";
       day   = @("140,195,235", "215,235,250", "255,255,245", "150,170,200", "110,135,170", "70,95,135", "", "");
       dusk  = @("120,110,170", "250,170,140", "255,220,170", "110,100,150", "80,72,115",  "50,48,85",  "", "");
       night = @("25,35,75",    "90,100,150",  "235,238,240", "55,65,110",  "40,50,85",   "26,32,60",  "", "");
       motif = "peaks"; snow = $true },
    @{ n = 5;  dest = "Jaisalmer · Rajasthan";  sub = "Thar Desert Royal Safari & Golden Fort";
       day   = @("245,190,120", "255,230,175", "255,245,215", "225,170,100", "200,140,80", "170,115,65", "", "");
       dusk  = @("200,110,80",  "250,190,130", "255,230,190", "185,110,70", "150,85,52",  "120,66,40", "", "");
       night = @("45,38,85",    "130,95,120",  "240,238,225", "90,72,95",   "65,52,70",   "45,36,50",  "", "");
       motif = "dunes" },
    @{ n = 6;  dest = "Lakshadweep";            sub = "Lakshadweep Coral Atoll Paradise";
       day   = @("130,210,240", "190,240,250", "255,250,225", "255,245,220", "250,235,205", "245,225,190", "130,220,235", "90,190,215");
       dusk  = @("140,140,200", "250,190,150", "255,225,170", "235,205,175", "215,180,150", "195,160,130", "120,140,180", "85,105,145");
       night = @("30,45,90",    "110,110,150", "235,238,235", "70,80,110",  "52,60,85",   "38,45,65",  "35,75,105",  "25,55,80");
       motif = "islets"; water = $true },
    @{ n = 7;  dest = "Munnar · Kerala";        sub = "Munnar Misty Tea Highlands Retreat";
       day   = @("170,215,230", "225,240,235", "255,250,230", "110,160,120", "80,130,100", "55,100,80", "", "");
       dusk  = @("160,130,170", "245,185,140", "255,220,175", "85,115,100", "62,90,80",   "44,68,62",  "", "");
       night = @("35,50,85",    "115,120,150", "238,240,230", "45,70,60",   "32,52,48",   "22,36,36",  "", "");
       motif = "tea" },
    @{ n = 8;  dest = "Hampi · Karnataka";      sub = "Hampi UNESCO Boulder & Temple Empire";
       day   = @("190,200,215", "240,225,205", "255,240,215", "175,120,85", "140,92,62",  "105,66,44", "", "");
       dusk  = @("190,120,110", "250,180,130", "255,215,160", "140,85,60",  "105,62,45",  "78,45,33",  "", "");
       night = @("40,38,80",    "125,90,115",  "238,235,220", "65,48,58",   "48,36,44",   "34,25,32",  "", "");
       motif = "boulders" },
    @{ n = 9;  dest = "Wayanad · Kerala";       sub = "Wayanad Rainforest & Wildlife Sanctuary";
       day   = @("150,200,200", "205,230,215", "250,248,225", "55,110,70",  "40,85,58",   "26,62,45", "", "");
       dusk  = @("130,120,150", "230,170,130", "250,210,160", "42,68,52",   "30,50,40",   "20,35,28", "", "");
       night = @("28,42,70",    "100,110,125", "235,238,225", "20,42,34",   "14,30,26",   "9,20,17",  "", "");
       motif = "forest" },
    @{ n = 10; dest = "Kovalam · Kerala";       sub = "Kovalam Coastal Lighthouse & Sunset Bay";
       day   = @("135,200,235", "210,235,245", "255,245,215", "95,150,110", "65,115,90",  "42,82,68",  "100,175,195", "75,145,170");
       dusk  = @("235,135,95",  "255,200,145", "255,230,175", "60,75,60",   "42,55,48",   "30,38,36",  "215,140,120", "160,95,95");
       night = @("30,40,80",    "105,95,135",  "235,235,220", "28,40,38",   "20,28,28",   "13,18,19",  "50,62,95",    "35,44,68");
       motif = "lighthouse"; water = $true }
)

$Variants = @(
    @{ key = 1; sel = "day";   label = "" },
    @{ key = 2; sel = "dusk";  label = "Sunset" },
    @{ key = 3; sel = "night"; label = "Night" }
)

# ---------- deterministic RNG ----------
$script:SeedState = 0
function Next-Rand {
    # xorshift-ish, deterministic
    $script:SeedState = ($script:SeedState * 1103515245 + 12345) -band 0x7FFFFFFF
    return ($script:SeedState -shr 16) / 32767.0
}

function Parse-C([string]$csv) { $p = $csv.Split(','); return [System.Drawing.Color]::FromArgb(255, [int]$p[0], [int]$p[1], [int]$p[2]) }
function Shade-C([System.Drawing.Color]$c, [double]$f) {
    $r = [Math]::Min(255, [Math]::Max(0, [int]($c.R * $f)))
    $g = [Math]::Min(255, [Math]::Max(0, [int]($c.G * $f)))
    $b = [Math]::Min(255, [Math]::Max(0, [int]($c.B * $f)))
    return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

# ---------- building blocks ----------
function Draw-Sky([System.Drawing.Graphics]$g, [System.Drawing.Color]$top, [System.Drawing.Color]$bottom) {
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0,0)), (New-Object System.Drawing.Point(0,$Height)), $top, $bottom)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
}

function Draw-CelestialBody([System.Drawing.Graphics]$g, [System.Drawing.Color]$color, [bool]$night, [double]$seed) {
    if ($night) {
        # stars: deterministic scatter
        $script:SeedState = [int]($seed * 100000)
        for ($i = 0; $i -lt 90; $i++) {
            $x = [int]((Next-Rand) * $Width); $y = [int]((Next-Rand) * ($Height * 0.55))
            $r = 0.6 + (Next-Rand) * 1.3
            $star = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 255, 255, 240))
            $g.FillEllipse($star, $x, $y, [single]$r, [single]$r)
            $star.Dispose()
        }
        $script:SeedState = [int]($seed * 100000) + 7
    }
    $cx = $Width * (0.22 + 0.5 * $seed + 0.1) % $Width
    if ($night) { $cy = $Height * 0.20 } else { $cy = $Height * 0.30 }
    if ($night) { $rad = [single]($Width * 0.045) } else { $rad = [single]($Width * 0.06) }
    # glow
    $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, $color.R, $color.G, $color.B))
    $g.FillEllipse($glow, [single]($cx - $rad*2.2), [single]($cy - $rad*2.2), [single]($rad*4.4), [single]($rad*4.4))
    $glow.Dispose()
    $solid = New-Object System.Drawing.SolidBrush($color)
    $g.FillEllipse($solid, [single]($cx - $rad), [single]($cy - $rad), [single]($rad*2), [single]($rad*2))
    $solid.Dispose()
    if ($night) {
        # crescent bite
        $bite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, [int](0.16*$color.R+0.8*30), [int](0.16*$color.G+0.8*40), [int](0.16*$color.B+0.8*70)))
        $g.FillEllipse($bite, [single]($cx - $rad*1.3), [single]($cy - $rad*0.9), [single]($rad*1.5), [single]($rad*1.5))
        $bite.Dispose()
    }
    return @($cx, $cy)
}

function Ridge-Points([double]$baseY, [double]$amp, [double]$f1, [double]$f2, [double]$phase) {
    $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    for ($x = 0.0; $x -le $Width; $x += 8) {
        $y = $baseY - $amp * (
            0.62 * [Math]::Sin($x * $f1 + $phase) +
            0.38 * [Math]::Sin($x * $f2 + $phase * 2.17) +
            0.22 * [Math]::Sin($x * $f2 * 2.4 + $phase * 0.6))
        $pts.Add((New-Object System.Drawing.PointF([single]$x, [single]$y)))
    }
    $pts.Add((New-Object System.Drawing.PointF([single]$Width, [single]$Height)))
    $pts.Add((New-Object System.Drawing.PointF([single]0, [single]$Height)))
    return $pts
}

function Draw-Ridge([System.Drawing.Graphics]$g, [double]$baseY, [double]$amp, [System.Drawing.Color]$color, [bool]$snowcap, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 11
    $phase = (Next-Rand) * 6.28
    $pts = @(Ridge-Points $baseY ($amp * (0.85 + 0.3 * (Next-Rand))) (0.004 + (Next-Rand) * 0.002) (0.011 + (Next-Rand) * 0.004) $phase)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $g.FillPolygon($brush, [System.Drawing.PointF[]]$pts)
    $brush.Dispose()

    if ($snowcap) {
        # snow on highest ridge: redraw a clipped lighter polygon shifted up
        $capColor = [System.Drawing.Color]::FromArgb(235, 250, 250, 252)
        $snowPts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
        foreach ($pt in $pts) {
            if ($pt.Y -lt $baseY - $amp * 0.55 -and $pt.X -lt $Width) {
                $snowPts.Add((New-Object System.Drawing.PointF([single]$pt.X, [single]($pt.Y + $amp*0.06))))
            } elseif ($pt.Y -ge $Height) {
                $snowPts.Add($pt)
            }
        }
        if ($snowPts.Count -gt 3) {
            $sbrush = New-Object System.Drawing.SolidBrush($capColor)
            $g.FillPolygon($sbrush, $snowPts.ToArray())
            $sbrush.Dispose()
        }
    }
}

function Draw-Water([System.Drawing.Graphics]$g, [double]$fromY, [System.Drawing.Color]$top, [System.Drawing.Color]$bottom, $sunPos, [bool]$night, [double]$seed) {
    $rect = New-Object System.Drawing.Rectangle(0, [int]$fromY, $Width, [int]($Height - $fromY))
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, [int]$fromY)), (New-Object System.Drawing.Point(0, $Height)), $top, $bottom)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
    # sun/moon reflection streaks
    $script:SeedState = [int]($seed * 100000) + 23
    if ($night) { $streakAlpha = 90 } else { $streakAlpha = 120 }
    $lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($streakAlpha, $bottom.R, $bottom.G, $bottom.B))
    if ($sunPos) {
        $sx = $sunPos[0]
        for ($i = 0; $i -lt 26; $i++) {
            $y = $fromY + (Next-Rand) * ($Height - $fromY)
            $halfLen = (6 + (Next-Rand) * 30) * (1 + ($y - $fromY) / $Height)
            $g.FillRectangle($lineBrush, [single]($sx - $halfLen), [single]$y, [single]($halfLen * 2), [single]1.4)
        }
    } else {
        for ($i = 0; $i -lt 18; $i++) {
            $y = $fromY + (Next-Rand) * ($Height - $fromY)
            $x = (Next-Rand) * $Width
            $g.FillRectangle($lineBrush, [single]$x, [single]$y, [single](20 + (Next-Rand) * 50), [single]1.2)
        }
    }
    $lineBrush.Dispose()
}

function Draw-Palms([System.Drawing.Graphics]$g, [double]$groundY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 31
    $frondBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 30, 25))
    for ($p = 0; $p -lt 2; $p++) {
        $bx = 120 + $p * ((Next-Rand) * 90) + $p * 320
        $lean = ((Next-Rand) * 60) - 30
        $topY = $groundY - (150 + (Next-Rand) * 60)
        # trunk
        $g.FillPolygon($frondBrush, @(
            (New-Object System.Drawing.PointF([single]($bx-7), [single]$groundY)),
            (New-Object System.Drawing.PointF([single]($bx+7), [single]$groundY)),
            (New-Object System.Drawing.PointF([single]($bx+$lean+4), [single]$topY)),
            (New-Object System.Drawing.PointF([single]($bx+$lean-4), [single]$topY))))
        # fronds
        $apexX = $bx + $lean; $apexY = $topY
        for ($f = 0; $f -lt 7; $f++) {
            $ang = -140 + $f * 40          # degrees fanned
            $rad = $ang * [Math]::PI / 180.0
            $len = 85 + (Next-Rand) * 35
            $ex = $apexX + [Math]::Cos($rad) * $len
            $ey = $apexY + [Math]::Sin($rad) * $len * 0.55
            $ctlX = $apexX + [Math]::Cos($rad) * $len * 0.55
            $ctlY = $apexY + [Math]::Sin($rad) * $len * 0.5 - 14
            $g.FillPie($frondBrush, [single]($apexX-2), [single]($apexY-2), [single]4, [single]4, 0, 360)
            $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 18, 28, 24), [single]4.2)
            $g.DrawBezier($pen, [single]$apexX, [single]$apexY, [single]$ctlX, [single]$ctlY, [single]$ctlX, [single]$ctlY, [single]$ex, [single]$ey)
            $pen.Dispose()
        }
    }
    $frondBrush.Dispose()
}

function Draw-Boat([System.Drawing.Graphics]$g, [double]$waterY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 41
    $x = $Width * (0.28 + (Next-Rand) * 0.4); $y = $waterY + 60
    $hullBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 25, 22, 20))
    $roofBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 45, 35, 30))
    # kettuvallam houseboat silhouette
    $g.FillPolygon($hullBrush, @(
        (New-Object System.Drawing.PointF([single]($x-70), [single]$y)),
        (New-Object System.Drawing.PointF([single]($x+70), [single]$y)),
        (New-Object System.Drawing.PointF([single]($x+55), [single]($y+18))),
        (New-Object System.Drawing.PointF([single]($x-55), [single]($y+18)))))
    $g.FillRectangle($roofBrush, [single]($x-45), [single]($y-46), [single]90, [single]46)
    $hullBrush.Dispose(); $roofBrush.Dispose()
}

function Draw-Lighthouse([System.Drawing.Graphics]$g, [double]$groundY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 53
    $x = [int]($Width * (0.55 + (Next-Rand) * 0.25))
    $baseW = 46; $topW = 30; $h = 190
    $body = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 32, 36))
    $pts = @(
        (New-Object System.Drawing.PointF([single]($x-$baseW/2), [single]$groundY)),
        (New-Object System.Drawing.PointF([single]($x+$baseW/2), [single]$groundY)),
        (New-Object System.Drawing.PointF([single]($x+$topW/2),  [single]($groundY-$h))),
        (New-Object System.Drawing.PointF([single]($x-$topW/2),  [single]($groundY-$h))))
    $g.FillPolygon($body, $pts)
    # lamp room + light cone
    $cone = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 255, 240, 190))
    $g.FillPolygon($cone, @(
        (New-Object System.Drawing.PointF([single]($x-$topW/2), [single]($groundY-$h-8))),
        (New-Object System.Drawing.PointF([single]($x+$topW/2), [single]($groundY-$h-8))),
        (New-Object System.Drawing.PointF([single]($x+$Width*0.34), [single]($groundY-$h-60))),
        (New-Object System.Drawing.PointF([single]($x+$Width*0.34), [single]($groundY-$h-8)))))
    $body.Dispose(); $cone.Dispose()
}

function Draw-Fort([System.Drawing.Graphics]$g, [double]$groundY, [double]$seed) {
    $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 42, 30, 26))
    $script:SeedState = [int]($seed * 100000) + 61
    $x = [int]($Width * (0.16 + (Next-Rand) * 0.5)); $w = 340; $h = 150
    $g.FillRectangle($b, $x, $groundY-$h, $w, $h)
    # crenellations
    for ($i = 0; $i -lt 9; $i++) { $g.FillRectangle($b, $x + $i*38, $groundY-$h-14, 22, 14) }
    # gate arch
    $gate = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 80, 60, 50))
    $g.FillEllipse($gate, $x+$w/2-34, $groundY-86, 68, 86)
    # dome tower
    $g.FillRectangle($b, $x+$w-70, $groundY-$h-70, 48, 70)
    $g.FillPie($b, $x+$w-76, $groundY-$h-96, 60, 52, 180, 180)
    $b.Dispose()
}

function Draw-TeaBushes([System.Drawing.Graphics]$g, [double]$hillY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 71
    $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 15, 45, 32))
    for ($row = 0; $row -lt 5; $row++) {
        $y = $hillY + 22 + $row * 26
        $x = -20 + (((Next-Rand) * 60))
        while ($x -lt $Width) {
            $g.FillPie($b, [single]$x, [single]$y, [single]30, [single]22, 180, 180)
            $x += 26
        }
    }
    $b.Dispose()
}

function Draw-TempleBoulders([System.Drawing.Graphics]$g, [double]$groundY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 83
    $rock = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 48, 34, 28))
    # scattered boulders
    foreach ($r in @(@(180, 70), @(320, 50), @(560, 90), @(760, 55), @(940, 75))) {
        $cx = $r[0] + (Next-Rand)*40; $rr = $r[1]
        $g.FillEllipse($rock, [single]($cx-$rr), [single]($groundY-$rr*0.9), [single]($rr*2), [single]($rr*1.2))
    }
    # gopuram temple on the tallest
    $t = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 22, 20))
    $bx = 560; $by = $groundY - 90
    for ($tier = 0; $tier -lt 3; $tier++) {
        $tw = 120 - $tier * 34; $th = 34
        $g.FillPolygon($t, @(
            (New-Object System.Drawing.PointF([single]($bx-$tw/2), [single]($by-$tier*$th))),
            (New-Object System.Drawing.PointF([single]($bx+$tw/2), [single]($by-$tier*$th))),
            (New-Object System.Drawing.PointF([single]($bx+$tw/2-14), [single]($by-($tier+1)*$th))),
            (New-Object System.Drawing.PointF([single]($bx-$tw/2+14), [single]($by-($tier+1)*$th)))))
    }
    # finial
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 30, 22, 20), [single]5)
    $g.DrawLine($pen, $bx, $by-102, $bx, $by-130)
    $pen.Dispose()
    $rock.Dispose(); $t.Dispose()
}

function Draw-Forest([System.Drawing.Graphics]$g, [double]$groundY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 97
    $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 12, 30, 22))
    for ($i = 0; $i -lt 22; $i++) {
        $x = (Next-Rand) * $Width
        $h = 60 + (Next-Rand) * 130
        $g.FillPolygon($b, @(
            (New-Object System.Drawing.PointF([single]($x-16), [single]$groundY)),
            (New-Object System.Drawing.PointF([single]($x+16), [single]$groundY)),
            (New-Object System.Drawing.PointF([single]$x, [single]($groundY-$h)))))
    }
    $b.Dispose()
}

function Draw-Islets([System.Drawing.Graphics]$g, [double]$waterY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 101
    $sand = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 235, 220, 190))
    $leaf = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 40, 30))
    for ($i = 0; $i -lt 2; $i++) {
        $x = $Width * (0.24 + $i * 0.48); $w = 190 - $i*60
        $y = $waterY + 34 + $i * 40
        $g.FillEllipse($sand, [single]($x-$w/2), [single]$y, [single]$w, [single]($w*0.18))
        # one stumpy palm per islet
        $g.FillRectangle($leaf, [single]($x-2), [single]($y-34), [single]4, [single]34)
        $g.FillPie($leaf, [single]($x-30), [single]($y-52), [single]60, [single]36, 200, 140)
    }
    $sand.Dispose(); $leaf.Dispose()
}

function Draw-Birds([System.Drawing.Graphics]$g, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 113
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 30, 30, 40), [single]2.4)
    for ($i = 0; $i -lt 4; $i++) {
        $x = 200 + (Next-Rand) * ($Width - 400); $y = 120 + (Next-Rand) * 180; $s = 8 + (Next-Rand) * 7
        $g.DrawArc($pen, [single]$x, [single]$y, [single]$s, [single]$s, 200, 140)
        $g.DrawArc($pen, [single]($x+$s+2), [single]$y, [single]$s, [single]$s, 220, 140)
    }
    $pen.Dispose()
}

function Draw-Caption([System.Drawing.Graphics]$g, [string]$title, [string]$dest, [string]$variant) {
    $bandH = 118
    $band = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 10, 12, 18))
    $g.FillRectangle($band, 0, $Height-$bandH, $Width, $bandH)
    $band.Dispose()
    $white = [System.Drawing.Color]::FromArgb(245, 255, 255, 255)
    $gold  = [System.Drawing.Color]::FromArgb(230, 240, 200, 120)
    $titleFont = New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Bold)
    $destFont  = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Regular)
    $varFont   = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
    $tb = New-Object System.Drawing.SolidBrush($white)
    $gb = New-Object System.Drawing.SolidBrush($gold)
    $g.DrawString($title, $titleFont, $tb, [single]46, [single]($Height-$bandH+8))
    $g.DrawString($dest, $destFont, $gb, [single]48, [single]($Height-42))
    if ($variant) { $g.DrawString($variant, $varFont, $gb, [single]($Width-150), [single]($Height-40)) }
    $tb.Dispose(); $gb.Dispose(); $titleFont.Dispose(); $destFont.Dispose(); $varFont.Dispose()
}

function Save-Jpeg($bitmap, [string]$path) {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)
    $bitmap.Save($path, $codec, $ep)
}

# ---------- main ----------
foreach ($scene in $Scenes) {
    foreach ($variant in $Variants) {
        $pal = $scene[$variant.sel]
        $isNight = $variant.sel -eq 'night'
        $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
        $g = [System.Drawing.Graphics]::FromImage($bitmap)
        $g.SmoothingMode = 'AntiAlias'

        $seed = $scene.n * 3.7 + $variant.key * 0.61

        Draw-Sky $g (Parse-C $pal[0]) (Parse-C $pal[1])
        $sun = Draw-CelestialBody $g (Parse-C $pal[2]) $isNight $seed
        Draw-Birds $g ($seed + 0.3)

        $waterY = $Height * 0.62
        if ($scene.water) {
            $ridgeBase = $waterY + 10
            Draw-Ridge $g $ridgeBase 60 (Parse-C $pal[3]) $false ($seed + 1.1)
            Draw-Water $g $waterY (Parse-C $pal[6]) (Parse-C $pal[7]) $sun $isNight ($seed + 1.9)
        } else {
            Draw-Ridge $g ($Height*0.60) 95  (Parse-C $pal[3]) ($scene.snow -eq $true) ($seed + 1.1)
            Draw-Ridge $g ($Height*0.72) 100 (Parse-C $pal[4]) $false ($seed + 1.6)
            Draw-Ridge $g ($Height*0.86) 80  (Parse-C $pal[5]) $false ($seed + 2.2)
        }

        switch ($scene.motif) {
            'fort'       { Draw-Fort $g ($Height*0.86) $seed }
            'boat'       { Draw-Palms $g ($waterY+14) $seed;  Draw-Boat $g $waterY $seed }
            'palms'      { Draw-Palms $g ($Height*0.78) $seed }
            'peaks'      { }
            'dunes'      { Draw-Fort $g ($Height*0.90) ($seed + 0.5) }
            'islets'     { Draw-Islets $g $waterY $seed }
            'tea'        { Draw-TeaBushes $g ($Height*0.66) $seed }
            'boulders'   { Draw-TempleBoulders $g ($Height*0.87) $seed }
            'forest'     { Draw-Forest $g ($Height*0.88) $seed }
            'lighthouse' { Draw-Lighthouse $g ($Height*0.80) $seed }
        }

        Draw-Caption $g $scene.sub $scene.dest $variant.label

        $out = Join-Path $OutDir ("pkg{0}_{1}.jpg" -f $scene.n, $variant.key)
        Save-Jpeg $bitmap $out
        Write-Host ("  created {0}" -f $out)
        $g.Dispose(); $bitmap.Dispose()
    }
}
Write-Host "`nDone: $($Scenes.Count * 3) images."

