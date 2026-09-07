# Removes the scheduled task installed by install-deploy-task.ps1.
Unregister-ScheduledTask -TaskName "TharkaContestServer-AutoDeploy" -Confirm:$false
Write-Output "Scheduled task 'TharkaContestServer-AutoDeploy' removed."
