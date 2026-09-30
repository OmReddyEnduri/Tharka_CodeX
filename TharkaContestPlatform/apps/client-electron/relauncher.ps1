# Spawned detached by main.js's installDownloadedUpdate(), right before it
# quits. Replaces an earlier relauncher.js (Node script run via Electron's
# ELECTRON_RUN_AS_NODE=1) - repurposing a legitimate Electron binary as a
# script interpreter via that env var is a well-documented "living off the
# land" technique real malware uses, and got killed by security software.
# PowerShell is a normal, always-present Windows tool with no such flag.
#
# Root cause for WHY this can't just be electron-updater's own
# quitAndInstall() (confirmed by extensive direct testing, isolated from
# every other variable): this app's NSIS installer reliably fails to
# complete whenever it's run against an install directory that already has
# files in it - self-extracts, sometimes visibly starts an
# "old-uninstaller.exe" step, then just stops, wiping the target directory
# with nothing left running and no error anywhere. A plain install into an
# EMPTY directory has been 100% reliable in every test.
#
# This clears the EXISTING install directory's contents (not the directory
# itself - the path never changes) before reinstalling into it, rather than
# installing into a brand new sibling directory the way an earlier version
# of this did. That earlier approach avoided the "reinstall over existing
# files" NSIS bug, but traded it for a worse one: a brand new directory path
# has never been scanned by antivirus before and can't be pre-excluded from
# real-time scanning (it doesn't exist until the moment it's needed), which
# on this machine made writing a freshly-extracted ~186MB/many-small-files
# directory hang indefinitely - confirmed by a full 3-minute wait producing
# zero files. Reusing the SAME path this app has always lived at keeps
# whatever Defender exclusion already covers it (this project's deploy notes
# already document one for this exact path) instead of needing a new one
# added for every fresh directory name.
#
# Sequence: wait for the parent app's pid to actually exit (releasing the
# exe's file lock) -> clear the install directory's contents (patient
# retries - this can hit transient locks right after the parent exits, but
# unlike a live AV-scanning stall, that's a genuinely transient condition
# that clears within seconds to at most a couple minutes) -> run the
# installer with /S /D=<the same directory> -> poll for the exe to reappear
# with a newer mtime than baseline -> relaunch it.

param(
  [Parameter(Mandatory = $true)][string]$ExePath,
  [Parameter(Mandatory = $true)][string]$LogPath,
  [string]$InstallerPath,
  [int]$ParentPid
)

$ErrorActionPreference = "Continue"

function Write-Log([string]$line) {
  try {
    Add-Content -Path $LogPath -Value "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [relauncher] $line" -ErrorAction Stop
  } catch {
    # This script has no other log target if even this fails (e.g. the
    # Downloads folder itself is gone) - nothing more we can do.
  }
}

$installDir = Split-Path -Parent $ExePath

Write-Log "Relauncher started. Target (reused path): $ExePath"

# Baseline mtime, captured before touching anything - the safety net for
# "did this install actually happen" once we're back to reusing the same
# path (existence alone isn't proof here, unlike a brand-new directory).
$baselineMtime = $null
if (Test-Path $ExePath) {
  try {
    $baselineMtime = (Get-Item $ExePath).LastWriteTimeUtc
  } catch {}
}

# Wait for the parent app's process to have actually exited before letting
# anything touch the exe it's replacing.
if ($ParentPid -gt 0) {
  $maxWaitAttempts = 30
  $waited = 0
  while ($waited -lt $maxWaitAttempts) {
    if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) {
      break
    }
    Start-Sleep -Milliseconds 500
    $waited++
  }
  if ($waited -ge $maxWaitAttempts) {
    Write-Log "Parent app (pid=$ParentPid) still running after $($maxWaitAttempts * 0.5)s - proceeding anyway."
  } else {
    Write-Log "Parent app (pid=$ParentPid) has exited - safe to proceed."
  }
}

# The whole uninstall -> clear -> install -> verify sequence is wrapped in
# a retry loop. Root cause investigation (direct isolated repro, same
# installer/target run back to back, output polled live) showed NSIS's
# silent installer occasionally self-extracts partway (creates the
# locales/resources subdirectories) and then stops before copying the main
# payload - exit code 0, no error anywhere, intermittent and not tied to
# any one condition found so far (reproduced it both with and without a
# stale registry entry, under both light and moderate machine load). Since
# a plain re-run of the exact same installer reliably succeeds on a later
# attempt, retrying the full sequence (not just re-polling the same result)
# turns an occasional flaky failure into a reliable eventual success instead
# of chasing an exact root cause that may be inherent to how NSIS behaves
# under this machine's antivirus/filesystem timing.
$maxInstallAttempts = 5
$found = $false
for ($installAttempt = 1; $installAttempt -le $maxInstallAttempts; $installAttempt++) {
  Write-Log "--- Install attempt $installAttempt/$maxInstallAttempts ---"

  # Run the REAL uninstaller first, silently, before touching any files by
  # hand. Raw-deleting the directory's files with no uninstall step leaves
  # the Windows registry's uninstall-key entry for the previous version
  # stale - WriteRegStr'd by the ORIGINAL install, never cleared. electron-
  # builder's NSIS installer checks that registry key on every run and, if
  # present, tries to migrate/reference the previous install's uninstaller
  # as part of its own upgrade logic. Running the real uninstaller clears
  # that key the correct way, so the new installer sees a genuinely clean
  # machine instead of a directory that's empty but a registry that still
  # claims otherwise.
  $uninstallerPath = Join-Path $installDir "Uninstall Tharka Codex.exe"
  if (Test-Path $uninstallerPath) {
    Write-Log "Running the real uninstaller first (clears the stale registry entry): `"$uninstallerPath`" /S"
    try {
      Start-Process -FilePath $uninstallerPath -ArgumentList @("/S") -WindowStyle Hidden -Wait
      Write-Log "Uninstaller finished."
      # A short settle delay before the next NSIS process starts - back-to-
      # back NSIS invocations against the same path (uninstall then
      # install, seconds apart) are one of the few things this script does
      # that isolated manual testing never exercised, and manual runs with
      # a natural gap between steps were consistently reliable where
      # automated back-to-back runs sometimes weren't. Cheap to add, only
      # costs 2s per install attempt.
      Start-Sleep -Seconds 2
    } catch {
      Write-Log "Uninstaller failed to run: $($_.Exception.Message) - proceeding anyway."
    }
  } else {
    Write-Log "No existing uninstaller found at $uninstallerPath - nothing to uninstall."
  }

  # Clear the directory's contents (not the directory object) - patient
  # retries for the transient lock right after the parent exits. Mostly a
  # no-op now that the real uninstaller just ran, but stays as a safety net
  # for anything the uninstaller leaves behind (including a previous
  # install-attempt's partial extraction, on a retry pass).
  $maxClearAttempts = 30
  for ($i = 1; $i -le $maxClearAttempts; $i++) {
    try {
      $entries = Get-ChildItem -LiteralPath $installDir -Force -ErrorAction Stop
      if ($entries.Count -eq 0) {
        Write-Log "Install directory already empty."
        break
      }
      $entries | Remove-Item -Recurse -Force -ErrorAction Stop
      Write-Log "Cleared install directory contents on attempt ${i}."
      break
    } catch {
      if ($i -eq $maxClearAttempts) {
        Write-Log "Failed to clear install directory after $maxClearAttempts attempts ($($_.Exception.Message)) - proceeding anyway."
      } else {
        Start-Sleep -Seconds 2
      }
    }
  }

  # Run the installer targeting the SAME directory - WAITED ON directly
  # (-Wait), not fired off and polled for separately.
  if ($InstallerPath -and (Test-Path $InstallerPath)) {
    Write-Log "Running installer: `"$InstallerPath`" /S /D=$installDir"
    try {
      Start-Process -FilePath $InstallerPath -ArgumentList @("/S", "/D=$installDir") -WindowStyle Hidden -Wait
      Write-Log "Installer finished - checking for the exe at $ExePath."
    } catch {
      Write-Log "Installer failed: $($_.Exception.Message)"
    }
  } else {
    Write-Log "No installer path provided or file missing - skipping install step, going straight to the relaunch check."
  }

  # Poll for the exe to reappear with a newer mtime than baseline. A
  # shorter window per install-attempt than before (used to be 60x2s=120s
  # with no retry at all) since a real success shows up within a few
  # attempts - if it's not there by ~24s, this attempt has silently failed
  # and retrying the whole install is more useful than waiting longer.
  $maxPollAttempts = 12
  $attempt = 0
  while ($attempt -lt $maxPollAttempts) {
    $attempt++
    Write-Log "Attempt $attempt/${maxPollAttempts}: checking for $ExePath"
    if (Test-Path $ExePath) {
      $item = Get-Item $ExePath
      if (-not $baselineMtime -or $item.LastWriteTimeUtc -gt $baselineMtime) {
        Write-Log "Attempt ${attempt}: found exe - size=$($item.Length) bytes, last modified=$($item.LastWriteTime)"
        $found = $true
        break
      }
      Write-Log "Attempt ${attempt}: exe mtime unchanged from baseline - install hasn't replaced it yet."
    } else {
      Write-Log "Attempt ${attempt}: exe not found yet - install may still be in progress."
    }
    Start-Sleep -Seconds 2
  }

  if ($found) {
    break
  } elseif ($installAttempt -lt $maxInstallAttempts) {
    Write-Log "Install attempt $installAttempt did not produce a new exe - retrying the full install."
  }
}

if ($found) {
  try {
    # Direct process start, not a shell "open" verb - deliberately avoids
    # the same ShellExecute path NSIS's own relaunch uses, which is the one
    # that runs a freshly-downloaded unsigned exe through Windows' shell-
    # level reputation checks.
    $proc = Start-Process -FilePath $ExePath -PassThru
    Write-Log "Relaunch succeeded - pid=$($proc.Id). Done."
  } catch {
    Write-Log "Relaunch failed: $($_.Exception.Message)"
  }
} else {
  Write-Log "Giving up after $maxInstallAttempts full install attempts - the app did NOT relaunch. Check Windows Defender's detection history for $ExePath."
}
