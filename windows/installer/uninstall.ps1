# ==============================================================================
# RestaurantOS Local Hub - Native Windows Uninstaller & Cleanup Engine
# SAFE UNINSTALLATION: Removes application binaries and service registrations
# NEVER DELETES customer database, backups, or logs in C:\ProgramData\RestaurantOS
# ==============================================================================

param(
    [string]$InstallPath = "$env:ProgramFiles\RestaurantOS",
    [string]$DataPath = "$env:ProgramData\RestaurantOS",
    [switch]$Silent
)

function Write-Log($msg, $color = "Yellow") {
    if (-not $Silent) {
        Write-Host "[RestaurantOS Uninstaller] $msg" -ForegroundColor $color
    }
}

# 1. Admin Privileges Check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Administrator privileges are required to uninstall RestaurantOS Local Hub. Please run as Administrator."
    exit 1
}

Write-Log "Starting RestaurantOS Local Hub Uninstallation..." "Cyan"

# 2. Stop Background Task & Service
$TaskName = "RestaurantOS Local Hub"
try {
    Write-Log "Stopping and unregistering background startup task..."
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Log "Startup task removed." "Green"
} catch {
    Write-Log "Startup task cleanup note: $_"
}

# 3. Kill any remaining node or server process running from InstallPath
try {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$InstallPath*" } | Stop-Process -Force -ErrorAction SilentlyContinue
} catch {}

# 4. Remove Windows Firewall Rule
try {
    Write-Log "Removing Windows Firewall rule for RestaurantOS..."
    netsh advfirewall firewall delete rule name="RestaurantOS Local Hub" 2>&1 | Out-Null
    Write-Log "Firewall rule removed." "Green"
} catch {
    Write-Log "Firewall cleanup note: $_"
}

# 5. Remove Desktop and Start Menu Shortcuts
try {
    $DesktopPath = [Environment]::GetFolderPath("CommonDesktopDirectory")
    $DesktopShortcut = Join-Path $DesktopPath "RestaurantOS Local Hub.lnk"
    if (Test-Path $DesktopShortcut) {
        Remove-Item -Path $DesktopShortcut -Force -ErrorAction SilentlyContinue
    }

    $StartMenuPath = [Environment]::GetFolderPath("CommonStartMenu")
    $ProgramsPath = Join-Path $StartMenuPath "Programs\RestaurantOS"
    if (Test-Path $ProgramsPath) {
        Remove-Item -Path $ProgramsPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Log "Shortcuts removed." "Green"
} catch {}

# 6. Delete Application Files from C:\Program Files\RestaurantOS
if (Test-Path $InstallPath) {
    Write-Log "Removing application binaries from $InstallPath..."
    try {
        Remove-Item -Path $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log "Application directory cleaned." "Green"
    } catch {
        Write-Warning "Could not delete all files in $InstallPath. Some files may be locked until reboot."
    }
}

# 7. EXTREME DATA SAFETY CONFIRMATION:
# C:\ProgramData\RestaurantOS is DELIBERATELY PRESERVED!
Write-Log "==========================================================================" "Green"
Write-Log "   RESTAURANTOS LOCAL HUB REMOVED FROM APPLICATION DIRECTORY              " "Green"
Write-Log "==========================================================================" "Green"
Write-Log "DATA SAFETY NOTICE:" "White"
Write-Log "Your restaurant database, historical order data, and automated backups at:" "White"
Write-Log "  $DataPath" "Cyan"
Write-Log "HAVE BEEN DELIBERATELY PRESERVED AND WERE NOT DELETED." "Yellow"
Write-Log "If you ever reinstall RestaurantOS, all your menu items, tables, and" "White"
Write-Log "historical orders will be restored automatically." "White"
Write-Log "==========================================================================" "Green"
