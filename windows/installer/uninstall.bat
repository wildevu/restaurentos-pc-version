@echo off
setlocal
title RestaurantOS Local Hub Uninstaller

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges required.
    echo Please right-click uninstall.bat and select "Run as administrator".
    pause
    exit /b 1
)

echo Starting RestaurantOS Local Hub Uninstaller...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"

if %errorlevel% neq 0 (
    echo [ERROR] Uninstallation encountered an error.
    pause
    exit /b %errorlevel%
)

pause
