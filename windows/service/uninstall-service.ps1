# RestaurantOS Local Hub - Windows Background Service & Auto-Start Removal

param(
    [string]$AppDir = "$env:ProgramFiles\RestaurantOS"
)

$TaskName = "RestaurantOS Local Hub"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Administrator privileges are required. Please run as Administrator."
    exit 1
}

Write-Host "Stopping and unregistering RestaurantOS Local Hub startup task..." -ForegroundColor Yellow
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

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

try {
    Write-Host "Terminating active RestaurantOS background processes..." -ForegroundColor Yellow
    Get-Process -Name "node", "RestaurantOS" -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($AppDir, [System.StringComparison]::OrdinalIgnoreCase) } |
        Stop-Process -Force -ErrorAction SilentlyContinue
} catch {}

Write-Host "RestaurantOS Local Hub startup task and background processes removed." -ForegroundColor Green
