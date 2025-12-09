@echo off
echo Starting BennSauce Servers...
echo.

:: Kill any existing processes on our ports (safer than killing all node.exe)
echo Stopping any existing servers on ports 3001 and 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

:: Wait a moment
timeout /t 2 /nobreak >nul

:: Start the game server (multiplayer) in a new window
echo Starting Game Server (port 3001)...
start "BennSauce Game Server" cmd /k "cd /d %~dp0game-server && node server.js"

:: Wait for game server to start
timeout /t 2 /nobreak >nul

:: Start the web server in a new window
echo Starting Web Server (port 8080)...
start "BennSauce Web Server" cmd /k "cd /d %~dp0 && npx serve -l 8080"

:: Wait a moment then open browser
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo Servers Started!
echo ========================================
echo Game Server: http://localhost:3001
echo Web Server:  http://localhost:8080
echo.
echo Opening game in browser...
start http://localhost:8080

echo.
echo Press any key to close this window (servers will keep running)
pause >nul
