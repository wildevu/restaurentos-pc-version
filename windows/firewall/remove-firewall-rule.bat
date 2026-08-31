@echo off
:: RestaurantOS Local Hub - Windows Firewall Inbound Rule Removal
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges required. Please Right-Click and choose "Run as Administrator".
    pause
    exit /b 1
)

echo Removing Windows Firewall rule for RestaurantOS Local Hub...
netsh advfirewall firewall delete rule name="RestaurantOS Local Hub" >nul 2>&1
echo [SUCCESS] Windows Firewall rule removed.
