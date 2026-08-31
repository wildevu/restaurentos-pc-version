# RestaurantOS Local Hub - Windows Background Service & Auto-Start Configuration
# Configures the hub to start automatically on system boot and recover on failures

param(
    [string]$AppDir = "$env:ProgramFiles\RestaurantOS",
    [string]$DataDir = "$env:ProgramData\RestaurantOS"
)

$ServiceName = "RestaurantOSHub"
$TaskName = "RestaurantOS Local Hub"

# Check administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Administrator privileges are required to configure Windows Service. Please run as Administrator."
    exit 1
}

Write-Host "Configuring RestaurantOS Local Hub automatic startup..." -ForegroundColor Cyan

# Prepare launcher path
$LauncherScript = Join-Path $AppDir "launch-hub.bat"
if (-not (Test-Path $LauncherScript)) {
    Write-Warning "Launcher script not found at $LauncherScript. Using default node runner."
}

# 1. Create or update Windows Task Scheduler entry for robust on-boot start
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$LauncherScript`"" -WorkingDirectory $AppDir
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)

# Unregister any existing task with same name
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Register the new task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -User "SYSTEM" -RunLevel Highest -Description "RestaurantOS Local Hub Background Service for restaurant LAN synchronization and PWA serving."

Write-Host "Automatic startup task '$TaskName' registered successfully." -ForegroundColor Green
