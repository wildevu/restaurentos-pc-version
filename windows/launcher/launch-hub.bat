@echo off
setlocal enabledelayedexpansion

:: RestaurantOS Local Hub Launcher
:: Sets environment variables and boots the bundled server engine

title RestaurantOS Local Hub

:: Set Production Environment Variables
set NODE_ENV=production
set PORT=8989

:: Resolve Application and Data Directories
set APP_DIR=%~dp0
if "%RESTAURANTOS_DATA_DIR%"=="" (
    if defined ProgramData (
        set RESTAURANTOS_DATA_DIR=%ProgramData%\RestaurantOS
    ) else (
        set RESTAURANTOS_DATA_DIR=C:\ProgramData\RestaurantOS
    )
)

:: Ensure Data Subdirectories Exist
if not exist "%RESTAURANTOS_DATA_DIR%" mkdir "%RESTAURANTOS_DATA_DIR%"
if not exist "%RESTAURANTOS_DATA_DIR%\data" mkdir "%RESTAURANTOS_DATA_DIR%\data"
if not exist "%RESTAURANTOS_DATA_DIR%\backups" mkdir "%RESTAURANTOS_DATA_DIR%\backups"
if not exist "%RESTAURANTOS_DATA_DIR%\logs" mkdir "%RESTAURANTOS_DATA_DIR%\logs"
if not exist "%RESTAURANTOS_DATA_DIR%\config" mkdir "%RESTAURANTOS_DATA_DIR%\config"

:: Check if bundled RestaurantOS.exe exists
if exist "%APP_DIR%RestaurantOS.exe" (
    start "" "%APP_DIR%RestaurantOS.exe" %*
    exit /b 0
)

:: Check if bundled node exists or system node
if exist "%APP_DIR%runtime\node.exe" (
    set NODE_EXE="%APP_DIR%runtime\node.exe"
) else if exist "%APP_DIR%\runtime\node.exe" (
    set NODE_EXE="%APP_DIR%\runtime\node.exe"
) else (
    set NODE_EXE=node
)

cd /d "%APP_DIR%"

echo ========================================================
echo   RESTAURANTOS LOCAL HUB - STARTING
echo ========================================================
echo Application Dir: %APP_DIR%
echo Data Dir:        %RESTAURANTOS_DATA_DIR%
echo Port:            %PORT%
echo ========================================================

%NODE_EXE% server.cjs

if %errorlevel% neq 0 (
    echo [ERROR] RestaurantOS Local Hub terminated with error code %errorlevel%.
    pause
)
