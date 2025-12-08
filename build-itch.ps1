# BennSauce - itch.io Build Script
# This script copies all necessary files for the web version to a versioned folder

$sourceDir = $PSScriptRoot

# Extract version from index.html
$indexPath = Join-Path $sourceDir "index.html"
$version = "unknown"

if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    if ($indexContent -match '<title>BennSauce v([0-9.]+)</title>') {
        $version = $Matches[1]
    }
}

$folderName = "BennSauce_v$version"
$buildDir = Join-Path $sourceDir $folderName

Write-Host "Building itch.io package..." -ForegroundColor Cyan
Write-Host "Version: $version" -ForegroundColor Magenta
Write-Host "Source: $sourceDir"
Write-Host "Destination: $buildDir"

# Create build directory
if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

# Clean the build directory
Write-Host "`nCleaning build directory..." -ForegroundColor Yellow
Get-ChildItem -Path $buildDir -Recurse | Remove-Item -Recurse -Force

# Define the JavaScript files needed
$jsFiles = @(
    "accessibilityManager.js",
    "audio.js",
    "constants.js",
    "data.js",
    "errorHandler.js",
    "eventManager.js",
    "firebase-config.js",
    "game.js",
    "gamepadManager.js",
    "ghostPlayers.js",
    "inputDisplayManager.js",
    "inputManager.js",
    "keyMappingManager.js",
    "memoryManager.js",
    "monsters.js",
    "network.js",
    "objectPools.js",
    "performanceMonitor.js",
    "player.js",
    "spatialGrid.js",
    "socketClient.js",  # ← ADDED THIS (CRITICAL!)
    "ui.js"
)

# Copy HTML and CSS
Write-Host "`nCopying core files..." -ForegroundColor Yellow
Copy-Item (Join-Path $sourceDir "index.html") -Destination $buildDir
Copy-Item (Join-Path $sourceDir "styles.css") -Destination $buildDir

# Copy JavaScript files
Write-Host "Copying JavaScript files..." -ForegroundColor Yellow
foreach ($file in $jsFiles) {
    $sourcePath = Join-Path $sourceDir $file
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath -Destination $buildDir
        Write-Host "  Copied: $file" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: $file not found!" -ForegroundColor Red
    }
}

# Copy entire assets folder (fonts, art, audio, etc.)
Write-Host "`nCopying assets folder..." -ForegroundColor Yellow
$sourceAssetsDir = Join-Path $sourceDir "assets"
$destAssetsDir = Join-Path $buildDir "assets"

if (Test-Path $sourceAssetsDir) {
    # Create assets directory structure
    New-Item -ItemType Directory -Path $destAssetsDir -Force | Out-Null
    
    # Copy all subdirectories and files
    Copy-Item -Path "$sourceAssetsDir\*" -Destination $destAssetsDir -Recurse -Force
    
    $assetFileCount = (Get-ChildItem -Path $destAssetsDir -Recurse -File).Count
    Write-Host "  Copied: $assetFileCount asset files" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Assets directory not found!" -ForegroundColor Red
}

# Copy any additional root-level files you might have
Write-Host "`nCopying additional files..." -ForegroundColor Yellow
$additionalFiles = @(
    "README.md",
    "CREDITS.md",
    "favicon.ico"
)

foreach ($file in $additionalFiles) {
    $sourcePath = Join-Path $sourceDir $file
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath -Destination $buildDir
        Write-Host "  Copied: $file" -ForegroundColor Green
    }
}

# Count files in build
$fileCount = (Get-ChildItem -Path $buildDir -Recurse -File).Count
$folderSize = [math]::Round((Get-ChildItem -Path $buildDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Output folder: $folderName" -ForegroundColor Magenta
Write-Host "Total files: $fileCount"
Write-Host "Total size: $folderSize MB"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nTo deploy to itch.io:"
Write-Host "1. Right-click the '$folderName' folder → Send to → Compressed (zipped) folder"
Write-Host "2. Upload the zip to your itch.io project"
Write-Host "3. Check 'This file will be played in the browser'" -ForegroundColor Yellow
Write-Host "4. Set viewport dimensions (recommended: 1366 x 768)" -ForegroundColor Yellow
Write-Host "5. Make sure your Render.com server is running!" -ForegroundColor Cyan