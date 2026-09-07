@echo off
setlocal enabledelayedexpansion

:: ========================================================
:: RestaurantOS - 1-Click Quick Repair & Troubleshooter
:: Fixes port 3000 conflicts, terminates frozen background
:: engines, clears stale locks, and restarts RestaurantOS
:: ========================================================

title RestaurantOS - Quick Repair & Troubleshooter
color 0A

echo ========================================================
echo       RESTAURANTOS LOCAL HUB - QUICK REPAIR
echo ========================================================
echo.
echo [1/4] Checking for frozen or conflicting background processes...

:: 1. Terminate any process locking port 3000
set FOUND_PORT_CONFLICT=0
for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    set /a PID_NUM=%%a
    if !PID_NUM! gtr 0 (
        echo   - Terminating background process locking Port 3000 (PID: %%a)...
        taskkill /F /PID %%a >nul 2>&1
        set FOUND_PORT_CONFLICT=1
    )
)

if "!FOUND_PORT_CONFLICT!"=="0" (
    echo   - Port 3000 is clean and unblocked.
) else (
    echo   - Port 3000 successfully freed!
)

:: 2. Terminate any orphan node.exe running from RestaurantOS folder
taskkill /F /IM node.exe /FI "WINDOWTITLE eq RestaurantOS*" >nul 2>&1

echo.
echo [2/4] Cleaning temporary process locks and files...
if defined ProgramData (
    set RESTAURANTOS_DATA_DIR=%ProgramData%\RestaurantOS
) else (
    set RESTAURANTOS_DATA_DIR=C:\ProgramData\RestaurantOS
)

if exist "%RESTAURANTOS_DATA_DIR%\restaurantos.pid" (
    del /f /q "%RESTAURANTOS_DATA_DIR%\restaurantos.pid" >nul 2>&1
    echo   - Cleared stale restaurantos.pid
)
if exist "%RESTAURANTOS_DATA_DIR%\restaurantos.lock" (
    del /f /q "%RESTAURANTOS_DATA_DIR%\restaurantos.lock" >nul 2>&1
    echo   - Cleared stale restaurantos.lock
)

echo.
echo [3/4] Verifying network readiness...
timeout /t 2 /nobreak >nul

echo.
echo [4/4] Restarting RestaurantOS Local Hub...
set APP_DIR=%~dp0
if exist "%APP_DIR%RestaurantOS.exe" (
    start "" "%APP_DIR%RestaurantOS.exe"
    echo   - Launched RestaurantOS.exe!
) else if exist "%APP_DIR%launch-hub.bat" (
    start "" "%APP_DIR%launch-hub.bat"
    echo   - Launched launch-hub.bat!
) else (
    echo   - Launching browser at http://localhost:3000/hub ...
    start "" "http://localhost:3000/hub"
)

echo.
echo ========================================================
echo   Auto-Repair Complete! RestaurantOS is ready.
echo ========================================================
echo.
timeout /t 4 >nul
exit /b 0
