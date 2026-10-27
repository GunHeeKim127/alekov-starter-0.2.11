$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
function Stamp { (Get-Date).ToUniversalTime().ToString('o') }
function Unavailable($caught) {
  $permission = $caught.Exception -is [UnauthorizedAccessException] -or $caught.Exception -is [Security.SecurityException] -or $caught.FullyQualifiedErrorId -match 'AccessDenied|Unauthorized'
  @{ status = 'unknown'; reason = $(if ($permission) { 'ACCESS_DENIED' } else { 'READ_FAILED' }); attemptedAt = (Stamp) }
}
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($admin) {
  @{ source = 'actual'; network = @{status='unknown';reason='ADMIN_CONTEXT_REJECTED';attemptedAt=(Stamp)}; firewall = @{status='unknown';reason='ADMIN_CONTEXT_REJECTED';attemptedAt=(Stamp)}; events = @{status='unknown';reason='ADMIN_CONTEXT_REJECTED';attemptedAt=(Stamp)} } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}
$result = @{ source = 'actual'; administrator = $false }
try {
  $interfaces = @(Get-NetIPConfiguration -ErrorAction Stop | ForEach-Object {
    @{ name = $_.InterfaceAlias
      ipv4 = @($_.IPv4Address | ForEach-Object { $_.IPAddress } | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
      ipv6 = @($_.IPv6Address | ForEach-Object { $_.IPAddress } | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
      gateways = @((@($_.IPv4DefaultGateway | ForEach-Object { $_.NextHop }) + @($_.IPv6DefaultGateway | ForEach-Object { $_.NextHop })) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
      dns = @($_.DNSServer | ForEach-Object { $_.ServerAddresses } | ForEach-Object { $_ } | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) }
  })
  $result.network = @{ status = 'ok'; checkedAt = (Stamp); interfaces = $interfaces }
} catch { $result.network = Unavailable $_ }
try {
  $profiles = @(Get-NetFirewallProfile -PolicyStore ActiveStore -ErrorAction Stop | ForEach-Object {
    @{ name = $_.Name; enabled = $_.Enabled.ToString(); inbound = $_.DefaultInboundAction.ToString(); outbound = $_.DefaultOutboundAction.ToString() }
  })
  $result.firewall = @{ status = 'ok'; checkedAt = (Stamp); profiles = $profiles }
} catch { $result.firewall = Unavailable $_ }
$end = Get-Date
$start = $end.AddHours(-24)
$logs = @()
foreach ($name in @('System', 'Application')) {
  try {
    $records = @(Get-WinEvent -FilterHashtable @{LogName=$name;Level=2,3;StartTime=$start;EndTime=$end} -ErrorAction Stop)
    $logs += @{ name=$name;status='ok';errors=@($records | Where-Object Level -eq 2).Count;warnings=@($records | Where-Object Level -eq 3).Count;checkedAt=(Stamp) }
  } catch {
    if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') {
      $logs += @{name=$name;status='ok';errors=0;warnings=0;checkedAt=(Stamp)}
    } else {
      $item = Unavailable $_
      $item.name = $name
      $logs += $item
    }
  }
}
$result.events = @{status='ok';startAt=$start.ToUniversalTime().ToString('o');endAt=$end.ToUniversalTime().ToString('o');unit='count';logs=$logs;checkedAt=(Stamp)}
$result | ConvertTo-Json -Depth 8 -Compress
