@echo off
title SafeRoute
echo ==========================================
echo   SafeRoute - Smart Road Trip Planner
echo ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install it from https://nodejs.org  ^(LTS version^)
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies - first run only, please wait...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

echo.
echo Starting SafeRoute... your browser URL will appear below.
echo Press Ctrl+C to stop the server.
echo.
call npm run dev
pause
