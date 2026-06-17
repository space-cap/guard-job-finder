param(
  [string]$TaskName = "GuardJobFinderFetch",
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string[]]$Times = @("08:00", "18:00")
)

$ErrorActionPreference = "Stop"

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) {
  $npm = (Get-Command npm -ErrorAction Stop).Source
}

$command = "Set-Location -LiteralPath '$ProjectPath'; & '$npm' run fetch:jobs"
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -Command $command"

$triggers = foreach ($time in $Times) {
  $parts = $time.Split(":")
  $at = Get-Date -Hour ([int]$parts[0]) -Minute ([int]$parts[1]) -Second 0
  New-ScheduledTaskTrigger -Daily -At $at
}

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Description "Fetch Work24 guard jobs and send configured notifications." `
  -Force | Out-Null

Write-Output "Registered task '$TaskName' for $($Times -join ', ')"
