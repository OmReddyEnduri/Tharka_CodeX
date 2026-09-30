# Tharka Codex update diagnostic - run this any time an auto-update seems
# to have failed. It doesn't guess: it reads the exact same places the app
# and Windows itself record what happened, and prints the real error
# codes/IDs, not a summary.
$installDir = "$env:LOCALAPPDATA\Programs\tharka-codex"
$updaterDir = "$env:LOCALAPPDATA\tharka-codex-updater"
$logPath = "$env:USERPROFILE\Downloads\TharkaCodexUpdate.log"

Write-Output "===================================================="
Write-Output " Tharka Codex Update Diagnostic - $(Get-Date)"
Write-Output "===================================================="

Write-Output ""
Write-Output "--- 1. Installed exe ($installDir) ---"
$exe = Join-Path $installDir "Tharka Codex.exe"
if (Test-Path $exe) {
    Get-Item $exe | Select-Object FullName, Length, LastWriteTime, VersionInfo
} else {
    Write-Output "MISSING: Tharka Codex.exe is not in the install folder right now."
    Write-Output "         Either it was never installed here, or something removed it after install."
}

Write-Output ""
Write-Output "--- 2. Pending/staged update ($updaterDir) ---"
$pending = Join-Path $updaterDir "pending"
if (Test-Path $pending) {
    Get-ChildItem $pending | Select-Object Name, Length, LastWriteTime
} else {
    Write-Output "No pending update staged right now."
}

Write-Output ""
Write-Output "--- 3. Windows Defender detections mentioning this app ---"
$threats = Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object { $_.Resources -match "Tharka|Codex|tharka-codex" }
if ($threats) {
    Write-Output "FOUND - Defender has flagged this app. Exact IDs below:"
    $threats | Select-Object ThreatID, ProcessName, Resources, @{N = 'DetectionTime'; E = { $_.InitialDetectionTime } } | Format-List
} else {
    Write-Output "No Defender detections currently on record for this app."
}
Write-Output ""
Write-Output "Current Defender exclusions (should include the two paths above if the fix was applied):"
try { (Get-MpPreference).ExclusionPath } catch { Write-Output "Could not read Defender preferences: $($_.Exception.Message)" }

Write-Output ""
Write-Output "--- 4. Windows crash/error events for this app (last 3 days) ---"
$since = (Get-Date).AddDays(-3)
try {
    $events = Get-WinEvent -FilterHashtable @{LogName = 'Application'; StartTime = $since } -ErrorAction Stop |
        Where-Object { $_.Message -match "Tharka Codex" -or $_.Message -match "tharka-codex" }
    if ($events) {
        Write-Output "FOUND - exact event IDs and fault codes below:"
        $events | Select-Object TimeCreated, Id, LevelDisplayName, ProviderName, Message | Format-List
    } else {
        Write-Output "No matching Application-log events found in the last 3 days."
    }
} catch {
    Write-Output "Could not read the Application event log: $($_.Exception.Message)"
}

Write-Output ""
Write-Output "--- 5. Last 60 lines of TharkaCodexUpdate.log ---"
if (Test-Path $logPath) {
    Get-Content $logPath -Tail 60
} else {
    Write-Output "No update log found yet at $logPath"
}

Write-Output ""
Write-Output "===================================================="
Write-Output " End of diagnostic. Copy everything above and send it."
Write-Output "===================================================="
