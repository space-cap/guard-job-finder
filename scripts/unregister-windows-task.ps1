param(
  [string]$TaskName = "GuardJobFinderFetch"
)

$ErrorActionPreference = "Stop"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Output "Unregistered task '$TaskName'"
