# RestaurantOS Local Hub - PowerShell Uninstaller Script
# Must be executed as Administrator

param (
    [string]$AppDir = "C:\Program Files\RestaurantOS",
    [string]$DataPath = "C:\ProgramData\RestaurantOS"
)

Write-Host "===================================================="
Write-Host "   RESTAURANTOS LOCAL HUB — UNINSTALLATION PROCESS   "
Write-Host "===================================================="

# Test Administrator Privilege
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Administrator privileges required to uninstall RestaurantOS Local Hub."
    exit 1
}

# 1. Forcefully terminate active RestaurantOS and Node.js processes running from AppDir
Write-Host "Stopping all active RestaurantOS background processes..."
try {
    Get-Process -Name "RestaurantOS" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$AppDir*" -or $_.Path -like "*RestaurantOS*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} catch {
    Write-Warning "Note stopping processes: $_"
}

# 2. Stop and remove Windows auto-start Scheduled Task or Service
try {
    Write-Host "Unregistering RestaurantOS Local Hub startup tasks..."
    Stop-ScheduledTask -TaskName "RestaurantOS Local Hub" -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "RestaurantOS Local Hub" -Confirm:$false -ErrorAction SilentlyContinue
    Stop-ScheduledTask -TaskName "RestaurantOS-LocalHub" -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "RestaurantOS-LocalHub" -Confirm:$false -ErrorAction SilentlyContinue
} catch {}

# 3. Remove Windows Firewall Rule
try {
    Write-Host "Removing Windows Firewall rule for RestaurantOS Local Hub..."
    Remove-NetFirewallRule -DisplayName "RestaurantOS Local Hub (Inbound TCP 8989)" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "RestaurantOS Local Hub" -ErrorAction SilentlyContinue
} catch {}

# 4. Delete Desktop & Start Menu Shortcuts
try {
    Write-Host "Removing Desktop and Start Menu shortcuts..."
    Remove-Item "C:\Users\Public\Desktop\RestaurantOS Local Hub.lnk" -Force -ErrorAction SilentlyContinue
    Remove-Item "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\RestaurantOS" -Recurse -Force -ErrorAction SilentlyContinue
} catch {}

# 5. Safely remove application binaries from Program Files ONLY
if (Test-Path $AppDir) {
    Write-Host "Removing application installation directory: $AppDir..."
    try {
        Remove-Item -Path $AppDir -Recurse -Force -ErrorAction Stop
        Write-Host "Application installation directory removed successfully."
    } catch {
        Write-Warning "Could not remove all files in $AppDir ($($_.Exception.Message)). Some files may be removed upon system reboot."
    }

    if (Test-Path $AppDir) {
        Write-Error "Uninstallation incomplete: $AppDir still exists."
        exit 1
    }
}

# 6. DATA SAFETY GUARANTEE: Explicitly preserve ProgramData
Write-Host "===================================================="
Write-Host "DATA SAFETY NOTICE:"
Write-Host "Your restaurant database, menu items, order history, and backups in:"
Write-Host "  $DataPath"
Write-Host "HAVE BEEN DELIBERATELY PRESERVED."
Write-Host "They will be automatically restored if you reinstall RestaurantOS."
Write-Host "===================================================="

exit 0
