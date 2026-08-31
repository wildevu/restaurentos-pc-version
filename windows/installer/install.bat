@echo off
setlocal
title RestaurantOS Local Hub Installer

:: Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges required.
    echo Please right-click install.bat and select "Run as administrator".
    pause
    exit /b 1
)

echo Starting RestaurantOS Local Hub Installation...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

if %errorlevel% neq 0 (
    echo [ERROR] Installation encountered an error (Code: %errorlevel%).
    pause
    exit /b %errorlevel%
)

pause
