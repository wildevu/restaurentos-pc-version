@echo off
:: RestaurantOS Local Hub - Batch Uninstaller Wrapper
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges required.
    exit /b 1
)

echo Forcefully terminating running RestaurantOS processes...
taskkill /F /IM RestaurantOS.exe >nul 2>&1
taskkill /F /FI "MODULES eq node.exe" >nul 2>&1

echo Executing RestaurantOS PowerShell Uninstaller...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" -AppDir "C:\Program Files\RestaurantOS" -DataPath "C:\ProgramData\RestaurantOS"

echo [SUCCESS] RestaurantOS Local Hub uninstallation complete.
