@echo off
setlocal
chcp 65001 > nul

cd /d "%~dp0"
set "AIS_PORT=3030"

echo.
echo ==========================================
echo AIS scraper launcher
echo ==========================================
echo.

where node > nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

echo Starting AIS server on http://localhost:%AIS_PORT%
start "" powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%AIS_PORT%'" > nul 2>&1

set "PORT=%AIS_PORT%"
node server.js

echo.
echo [WARN] AIS server stopped.
pause
exit /b 0
