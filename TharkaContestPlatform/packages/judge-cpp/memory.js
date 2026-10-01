const fs = require('fs');
const path = require('path');

// --- jobrun.exe: OS-enforced limits (Windows) -------------------------------
// Tiny launcher (jobrun.c) that runs the student program inside a Job Object
// with a hard committed-memory cap and a 1-process limit, so a runaway
// allocation is refused by Windows instantly instead of being caught up to a
// sampling interval late. Sampling the program's working set from outside
// (memoryProbe.js) is what execute.js/interactive.js fall back to when this
// launcher is absent or unusable; memoryProbe's system free-memory backstop
// stays on either way.
//
// Measuring a pid's memory used to live here too (getMemoryBytes, tasklist /
// pidusage); memoryProbe.js's sampleMemoryKb covers that now, so only the
// launcher plumbing is left in this file.

const JOBRUN_EXIT_MLE = 0x7F4D4C45;
const JOBRUN_EXIT_HELPER = 0x7F4A4F42;

// If the launcher ever fails to start (missing file, blocked by antivirus,
// job creation refused), stop using it for the rest of the session so runs
// fall back to memoryProbe sampling instead of every run failing.
let jobRunnerBroken = false;
function markJobRunnerBroken(why) {
  if (!jobRunnerBroken) console.warn('[judge-cpp] jobrun.exe unusable, falling back to memory sampling:', why);
  jobRunnerBroken = true;
}

function getJobRunner() {
  if (process.platform !== 'win32') return null;
  // Inside Electron's asar the exe is unpacked next to it; spawn can't run from the archive.
  // (split/join on path.sep, not a regex - a lost backslash in the old regex broke every packaged Run.)
  const p = path.join(__dirname, 'jobrun.exe').split(path.sep + 'app.asar' + path.sep).join(path.sep + 'app.asar.unpacked' + path.sep);
  return !jobRunnerBroken && fs.existsSync(p) ? p : null;
}

// The judged program died because an allocation was refused: either jobrun saw
// the job's memory cap hit, or the program terminated on an uncaught
// std::bad_alloc (a single oversized `new` is refused outright without ever
// raising the job's limit notification, and in fallback mode the OS itself can
// refuse it). Only a failing exit counts, so a program that merely prints the
// word is not misjudged.
function isAllocationFailure(code, stderr, usedJobRunner) {
  if (usedJobRunner && code === JOBRUN_EXIT_MLE) return true;
  return code !== 0 && code != null && /bad_alloc/.test(stderr || '');
}

module.exports = {
  getJobRunner,
  markJobRunnerBroken,
  isAllocationFailure,
  JOBRUN_EXIT_MLE,
  JOBRUN_EXIT_HELPER,
};
