# ============================================================
# TravelEase – Procedural Interest-Category Artwork Generator
# ============================================================
# Generates stylized artwork tiles for the Recommendations page
# "interests" selector into frontend/src/assets/interests/
#
# Run from repo root:  powershell -File tools\generate_interest_images.ps1
# Requires only .NET (System.Drawing) — no external services.
# ============================================================

param(
    [string]$OutDir = "frontend\src\assets\interests",
    [int]$Width = 640,
    [int]$Height = 400
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }

# palette per category: sky top, sky bottom, sun, far, mid, near, water(top,bottom optional)
$Scenes = @(
    @{ slug = "nature";        sky1 = "140,190,150"; sky2 = "225,240,215"; sun = "255,245,195"; far = "70,125,90";  mid = "48,95,70";   near = "30,70,52";  water = "";        motif = "forest";   seed = 1.1 },
    @{ slug = "beach";         sky1 = "120,190,235"; sky2 = "255,205,150"; sun = "255,240,200"; far = "70,140,95";  mid = "45,105,75";  near = "30,75,58";  water = "95,170,190,70,140,165"; motif = "palms";   seed = 2.2 },
    @{ slug = "heritage";      sky1 = "240,190,120"; sky2 = "250,225,175"; sun = "255,245,215"; far = "205,140,90"; mid = "165,100,65"; near = "120,72,48"; water = "";        motif = "fort";     seed = 3.3 },
    @{ slug = "adventure";     sky1 = "140,195,235"; sky2 = "225,240,252"; sun = "255,255,245"; far = "150,170,200"; mid = "110,135,170"; near = "70,95,135"; water = "";       motif = "peaks";    seed = 4.4 },
    @{ slug = "food";          sky1 = "240,150,100"; sky2 = "250,215,160"; sun = "255,235,190"; far = "170,90,70";  mid = "130,66,52";  near = "95,46,38";  water = "";        motif = "food";     seed = 5.5 },
    @{ slug = "wellness";      sky1 = "200,160,200"; sky2 = "250,195,165"; sun = "255,225,175"; far = "140,105,140"; mid = "105,80,110"; near = "75,58,80";  water = "120,120,170,90,92,130"; motif = "stones";  seed = 6.6 },
    @{ slug = "photography";   sky1 = "90,110,160";  sky2 = "235,170,140"; sun = "255,215,160"; far = "80,70,110";  mid = "60,52,85";   near = "40,36,60";  water = "";        motif = "camera";   seed = 7.7 },
    @{ slug = "hill-station";  sky1 = "170,215,230"; sky2 = "225,240,235"; sun = "255,180,120"; far = "110,160,120"; mid = "80,130,100"; near = "55,100,80"; water = "";        motif = "pines";    seed = 8.8 },
    @{ slug = "spiritual";     sky1 = "250,180,110"; sky2 = "255,220,150"; sun = "255,245,200"; far = "200,130,80"; mid = "160,96,58";  near = "118,68,42"; water = "";        motif = "gopuram";  seed = 9.9 },
    @{ slug = "backwaters";    sky1 = "150,200,230"; sky2 = "210,235,240"; sun = "255,245,210"; far = "60,120,90";  mid = "40,95,75";   near = "28,70,58";  water = "70,140,150,45,100,115"; motif = "boat";    seed = 11.0 },
    @{ slug = "shopping";      sky1 = "235,140,130"; sky2 = "255,200,150"; sun = "255,230,180"; far = "120,70,80";  mid = "90,50,62";   near = "62,34,44";  water = "";        motif = "market";   seed = 12.1 },
    @{ slug = "nightlife";     sky1 = "35,45,90";    sky2 = "110,100,140"; sun = "240,240,220"; far = "50,45,80";   mid = "38,34,62";   near = "26,24,44";  water = "45,60,100,32,42,72"; motif = "neon";     seed = 13.2 }
)

$script:SeedState = 0
function Next-Rand {
    $script:SeedState = ($script:SeedState * 1103515245 + 12345) -band 0x7FFFFFFF
    return ($script:SeedState -shr 16) / 32767.0
}

function Parse-C([string]$csv) { $p = $csv.Split(','); return [System.Drawing.Color]::FromArgb(255, [int]$p[0], [int]$p[1], [int]$p[2]) }

function Draw-Sky($g, [System.Drawing.Color]$top, [System.Drawing.Color]$bottom) {
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)), (New-Object System.Drawing.Point(0, $Height)), $top, $bottom)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
}

function Draw-CelestialBody($g, [System.Drawing.Color]$color, [double]$sx, [double]$sy, [double]$rad) {
    $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, $color.R, $color.G, $color.B))
    $g.FillEllipse($glow, [single]($sx - $rad*2.2), [single]($sy - $rad*2.2), [single]($rad*4.4), [single]($rad*4.4))
    $glow.Dispose()
    $solid = New-Object System.Drawing.SolidBrush($color)
    $g.FillEllipse($solid, [single]($sx - $rad), [single]($sy - $rad), [single]($rad*2), [single]($rad*2))
    $solid.Dispose()
}

function Draw-Ridge($g, [double]$baseY, [double]$amp, [System.Drawing.Color]$color, [double]$seed) {
    $script:SeedState = [int]($seed * 100000) + 11
    $phase = (Next-Rand) * 6.28
    $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $f1 = 0.004 + (Next-Rand) * 0.003
    $f2 = 0.011 + (Next-Rand) * 0.004
    for ($x = 0.0; $x -le $Width; $x += 8) {
        $y = $baseY - $amp * (0.62 * [Math]::Sin($x * $f1 + $phase) + 0.38 * [Math]::Sin($x * $f2 + $phase * 2.17))
        $pts.Add((New-Object System.Drawing.PointF([single]$x, [single]$y)))
    }
    $pts.Add((New-Object System.Drawing.PointF([single]$Width, [single]$Height)))
    $pts.Add((New-Object System.Drawing.PointF([single]0, [single]$Height)))
    $brush = New-Object System.Drawing.SolidBrush($color)
    $g.FillPolygon($brush, [System.Drawing.PointF[]]$pts.ToArray())
    $brush.Dispose()
    return $null
}

function Draw-Palms($g, [double]$groundY, [double]$seed, [double]$scale) {
    $script:SeedState = [int]($seed * 100000) + 31
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 30, 25))
    for ($p = 0; $p -lt 2; $p++) {
        $bx = 110 + $p * (110 + (Next-Rand) * 40)
        $lean = ((Next-Rand) * 50) - 25
        $topY = $groundY - ((120 + (Next-Rand) * 50) * $scale)
        $g.FillPolygon($brush, @(
            (New-Object System.Drawing.PointF([single]($bx-6*$scale), [single]$groundY)),
            (New-Object System.Drawing.PointF([single]($bx+6*$scale), [single]$groundY)),
            (New-Object System.Drawing.PointF([single]($bx+$lean+3*$scale), [single]$topY)),
            (New-Object System.Drawing.PointF([single]($bx+$lean-3*$scale), [single]$topY))))
        $apexX = $bx + $lean; $apexY = $topY
        for ($f = 0; $f -lt 7; $f++) {
            $ang = -140 + $f * 40
            $rad = $ang * [Math]::PI / 180.0
            $len = (70 + (Next-Rand) * 25) * $scale
            $ex = $apexX + [Math]::Cos($rad) * $len
            $ey = $apexY + [Math]::Sin($rad) * $len * 0.55
            $ctlX = $apexX + [Math]::Cos($rad) * $len * 0.55
            $ctlY = $apexY + [Math]::Sin($rad) * $len * 0.5 - 10
            $pen = New-Object System.Drawing.Pen($brush.Color, [single](3.5 * $scale))
            $g.DrawBezier($pen, [single]$apexX, [single]$apexY, [single]$ctlX, [single]$ctlY, [single]$ctlX, [single]$ctlY, [single]$ex, [single]$ey)
            $pen.Dispose()
        }
    }
    $brush.Dispose()
}

function Draw-Motif($g, [string]$motif, [double]$groundY, [double]$seed) {
    $script:SeedState = [int]($seed * 100000)
    switch ($motif) {
        'forest' {
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 14, 34, 24))
            for ($i = 0; $i -lt 16; $i++) {
                $x = (Next-Rand) * $Width; $h = 50 + (Next-Rand) * 90
                $g.FillPolygon($b, @(
                    (New-Object System.Drawing.PointF([single]($x-12), [single]$groundY)),
                    (New-Object System.Drawing.PointF([single]($x+12), [single]$groundY)),
                    (New-Object System.Drawing.PointF([single]$x, [single]($groundY-$h)))))
            }
            $b.Dispose()
        }
        'palms' {
            Draw-Palms $g $groundY $seed 1.0
        }
        'fort' {
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 48, 34, 28))
            $x = $Width * 0.28; $w = 200; $h = 90
            $g.FillRectangle($b, [int]$x, [int]($groundY-$h), $w, $h)
            for ($i = 0; $i -lt 6; $i++) { $g.FillRectangle($b, [int]($x + $i*34), [int]($groundY-$h-9), 20, 9) }
            $g.FillRectangle($b, [int]($x+$w-44), [int]($groundY-$h-40), 30, 40)
            $b.Dispose()
        }
        'peaks' {
            # sharp triangular snow peaks over the ridges
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 248, 252))
            $p1 = @(
                (New-Object System.Drawing.PointF([single]($Width*0.10), [single]($groundY+10))),
                (New-Object System.Drawing.PointF([single]($Width*0.38), [single]($groundY-150))),
                (New-Object System.Drawing.PointF([single]($Width*0.66), [single]($groundY+10))))
            $g.FillPolygon($b, [System.Drawing.PointF[]]$p1)
            $b.Dispose()
        }
        'food' {
            # table line + steaming bowl
            $table = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 60, 34, 26))
            $g.FillRectangle($table, 0, [single]($groundY+6), [single]$Width, [single]($Height-$groundY))
            $bowl = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 22, 18))
            $g.FillPie($bowl, [single]($Width*0.40), [single]($groundY-64), 120, 120, 0, 180)
            $bowl.Dispose()
            $steam = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), [single]2.5)
            for ($i = 0; $i -lt 3; $i++) {
                $sx = $Width*0.5 + ($i-1)*16
                $g.DrawArc($steam, [single]($sx-12), [single]($groundY-130), 24, 30, 220, 140)
                $g.DrawArc($steam, [single]($sx-12), [single]($groundY-100), 24, 30, 220, 140)
            }
            $steam.Dispose(); $table.Dispose()
        }
        'stones' {
            # stacked spa stones
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 34, 28, 40))
            $cx = $Width * 0.5
            $g.FillEllipse($b, [single]($cx-66), [single]($groundY-44), 132, 40)
            $g.FillEllipse($b, [single]($cx-50), [single]($groundY-76), 100, 34)
            $g.FillEllipse($b, [single]($cx-34), [single]($groundY-102), 68, 28)
            $b.Dispose()
        }
        'camera' {
            # camera silhouette
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 20, 30))
            $cx = $Width * 0.5; $cy = $groundY - 66
            $g.FillRectangle($b, [single]($cx-64), [single]($cy-38), 128, 82)
            $g.FillRectangle($b, [single]($cx-34), [single]($cy-52), 44, 16)
            $ring = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 240, 210, 150))
            $g.FillEllipse($ring, [single]($cx-30), [single]($cy-14), 60, 60)
            $g.FillEllipse($b, [single]($cx-20), [single]($cy-4), 40, 40)
            $b.Dispose(); $ring.Dispose()
        }
        'pines' {
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 16, 34, 26))
            for ($i = 0; $i -lt 10; $i++) {
                $x = 40 + $i * 62 + ((Next-Rand) * 18)
                $h = 70 + (Next-Rand) * 60
                $g.FillPolygon($b, @(
                    (New-Object System.Drawing.PointF([single]($x-13), [single]$groundY)),
                    (New-Object System.Drawing.PointF([single]($x+13), [single]$groundY)),
                    (New-Object System.Drawing.PointF([single]$x, [single]($groundY-$h)))))
            }
            $b.Dispose()
        }
        'gopuram' {
            $t = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 60, 34, 24))
            $bx = $Width * 0.5; $by = $groundY + 4
            for ($tier = 0; $tier -lt 4; $tier++) {
                $tw = 150 - $tier * 32; $th = 26
                $g.FillPolygon($t, @(
                    (New-Object System.Drawing.PointF([single]($bx-$tw/2), [single]($by-$tier*$th))),
                    (New-Object System.Drawing.PointF([single]($bx+$tw/2), [single]($by-$tier*$th))),
                    (New-Object System.Drawing.PointF([single]($bx+$tw/2-12), [single]($by-($tier+1)*$th))),
                    (New-Object System.Drawing.PointF([single]($bx-$tw/2+12), [single]($by-($tier+1)*$th)))))
            }
            $t.Dispose()
        }
        'boat' {
            # houseboat silhouette
            $x = $Width * (0.3 + (Next-Rand) * 0.25); $y = $groundY - 18
            $hull = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 25, 22, 20))
            $roof = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 45, 35, 30))
            $g.FillPolygon($hull, @(
                (New-Object System.Drawing.PointF([single]($x-52), [single]$y)),
                (New-Object System.Drawing.PointF([single]($x+52), [single]$y)),
                (New-Object System.Drawing.PointF([single]($x+40), [single]($y+13))),
                (New-Object System.Drawing.PointF([single]($x-40), [single]($y+13))))
            )
            $g.FillRectangle($roof, [single]($x-32), [single]($y-32), [single]64, [single]32)
            $hull.Dispose(); $roof.Dispose()
        }
        'market' {
            # lantern strings + stalls
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 40, 24, 30))
            $g.FillRectangle($b, 0, [single]($groundY+10), [single]$Width, [single]($Height-$groundY))
            $g.FillRectangle($b, 40, [single]($groundY-38), 110, 48)
            $g.FillRectangle($b, 200, [single]($groundY-52), 130, 62)
            $g.FillRectangle($b, 380, [single]($groundY-42), 100, 52)
            $b.Dispose()
            $lamp = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 255, 210, 120))
            for ($i = 0; $i -lt 7; $i++) {
                $lx = 60 + $i * 76; $ly = 90 + [int](18 * [Math]::Sin($i * 1.1))
                $g.FillEllipse($lamp, [single]($lx-8), [single]($ly+8), 16, 20)
            }
            $lamp.Dispose()
        }
        'neon' {
            # night skyline + window lights
            $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 18, 34))
            $bars = @(60, 110, 160, 90, 140, 120, 70)
            $x = 0
            foreach ($h in $bars) {
                $g.FillRectangle($b, $x, [single]($groundY-$h), 90, [single]($h+40))
                $x += 92
            }
            $b.Dispose()
            $w = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 255, 200, 120))
            $script:SeedState = [int]($seed * 100000) + 5
            for ($i = 0; $i -lt 26; $i++) {
                $wx = (Next-Rand) * $Width; $wy = $groundY - 30 - (Next-Rand) * 100
                $g.FillRectangle($w, [single]$wx, [single]$wy, 7, 9)
            }
            $w.Dispose()
        }
    }
}

function Save-Jpeg($bitmap, [string]$path) {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)
    $bitmap.Save($path, $codec, $ep)
}

foreach ($scene in $Scenes) {
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = 'AntiAlias'

    $groundY = $Height * 0.62

    Draw-Sky $g (Parse-C $scene.sky1) (Parse-C $scene.sky2)
    Draw-CelestialBody $g (Parse-C $scene.sun) ($Width * 0.74) ($Height * 0.28) ($Width * 0.05)

    Draw-Ridge $g ($groundY - 10) 46 (Parse-C $scene.far) ($scene.seed + 1.1) | Out-Null
    Draw-Ridge $g $groundY 55 (Parse-C $scene.mid) ($scene.seed + 1.6) | Out-Null
    Draw-Ridge $g ($groundY + 30) 40 (Parse-C $scene.near) ($scene.seed + 2.2) | Out-Null

    if ($scene.water -ne '') {
        $wp = $scene.water.Split(',')
        $topW = [System.Drawing.Color]::FromArgb(255, [int]$wp[0], [int]$wp[1], [int]$wp[2])
        $botW = [System.Drawing.Color]::FromArgb(255, [int]$wp[3], [int]$wp[4], [int]$wp[5])
        $rect = New-Object System.Drawing.Rectangle(0, [int]($groundY + 30), $Width, [int]($Height - $groundY - 30))
        $wbrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.Point(0, [int]($groundY + 30))), (New-Object System.Drawing.Point(0, $Height)),
            $topW, $botW)
        $g.FillRectangle($wbrush, $rect)
        $wbrush.Dispose()
    }

    if ($scene.motif -eq 'palms' -or $scene.motif -eq 'boat') {
        Draw-Palms $g ($groundY + 20) $scene.seed 1.1 | Out-Null
    }
    Draw-Motif $g $scene.motif $groundY $scene.seed

    $out = Join-Path $OutDir ("{0}.jpg" -f $scene.slug)
    Save-Jpeg $bitmap $out
    Write-Host ("  created {0}" -f $out)
    $g.Dispose(); $bitmap.Dispose()
}
Write-Host "`nDone: $($Scenes.Count) interest images."
