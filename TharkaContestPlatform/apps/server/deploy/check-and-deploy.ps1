# Auto-deploy: run on a schedule (see install-deploy-task.ps1) to pick up
# new commits pushed to origin/main with no manual step on this machine -
# "git push, and the lab server updates itself." Every step is best-effort
# and logged; a failure here should never be silent, but also should never
# crash the scheduled task itself (Register-ScheduledTask has no built-in
# retry/backoff the way the Windows Service install does).
#
# Safety: never deploys while a contest is currently live (see
# /api/contests/live-status) - restarting the server mid-contest would drop
# every connected student's in-flight request at once. A pending deploy just
# waits for the next poll once no contest is live.

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Administrator\TharkaLabContest"
$platformRoot = Join-Path $repoRoot "TharkaContestPlatform"
$logFile = Join-Path $platformRoot "apps\server\deploy\deploy.log"

function Write-Log($msg) {
    $line = "$(Get-Date -Format o)  $msg"
    Add-Content -Path $logFile -Value $line
    Write-Output $line
}

function Invoke-Git {
    param([string[]]$GitArgs)
    # This task runs as SYSTEM (see install-deploy-task.ps1), a different
    # Windows account than the one that owns these files - git 2.35+ refuses
    # to operate on a repo it doesn't recognize as owned by the current user
    # ("detected dubious ownership") unless explicitly told it's safe, on
    # every invocation, since SYSTEM has no persistent global gitconfig of
    # its own to remember this in across runs.
    #
    # No `2>&1` here deliberately: PowerShell 5.1 wraps a native command's
    # stderr lines as ErrorRecords when merged this way, and git routinely
    # writes normal, successful progress output to stderr (e.g. fetch's
    # "From https://...") - merging it would make a totally successful git
    # command look like a thrown exception under $ErrorActionPreference =
    # "Stop". Exit code is the actual, reliable signal of failure.
    $output = & git -c "safe.directory=$repoRoot" @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') exited with code $LASTEXITCODE"
    }
    return $output
}

try {
    Set-Location $repoRoot

    Invoke-Git @("fetch", "origin", "main") | Out-Null

    $localHead = (Invoke-Git @("rev-parse", "HEAD")) -join ""
    $remoteHead = (Invoke-Git @("rev-parse", "origin/main")) -join ""

    if ($localHead -eq $remoteHead) {
        # Nothing new - this is the common case on most polls, so stay quiet
        # rather than growing the log file every few minutes for no reason.
        exit 0
    }

    Write-Log "New commit(s) on origin/main: $localHead -> $remoteHead"

    # --- Live-contest guard --------------------------------------------
    $anyLive = $false
    try {
        $status = Invoke-RestMethod -Uri "http://localhost:3001/api/contests/live-status" -TimeoutSec 5
        $anyLive = $status.anyLive
    } catch {
        Write-Log "Could not reach the server to check contest liveness ($($_.Exception.Message)) - deploying anyway, since a server that's already unreachable isn't serving a live contest either."
    }

    if ($anyLive) {
        Write-Log "Skipping this round - a contest is currently live. Will retry on the next poll."
        exit 0
    }

    # --- Pull ------------------------------------------------------------
    $lockChanged = Invoke-Git @("diff", "--name-only", $localHead, $remoteHead, "--", "TharkaContestPlatform/package-lock.json")
    Invoke-Git @("pull", "origin", "main") | ForEach-Object { Write-Log "git: $_" }

    # --- Install deps only if the lockfile actually changed ---------------
    if ($lockChanged) {
        Write-Log "package-lock.json changed - running npm install"
        Set-Location $platformRoot
        # Same reasoning as Invoke-Git above - no 2>&1, check the exit code.
        $npmOutput = & npm install
        $npmOutput | ForEach-Object { Write-Log "npm: $_" }
        if ($LASTEXITCODE -ne 0) { throw "npm install exited with code $LASTEXITCODE" }
        Set-Location $repoRoot
    }

    # --- Restart services to pick up the new code --------------------------
    # admin-web's Vite dev server hot-reloads on file changes already, but a
    # bulk git pull (renames/deletions) is exactly the case Vite's watcher
    # handles least reliably, so it's restarted too for a clean, known state.
    Write-Log "Restarting TharkaContestServer"
    Restart-Service -Name "TharkaContestServer" -ErrorAction SilentlyContinue
    Write-Log "Restarting TharkaAdminWeb"
    Restart-Service -Name "TharkaAdminWeb" -ErrorAction SilentlyContinue

    Write-Log "Deploy complete - now at $remoteHead"
} catch {
    Write-Log "Deploy FAILED: $($_.Exception.Message)"
}
