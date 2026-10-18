param(
    [string]$AppDir = "$env:ProgramFiles\RestaurantOS",
    [string]$DataDir = "$env:ProgramData\RestaurantOS",
    [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Continue"
$NodeExe = Join-Path $AppDir "runtime\node.exe"
$ServerScript = Join-Path $AppDir "server.cjs"
$LogDir = Join-Path $DataDir "logs"
$SupervisorLog = Join-Path $LogDir "hub-supervisor.log"

foreach ($dir in @($DataDir, (Join-Path $DataDir "data"), (Join-Path $DataDir "backups"), $LogDir, (Join-Path $DataDir "config"))) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
if (-not (Test-Path $NodeExe)) {
    Add-Content -Path $SupervisorLog -Value "[$(Get-Date -Format o)] FATAL: bundled Node runtime missing: $NodeExe"
    exit 2
}
if (-not (Test-Path $ServerScript)) {
    Add-Content -Path $SupervisorLog -Value "[$(Get-Date -Format o)] FATAL: server bundle missing: $ServerScript"
    exit 2
}

$env:NODE_ENV = "production"
$env:PORT = "8989"
$env:RESTAURANTOS_DATA_DIR = $DataDir
$env:DB_PATH = Join-Path (Join-Path $DataDir "data") "restaurantos.db"
$env:BACKUP_DIR = Join-Path $DataDir "backups"
$env:LOG_DIR = $LogDir

while ($true) {
    Add-Content -Path $SupervisorLog -Value "[$(Get-Date -Format o)] Starting RestaurantOS Local Hub."
    try {
        & $NodeExe $ServerScript *>> $SupervisorLog
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
        Add-Content -Path $SupervisorLog -Value "[$(Get-Date -Format o)] Supervisor caught launch error: $_"
    }

    Add-Content -Path $SupervisorLog -Value "[$(Get-Date -Format o)] Hub exited (code $exitCode); restarting after $RestartDelaySeconds seconds."
    Start-Sleep -Seconds ([Math]::Max(2, $RestartDelaySeconds))
}
