# ==============================================================================
# RestaurantOS Local Hub - Native Windows Installer & Provisioning Engine
# Compatible with Windows 10, Windows 11, and Windows Server 2016+ (64-bit)
# ==============================================================================

param(
    [string]$InstallPath = "$env:ProgramFiles\RestaurantOS",
    [string]$DataPath = "$env:ProgramData\RestaurantOS",
    [switch]$Silent
)

$ErrorActionPreference = "Stop"

function Write-Log($msg, $color = "Cyan") {
    if (-not $Silent) {
        Write-Host "[RestaurantOS Installer] $msg" -ForegroundColor $color
    }
}

# 1. Admin Privileges Check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Administrator privileges are required to install RestaurantOS Local Hub. Please run as Administrator."
    exit 1
}

# 2. Operating System & Architecture Check
$is64Bit = [Environment]::Is64BitOperatingSystem
if (-not $is64Bit) {
    Write-Error "RestaurantOS requires a 64-bit version of Windows 10, Windows 11, or Windows Server 2016+."
    exit 1
}

$osVersion = [Environment]::OSVersion.Version
if ($osVersion.Major -lt 10) {
    Write-Warning "Detected legacy Windows version ($($osVersion.Major).$($osVersion.Minor)). RestaurantOS is optimized and verified for Windows 10 and 11."
}

Write-Log "Initializing RestaurantOS Local Hub Installation..." "Green"
Write-Log "Application Target: $InstallPath"
Write-Log "Data & Storage Target: $DataPath"

# 3. Create Application Directory (C:\Program Files\RestaurantOS)
if (-not (Test-Path $InstallPath)) {
    New-Item -Path $InstallPath -ItemType Directory -Force | Out-Null
}

# 4. Create Data Directory (C:\ProgramData\RestaurantOS) with Subdirectories
# STRICT SAFETY: If directories already exist, we DO NOT modify or purge their contents!
$subDirs = @("data", "backups", "logs", "config")
foreach ($sub in $subDirs) {
    $dir = Join-Path $DataPath $sub
    if (-not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
        Write-Log "Created data directory: $dir"
    } else {
        Write-Log "Preserving existing data directory: $dir" "Yellow"
    }
}

# 5. Copy Application Files from Package Root to InstallPath
$SourceDir = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $SourceDir "server.cjs"))) {
    $SourceDir = Split-Path -Parent $SourceDir
}

Write-Log "Copying core application binaries and built PWA assets..."
$itemsToCopy = @("dist", "src", "public", "server.cjs", "package.json", "windows", "launch-hub.bat", "migrations")
foreach ($item in $itemsToCopy) {
    $src = Join-Path $SourceDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $InstallPath -Recurse -Force | Out-Null
    }
}

# Ensure launcher is in root of install directory
$rootLauncher = Join-Path $InstallPath "launch-hub.bat"
if (-not (Test-Path $rootLauncher)) {
    $nestedLauncher = Join-Path $InstallPath "windows\launcher\launch-hub.bat"
    if (Test-Path $nestedLauncher) {
        Copy-Item -Path $nestedLauncher -Destination $rootLauncher -Force | Out-Null
    }
}

# 6. Configure Windows Firewall (TCP Port 3000 on Private/Domain Profiles)
Write-Log "Configuring Windows Firewall for restaurant LAN access on port 3000..."
try {
    netsh advfirewall firewall delete rule name="RestaurantOS Local Hub" 2>&1 | Out-Null
    netsh advfirewall firewall add rule name="RestaurantOS Local Hub" dir=in action=allow protocol=TCP localport=3000 profile=private,domain description="Allows waiter, kitchen, and manager devices to connect to RestaurantOS Local Hub" | Out-Null
    Write-Log "Windows Firewall configured successfully." "Green"
} catch {
    Write-Warning "Could not configure firewall automatically: $_"
}

# 7. Configure Background Service / Scheduled Startup Task
Write-Log "Registering Local Hub background startup service..."
$TaskName = "RestaurantOS Local Hub"
try {
    $Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$rootLauncher`"" -WorkingDirectory $InstallPath
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
    
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -User "SYSTEM" -RunLevel Highest -Description "RestaurantOS Local Hub Background Service for restaurant LAN synchronization." | Out-Null
    Write-Log "Automatic startup task configured." "Green"
} catch {
    Write-Warning "Task registration warning: $_"
}

# 8. Create Desktop and Start Menu Shortcuts
try {
    $WScriptShell = New-Object -ComObject WScript.Shell
    
    # Desktop Shortcut
    $DesktopPath = [Environment]::GetFolderPath("CommonDesktopDirectory")
    if (Test-Path $DesktopPath) {
        $Shortcut = $WScriptShell.CreateShortcut((Join-Path $DesktopPath "RestaurantOS Local Hub.lnk"))
        $Shortcut.TargetPath = "http://localhost:3000/hub"
        $Shortcut.Description = "Open RestaurantOS Local Hub Access & Status Screen"
        $Shortcut.Save()
    }

    # Start Menu Shortcut
    $StartMenuPath = [Environment]::GetFolderPath("CommonStartMenu")
    $ProgramsPath = Join-Path $StartMenuPath "Programs\RestaurantOS"
    if (-not (Test-Path $ProgramsPath)) {
        New-Item -Path $ProgramsPath -ItemType Directory -Force | Out-Null
    }
    $StartShortcut = $WScriptShell.CreateShortcut((Join-Path $ProgramsPath "RestaurantOS Local Hub.lnk"))
    $StartShortcut.TargetPath = "http://localhost:3000/hub"
    $StartShortcut.Description = "Open RestaurantOS Local Hub Access & Status Screen"
    $StartShortcut.Save()
    
    Write-Log "Desktop and Start Menu shortcuts created." "Green"
} catch {
    Write-Log "Shortcut creation note: $_" "Yellow"
}

# 9. Start the Service / Task
try {
    Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
} catch {}

Write-Log "================================================================" "Green"
Write-Log "   RESTAURANTOS LOCAL HUB INSTALLED SUCCESSFULLY!               " "Green"
Write-Log "================================================================" "Green"
Write-Log "Application directory: $InstallPath"
Write-Log "Database & Backups:   $DataPath"
Write-Log "Local Web Address:    http://localhost:3000"
Write-Log "Hub Status Screen:    http://localhost:3000/hub"
Write-Log "================================================================" "Green"

if (-not $Silent) {
    Start-Process "http://localhost:3000/hub"
}
