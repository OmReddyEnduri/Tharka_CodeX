const { execFile } = require('child_process');
const path = require('path');

// Absolute path so a student-writable or odd PATH can't shadow/miss it.
const TASKLIST = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tasklist.exe');

// Resident memory of a pid, in bytes. pidusage's Windows backend shells out
// to wmic.exe, which Microsoft removed from Windows 11 24H2+ - there every
// call fails, so the memory limit silently never fires and a runaway
// allocation (`while(1) v.push_back(1)`) can eat all RAM and freeze the
// whole machine. tasklist.exe ships with every Windows version, so use that
// there and keep pidusage for other platforms (server-side judging).
function getMemoryBytes(pid) {
  if (process.platform !== 'win32') {
    return require('pidusage')(pid).then((s) => s.memory);
  }
  return new Promise((resolve, reject) => {
    execFile(TASKLIST, ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err) return reject(err);
      // "image.exe","1234","Console","1","12,345 K" - last field is mem usage.
      // When the pid is gone tasklist prints an INFO line with no quotes.
      const line = stdout.split(/\r?\n/).find((l) => l.startsWith('"'));
      if (!line) return reject(new Error('process not found'));
      const field = line.slice(1, -1).split('","').pop() || '';
      const kb = parseInt(field.replace(/\D/g, ''), 10);
      if (Number.isNaN(kb)) return reject(new Error(`unparseable tasklist output: ${line}`));
      resolve(kb * 1024);
    });
  });
}

module.exports = { getMemoryBytes };

// --- jobrun.exe: OS-enforced limits (Windows) -------------------------------
// Tiny launcher (jobrun.c) that runs the student program inside a Job Object
// with a hard committed-memory cap and a 1-process limit, so a runaway
// allocation is refused by Windows instantly instead of being caught up to a
// polling interval late. Falls back to the polling above when it's absent.
const fs = require('fs');

const JOBRUN_EXIT_MLE = 0x7F4D4C45;
const JOBRUN_EXIT_HELPER = 0x7F4A4F42;

// If the launcher ever fails to start (missing file, blocked by antivirus,
// job creation refused), stop using it for the rest of the session so runs
// fall back to the polling memory check instead of every run failing.
let jobRunnerBroken = false;
function markJobRunnerBroken(why) {
  if (!jobRunnerBroken) console.warn('[judge-cpp] jobrun.exe unusable, falling back to memory polling:', why);
  jobRunnerBroken = true;
}

function getJobRunner() {
  if (process.platform !== 'win32') return null;
  // Inside Electron's asar the exe is unpacked next to it; spawn can't run from the archive.
  const p = path.join(__dirname, 'jobrun.exe').split(path.sep + 'app.asar' + path.sep).join(path.sep + 'app.asar.unpacked' + path.sep);
  return !jobRunnerBroken && fs.existsSync(p) ? p : null;
}

module.exports.getJobRunner = getJobRunner;
module.exports.markJobRunnerBroken = markJobRunnerBroken;
module.exports.JOBRUN_EXIT_MLE = JOBRUN_EXIT_MLE;
module.exports.JOBRUN_EXIT_HELPER = JOBRUN_EXIT_HELPER;
