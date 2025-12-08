@echo off
echo ====================================
echo BennSauce Game - Setup Assistant
echo ====================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version
echo.

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo ====================================
echo What would you like to do?
echo ====================================
echo 1. Start game in Electron (Development)
echo 2. Build Windows executable
echo 3. Build Linux AppImage (for Steam Deck)
echo 4. Build for all platforms
echo 5. Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Starting game...
    call npm start
) else if "%choice%"=="2" (
    echo.
    echo Building Windows executable...
    call npm run build:win
    echo.
    echo Build complete! Check the dist folder.
    pause
) else if "%choice%"=="3" (
    echo.
    echo Building Linux AppImage for Steam Deck...
    call npm run build:linux
    echo.
    echo Build complete! Check the dist folder.
    echo Transfer the .AppImage file to your Steam Deck!
    pause
) else if "%choice%"=="4" (
    echo.
    echo Building for all platforms (this may take a while)...
    call npm run build:all
    echo.
    echo Build complete! Check the dist folder.
    pause
) else if "%choice%"=="5" (
    exit /b 0
) else (
    echo Invalid choice!
    pause
)
