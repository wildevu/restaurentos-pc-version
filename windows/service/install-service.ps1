# RestaurantOS Local Hub - Windows Background Service & Auto-Start Configuration
# Configures the hub to start automatically on system boot and recover on failures silently

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

# Determine the cleanest silent executable path
$SupervisorScript = Join-Path $AppDir (Join-Path "windows" (Join-Path "service" "run-hub-supervisor.ps1"))
if (-not (Test-Path $SupervisorScript)) {
    Write-Error "The Local Hub supervisor script is missing: $SupervisorScript"
    exit 1
}
$TaskArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -AppDir "{1}" -DataDir "{2}"' -f $SupervisorScript, $AppDir, $DataDir
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $TaskArguments -WorkingDirectory $AppDir

$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)

# Unregister any existing task with same name
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Register the new task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -User "SYSTEM" -RunLevel Highest -Description "RestaurantOS Local Hub Background Service for restaurant LAN synchronization and PWA serving."

Write-Host "Automatic startup task '$TaskName' registered successfully." -ForegroundColor Green
