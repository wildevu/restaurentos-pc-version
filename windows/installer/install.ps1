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

# Grant minimum required permissions on DataPath (Modify for Users, Full for Administrators & SYSTEM)
try {
    icacls $DataPath /grant "BUILTIN\Users:(OI)(CI)M" /t /q 2>&1 | Out-Null
    Write-Log "Configured secure application permissions on data storage directory." "Green"
} catch {}

# 5. Copy Application Files from Package Root to InstallPath
$AppSource = $PSScriptRoot
if (Test-Path (Join-Path $PSScriptRoot "RestaurantOS\server.cjs")) {
    $AppSource = Join-Path $PSScriptRoot "RestaurantOS"
} elseif (Test-Path (Join-Path (Split-Path -Parent $PSScriptRoot) "RestaurantOS\server.cjs")) {
    $AppSource = Join-Path (Split-Path -Parent $PSScriptRoot) "RestaurantOS"
} elseif (Test-Path (Join-Path $PSScriptRoot "server.cjs")) {
    $AppSource = $PSScriptRoot
} else {
    $ParentDir = Split-Path -Parent $PSScriptRoot
    if (Test-Path (Join-Path $ParentDir "server.cjs")) {
        $AppSource = $ParentDir
    }
}

Write-Log "Copying core application binaries, runtime, and built PWA assets from $AppSource..."
$itemsToCopy = @("dist", "src", "public", "server.cjs", "package.json", "windows", "launch-hub.bat", "migrations", "runtime", "node_modules", "restaurantos.env.template")
foreach ($item in $itemsToCopy) {
    $src = Join-Path $AppSource $item
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

# 6. Configure Windows Firewall (TCP Port 8989 on Private, Domain, and Public Profiles)
Write-Log "Configuring Windows Firewall for restaurant LAN access on port 8989..."
try {
    netsh advfirewall firewall delete rule name="RestaurantOS Local Hub" 2>&1 | Out-Null
    netsh advfirewall firewall add rule name="RestaurantOS Local Hub" dir=in action=allow protocol=TCP localport=8989 profile=private,domain description="Allows waiter, kitchen, and manager devices to connect to RestaurantOS Local Hub" | Out-Null
    Write-Log "Windows Firewall configured successfully." "Green"
} catch {
    Write-Warning "Could not configure firewall automatically: $_"
}

# 7. Configure Background Service / Scheduled Startup Task
Write-Log "Registering Local Hub background startup service..."
$TaskName = "RestaurantOS Local Hub"
try {
    $SupervisorScript = Join-Path $InstallPath "windowsserviceun-hub-supervisor.ps1"
    if (-not (Test-Path $SupervisorScript)) {
        throw "RestaurantOS service supervisor is missing: $SupervisorScript"
    }
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$SupervisorScript`" -AppDir `"$InstallPath`" -DataDir `"$DataPath`"" -WorkingDirectory $InstallPath
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
        $Shortcut.TargetPath = "http://localhost:8989/hub"
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
    $StartShortcut.TargetPath = "http://localhost:8989/hub"
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
Write-Log "Local Web Address:    http://localhost:8989"
Write-Log "Hub Status Screen:    http://localhost:8989/hub"
Write-Log "================================================================" "Green"

if (-not $Silent) {
    Start-Process "http://localhost:8989/hub"
}
