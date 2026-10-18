param(
    [string]$AppDir = "$env:ProgramFiles\RestaurantOS",
    [string]$DataDir = "$env:ProgramData\RestaurantOS",
    [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Continue"

try {
    $AppDir = [System.IO.Path]::GetFullPath($AppDir)
    $DataDir = [System.IO.Path]::GetFullPath($DataDir)
} catch {
    $fallbackLog = Join-Path "$env:ProgramData\RestaurantOS" "logs\hub-supervisor.log"
    try {
        New-Item -ItemType Directory -Path (Split-Path -Parent $fallbackLog) -Force | Out-Null
        Add-Content -LiteralPath $fallbackLog -Value "[$(Get-Date -Format o)] FATAL: invalid application/data path arguments. AppDir=[$AppDir]; DataDir=[$DataDir]; Error=$($_.Exception.Message)"
    } catch {}
    exit 3
}

$NodeExe = Join-Path $AppDir "runtime\node.exe"
$ServerScript = Join-Path $AppDir "server.cjs"
$LogDir = Join-Path $DataDir "logs"
$SupervisorLog = Join-Path $LogDir "hub-supervisor.log"

foreach ($dir in @($DataDir, (Join-Path $DataDir "data"), (Join-Path $DataDir "backups"), $LogDir, (Join-Path $DataDir "config"))) {
    try {
        New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop | Out-Null
    } catch {
        Write-Error "Could not create required RestaurantOS directory [$dir]: $($_.Exception.Message)"
        exit 4
    }
}

function Write-SupervisorLog([string]$Message) {
    try {
        if (Test-Path -LiteralPath $SupervisorLog -PathType Leaf) {
            $existingLog = Get-Item -LiteralPath $SupervisorLog -ErrorAction Stop
            if ($existingLog.Length -gt 10MB) {
                $rotatedLog = "$SupervisorLog.1"
                Remove-Item -LiteralPath $rotatedLog -Force -ErrorAction SilentlyContinue
                Move-Item -LiteralPath $SupervisorLog -Destination $rotatedLog -Force -ErrorAction Stop
            }
        }
        Add-Content -LiteralPath $SupervisorLog -Value "[$(Get-Date -Format o)] $Message"
    } catch {
        Write-Error "Could not write the RestaurantOS supervisor log: $($_.Exception.Message)"
    }
}

try {
    Set-Location -LiteralPath $AppDir -ErrorAction Stop
} catch {
    Write-SupervisorLog "FATAL: could not set application working directory. AppDir=[$AppDir]; Error=$($_.Exception.Message)"
    exit 3
}

if (-not (Test-Path -LiteralPath $NodeExe -PathType Leaf)) {
    Write-SupervisorLog "FATAL: bundled Node runtime missing: $NodeExe (AppDir=[$AppDir])"
    exit 2
}
if (-not (Test-Path -LiteralPath $ServerScript -PathType Leaf)) {
    Write-SupervisorLog "FATAL: server bundle missing: $ServerScript (AppDir=[$AppDir])"
    exit 2
}

$env:NODE_ENV = "production"
$env:PORT = "8989"
$env:RESTAURANTOS_DATA_DIR = $DataDir
$env:DB_PATH = Join-Path (Join-Path $DataDir "data") "restaurantos.db"
$env:BACKUP_DIR = Join-Path $DataDir "backups"
$env:LOG_DIR = $LogDir

$delay = [Math]::Max(2, $RestartDelaySeconds)
Write-SupervisorLog "Supervisor started. AppDir=[$AppDir]; DataDir=[$DataDir]; NodeExe=[$NodeExe]; ServerScript=[$ServerScript]"

while ($true) {
    Write-SupervisorLog "Starting RestaurantOS Local Hub."
    try {
        & $NodeExe $ServerScript *>> $SupervisorLog
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
        Write-SupervisorLog "Supervisor caught launch error: $($_.Exception.Message)"
    }

    Write-SupervisorLog "Hub exited (code $exitCode); restarting after $delay seconds."
    Start-Sleep -Seconds $delay

    if ($exitCode -eq 0) {
        $delay = [Math]::Max(2, $RestartDelaySeconds)
    } else {
        $delay = [Math]::Min(60, [Math]::Max(2, $delay * 2))
    }
}
