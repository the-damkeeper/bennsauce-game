@echo off
echo Starting BennSauce local development server...
echo.
echo Client will be available at: http://localhost:8080
echo Press Ctrl+C to stop the server
echo.
npx http-server -p 8080 -c-1
