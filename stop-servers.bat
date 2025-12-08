@echo off
echo Stopping BennSauce Servers...
taskkill /F /IM node.exe >nul 2>&1
echo Servers stopped!
timeout /t 2
