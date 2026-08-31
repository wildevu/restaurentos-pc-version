# RestaurantOS Local Hub - Windows Background Service & Auto-Start Removal

$TaskName = "RestaurantOS Local Hub"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Administrator privileges are required. Please run as Administrator."
    exit 1
}

Write-Host "Stopping and unregistering RestaurantOS Local Hub startup task..." -ForegroundColor Yellow

# Stop the task if running
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# Unregister scheduled task
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "RestaurantOS Local Hub startup task removed." -ForegroundColor Green
