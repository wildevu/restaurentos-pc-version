# RestaurantOS Local Hub - Firewall Rule Helper
# Must be executed as Administrator during Windows Installation

param (
    [string]$RuleName = "RestaurantOS Local Hub (Inbound TCP 8989)",
    [int]$Port = 8989
)

# Test Administrator Privilege
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "This script requires Administrator privileges to configure Windows Firewall!"
    exit 1
}

try {
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue

    if ($existingRule) {
        Write-Host "Updating existing Windows Firewall rule '$RuleName' for port $Port..."
        Set-NetFirewallRule -DisplayName $RuleName `
                            -Direction Inbound `
                            -Action Allow `
                            -Protocol TCP `
                            -LocalPort $Port `
                            -Profile Private,Domain,Public `
                            -Enabled True
    } else {
        Write-Host "Creating new Windows Firewall rule '$RuleName' for port $Port..."
        New-NetFirewallRule -DisplayName $RuleName `
                            -Direction Inbound `
                            -Action Allow `
                            -Protocol TCP `
                            -LocalPort $Port `
                            -Profile Private,Domain `
                            -Enabled True `
                            -Description "Allows local LAN waiter tablets and kitchen displays to connect to RestaurantOS Local Hub."
    }

    $mdnsRuleName = "RestaurantOS Local Discovery (Inbound UDP 5353)"
    Get-NetFirewallRule -DisplayName $mdnsRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

    New-NetFirewallRule -DisplayName $mdnsRuleName `
                        -Direction Inbound `
                        -Action Allow `
                        -Protocol UDP `
                        -LocalPort 5353 `
                        -RemoteAddress LocalSubnet `
                        -Profile Private,Domain `
                        -Enabled True `
                        -Description "Allows mDNS discovery requests from devices on the restaurant's local network."

    Write-Host "Windows Firewall rules successfully configured (TCP 8989 and local-subnet UDP 5353)."
    exit 0
} catch {
    Write-Error "Failed to configure Windows Firewall rule: $_"
    exit 1
}
