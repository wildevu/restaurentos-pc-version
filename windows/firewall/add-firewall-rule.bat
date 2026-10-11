@echo off
:: RestaurantOS Local Hub - Windows Firewall Inbound Rule Helper (Port 8989)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges required. Please Right-Click and choose "Run as Administrator".
    pause
    exit /b 1
)

echo Configuring Windows Firewall for RestaurantOS Local Hub on TCP Port 8989...
netsh advfirewall firewall delete rule name="RestaurantOS Local Hub" >nul 2>&1
netsh advfirewall firewall add rule name="RestaurantOS Local Hub" dir=in action=allow protocol=TCP localport=8989 profile=private,domain description="Allows waiter and kitchen devices to connect to RestaurantOS Local Hub"

if %errorlevel% equ 0 (
    echo [SUCCESS] Windows Firewall successfully configured for RestaurantOS (Port 8989).
) else (
    echo [WARNING] Failed to configure Windows Firewall. Error Code: %errorlevel%
)
