# RestaurantOS Local Hub - LAN and mDNS Firewall Rules
# Must be executed as Administrator during installation.
param(
    [string]$RuleName = "RestaurantOS Local Hub",
    [int]$Port = 8989
)

$ErrorActionPreference = "Stop"
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Administrator privileges are required to configure Windows Firewall."
    exit 1
}

try {
    $mdnsRuleName = "RestaurantOS Local Discovery (Inbound UDP 5353)"
    Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Get-NetFirewallRule -DisplayName $mdnsRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

    # Profile Any is needed because Windows can classify a restaurant Wi-Fi as Public.
    # RemoteAddress LocalSubnet keeps both rules restricted to the directly connected LAN.
    New-NetFirewallRule -DisplayName $RuleName `
        -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port `
        -RemoteAddress LocalSubnet -Profile Any -Enabled True `
        -Description "Allows RestaurantOS devices on the local subnet to connect to the Local Hub."

    New-NetFirewallRule -DisplayName $mdnsRuleName `
        -Direction Inbound -Action Allow -Protocol UDP -LocalPort 5353 `
        -RemoteAddress LocalSubnet -Profile Any -Enabled True `
        -Description "Allows local-subnet devices to discover the RestaurantOS mDNS hostname."

    Write-Host "Windows Firewall configured for local-subnet TCP $Port and UDP 5353."
    exit 0
} catch {
    Write-Error "Failed to configure RestaurantOS firewall rules: $($_.Exception.Message)"
    exit 1
}
