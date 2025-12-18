# BennSauce - Push All Repositories
# This script pushes changes to BOTH the main game repo and the game-server repo
# Run this instead of manual git push to ensure all changes are deployed

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BennSauce - Push All Repositories" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Store the root directory
$rootDir = $PSScriptRoot

# ==========================================
# MAIN REPO (Client - Vercel)
# ==========================================
Write-Host "[1/2] Main Repository (Client -> Vercel)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Set-Location $rootDir

# Check for changes
$mainStatus = git status --porcelain
if ($mainStatus) {
    Write-Host "Uncommitted changes detected in main repo:" -ForegroundColor Red
    git status --short
    Write-Host ""
    $commitMsg = Read-Host "Enter commit message for main repo (or press Enter to skip)"
    if ($commitMsg) {
        git add -A
        git commit -m $commitMsg
    } else {
        Write-Host "Skipping main repo commit..." -ForegroundColor Gray
    }
}

# Push main repo
Write-Host "Pushing main repo to origin..." -ForegroundColor Green
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Main repo pushed successfully! (Vercel will auto-deploy)" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to push main repo" -ForegroundColor Red
}
Write-Host ""

# ==========================================
# GAME SERVER REPO (Server - Render)
# ==========================================
Write-Host "[2/2] Game Server Repository (Server -> Render)" -ForegroundColor Yellow
Write-Host "------------------------------------------------" -ForegroundColor Yellow
Set-Location "$rootDir\game-server"

# Check for changes
$serverStatus = git status --porcelain
if ($serverStatus) {
    Write-Host "Uncommitted changes detected in game-server:" -ForegroundColor Red
    git status --short
    Write-Host ""
    $commitMsg = Read-Host "Enter commit message for game-server (or press Enter to skip)"
    if ($commitMsg) {
        git add -A
        git commit -m $commitMsg
    } else {
        Write-Host "Skipping game-server commit..." -ForegroundColor Gray
    }
}

# Push server repo
Write-Host "Pushing game-server to origin..." -ForegroundColor Green
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Game server pushed successfully! (Render will auto-deploy)" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to push game-server" -ForegroundColor Red
}

# Return to root
Set-Location $rootDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Main Repo:   https://github.com/the-damkeeper/bennsauce-game.git" -ForegroundColor White
Write-Host "             -> Deploys to Vercel (client)" -ForegroundColor Gray
Write-Host ""
Write-Host "Server Repo: https://github.com/the-damkeeper/bennsauce-game-server.git" -ForegroundColor White
Write-Host "             -> Deploys to Render (game server)" -ForegroundColor Gray
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
