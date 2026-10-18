# RestaurantOS Local Hub - PowerShell Uninstaller Script
# Must be executed as Administrator

param (
    [string]$AppDir = "C:\Program Files\RestaurantOS",
    [string]$DataPath = "C:\ProgramData\RestaurantOS"
)

Write-Host "===================================================="
Write-Host "   RESTAURANTOS LOCAL HUB — UNINSTALLATION PROCESS   "
Write-Host "===================================================="

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Administrator privileges required to uninstall RestaurantOS Local Hub."
    exit 1
}

# Stop scheduled supervisors first so they cannot restart the hub during removal.
foreach ($TaskName in @("RestaurantOS Local Hub", "RestaurantOS-LocalHub")) {
    try {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    } catch {}
}

# Stop any directly launched supervisor, but only if its command line references this install.
$SupervisorScript = [System.IO.Path]::GetFullPath((Join-Path $AppDir "windows\service\run-hub-supervisor.ps1"))
try {
    $supervisors = Get-CimInstance -ClassName Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue
    foreach ($proc in $supervisors) {
        if ($proc.ProcessId -ne $PID -and $proc.CommandLine -and
            $proc.CommandLine.IndexOf($SupervisorScript, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Stop-Process -Id ([int]$proc.ProcessId) -Force -ErrorAction SilentlyContinue
        }
    }
} catch {
    Write-Warning "Could not inspect all supervisor processes: $_"
}

Write-Host "Stopping all active RestaurantOS background processes..."
try {
    Get-Process -Name "RestaurantOS" -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($AppDir, [System.StringComparison]::OrdinalIgnoreCase) } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($AppDir, [System.StringComparison]::OrdinalIgnoreCase) } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} catch {
    Write-Warning "Note stopping processes: $_"
}

# Remove app firewall rules only; preserve restaurant data.
try {
    Write-Host "Removing Windows Firewall rule for RestaurantOS Local Hub..."
    Remove-NetFirewallRule -DisplayName "RestaurantOS Local Hub (Inbound TCP 8989)" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "RestaurantOS Local Hub" -ErrorAction SilentlyContinue
} catch {}

try {
    Write-Host "Removing Desktop & Start Menu shortcuts..."
    Remove-Item "C:\Users\Public\Desktop\RestaurantOS Local Hub.lnk" -Force -ErrorAction SilentlyContinue
    Remove-Item "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\RestaurantOS" -Recurse -Force -ErrorAction SilentlyContinue
} catch {}

# Remove application binaries only. ProgramData is deliberately preserved.
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

Write-Host "===================================================="
Write-Host "DATA SAFETY NOTICE:"
Write-Host "Your restaurant database, menu items, order history, and backups in:"
Write-Host "  $DataPath"
Write-Host "HAVE BEEN DELIBERATELY PRESERVED."
Write-Host "They will be automatically restored if you reinstall RestaurantOS."
Write-Host "===================================================="
exit 0
