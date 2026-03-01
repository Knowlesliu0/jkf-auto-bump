@echo off
echo =========================================
echo       JKF Auto-Bump System Startup
echo =========================================
echo.

:: Start Backend API in a new window
echo [SERVER] Starting Backend Server (Port 3001)...
start "JKF Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Wait a brief moment to let backend initialize
timeout /t 3 /nobreak >nul

:: Start Frontend Vite Server in a new window
echo [SERVER] Starting Frontend Server (Port 5173)...
start "JKF Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Wait for Vite to start up
timeout /t 4 /nobreak >nul

:: Open the default web browser to the dashboard
echo [BROWSER] Opening Dashboard in browser...
start http://localhost:5173

echo.
echo All services have been started!
echo You can close this particular window, but DO NOT close the two new "JKF Backend" and "JKF Frontend" black command windows that just opened.
echo.
pause
