# Registers the auto-deploy poller as a Windows Scheduled Task: every 3
# minutes, check-and-deploy.ps1 checks origin/main for new commits and, if
# any (and no contest is currently live), pulls + restarts the services.
# Run once (as Administrator):
#   powershell -ExecutionPolicy Bypass -File install-deploy-task.ps1
# To remove it: powershell -ExecutionPolicy Bypass -File uninstall-deploy-task.ps1
# To check on it: Get-ScheduledTaskInfo -TaskName TharkaContestServer-AutoDeploy
#                 Get-Content apps\server\deploy\deploy.log -Tail 30

$ErrorActionPreference = "Stop"
$taskName = "TharkaContestServer-AutoDeploy"
$scriptPath = Join-Path $PSScriptRoot "check-and-deploy.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Runs every 3 minutes, starting one minute from now. RepetitionDuration
# can't actually be "forever" - Task Scheduler's XML schema rejects
# [TimeSpan]::MaxValue as out of range - so this uses 20 years, which is
# effectively indefinite for this purpose.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 3) -RepetitionDuration (New-TimeSpan -Days 7300)

# SYSTEM: runs unattended (no one needs to be logged in), already has the
# local admin rights Restart-Service needs, and needs no stored password.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# IgnoreNew: if a deploy is still running (e.g. a slow npm install) when the
# next poll fires, skip that poll rather than overlapping two deploys.
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force `
    -Description "Polls origin/main for new commits; git-pulls and restarts TharkaContestServer/TharkaAdminWeb when found, unless a contest is currently live." | Out-Null

Write-Output "Scheduled task '$taskName' installed - polling every 3 minutes."
Write-Output "Check status: Get-ScheduledTaskInfo -TaskName $taskName"
Write-Output "View log:     Get-Content `"$(Join-Path $PSScriptRoot 'deploy.log')`" -Tail 30"
