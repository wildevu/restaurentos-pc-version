# RestaurantOS Local Hub - Windows Firewall Configuration
# Grants inbound access to Port 3000 for LAN devices on Private and Domain networks

param(
    [switch]$Remove
)

$RuleName = "RestaurantOS Local Hub"
$Port = 3000

# Check administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Administrator privileges are required to configure Windows Firewall. Please run as Administrator."
    exit 1
}

if ($Remove) {
    Write-Host "Removing Windows Firewall rule for RestaurantOS..." -ForegroundColor Yellow
    netsh advfirewall firewall delete rule name="$RuleName" | Out-Null
    Write-Host "Firewall rule removed." -ForegroundColor Green
    exit 0
}

Write-Host "Configuring Windows Firewall for RestaurantOS Local Hub (Port $Port)..." -ForegroundColor Cyan

# Remove any old rule with same name
netsh advfirewall firewall delete rule name="$RuleName" 2>&1 | Out-Null

# Add inbound rule for TCP 3000 across all profiles, scoped to RestaurantOS binary executable for maximum security
$NodeExe = Join-Path $AppDir "runtime\node.exe"
if (Test-Path $NodeExe) {
    $result = netsh advfirewall firewall add rule name="$RuleName" dir=in action=allow protocol=TCP localport=$Port program="$NodeExe" profile=private,domain description="Allows waiter, kitchen, and manager devices on the local restaurant network to connect to RestaurantOS Local Hub"
} else {
    $result = netsh advfirewall firewall add rule name="$RuleName" dir=in action=allow protocol=TCP localport=$Port profile=private,domain description="Allows waiter, kitchen, and manager devices on the local restaurant network to connect to RestaurantOS Local Hub"
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Windows Firewall rule successfully configured for RestaurantOS Local Hub on TCP port $Port (Private/Domain)." -ForegroundColor Green
} else {
    Write-Warning "Could not automatically register firewall rule. Error: $result"
}
