# Verifies the Windows file-handle sharing semantics used by the
# RestaurantOS supervisor lifecycle lock. No app files or customer data touched.
$ErrorActionPreference = "Stop"

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("RestaurantOS-lock-test-" + [Guid]::NewGuid().ToString("N"))
$lockPath = Join-Path $tempDir "supervisor.lock"
$owner = $null
$contender = $null

try {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    $owner = [System.IO.File]::Open(
        $lockPath,
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::Read
    )

    $blockedAsExpected = $false
    try {
        $contender = [System.IO.File]::Open(
            $lockPath,
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::Read
        )
    } catch [System.IO.IOException] {
        $blockedAsExpected = $true
    }

    if (-not $blockedAsExpected) {
        throw "A second supervisor unexpectedly acquired the lifecycle lock."
    }

    $owner.Dispose()
    $owner = $null

    # A stale lock file must be reusable after the owning process releases its handle.
    $contender = [System.IO.File]::Open(
        $lockPath,
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::Read
    )
    $contender.Dispose()
    $contender = $null

    Write-Host "Supervisor lock integration check: duplicate blocked; released lock reusable."
} finally {
    if ($contender) { $contender.Dispose() }
    if ($owner) { $owner.Dispose() }
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
