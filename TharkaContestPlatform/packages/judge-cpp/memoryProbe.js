const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// Measuring a judged program's memory - the enforcement behind the memory
// limit. This used to be pidusage, which on Windows shells out to `wmic` for
// every single sample. Two things made that the direct cause of a whole lab
// laptop freezing hard enough to need a reboot:
//
//   1. wmic.exe is DEPRECATED AND REMOVED on current Windows builds. When it
//      is missing, spawn('wmic') fails, every sample throws err, and the old
//      code just console.warn'd and carried on - so the memory limit was
//      silently never enforced at all. A program that allocates in a loop
//      (an accidental `while (cin >> x) v.push_back(x);` is the usual one)
//      then grows until the OS itself runs out of RAM, and the machine
//      thrashes to death. Nothing else in the judge can stop that: the time
//      limit does not help, because a program can allocate gigabytes in well
//      under a second.
//   2. pidusage 4.x (what the packaged Electron app resolves) instead falls
//      back to spawning POWERSHELL + a WMI query per sample (~1s each, tens
//      of MB). Polled every 500ms from a `setInterval(async ...)`, those
//      samples overlap without bound, so a five-minute interactive session
//      kept several PowerShell/WMI providers alive simultaneously.
//
// So this module measures memory itself, using only tools that are actually
// present and cheap, and it is called through startMemoryWatch() below, which
// can never overlap its own samples.
//
// Windows: `tasklist` (always present, ~180ms, a few MB) - reads the same
// working-set figure Task Manager shows. Linux: /proc/<pid>/status VmRSS,
// which needs no subprocess at all. Anything else: POSIX `ps -o rss=`.
//
// Every path returns null rather than throwing when the process has already
// exited - that is the normal, expected outcome at the end of a run, not an
// error to report.
const IS_WIN = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';

// Generous relative to tasklist's ~180ms, purely so a pathologically slow
// machine reports "no reading" instead of queueing a stuck subprocess.
const PROBE_TIMEOUT_MS = 5000;

// --- system-level backstop -------------------------------------------------
//
// The per-process figure below is a WORKING SET, and Windows trims working
// sets under memory pressure: a program can keep allocating while its working
// set stops growing, because the pages are being pushed to the pagefile. That
// is precisely the state that freezes a machine - disk thrashing, everything
// unresponsive, reboot required - and it is precisely the state in which the
// working-set limit stops being able to see the problem. Measured on the lab
// machine this was written for, a runaway program kept allocating for 8.8s
// while its working set never crossed a 64MB limit, and the process was only
// stopped by the allocation itself eventually failing.
//
// Free physical memory is a single cheap syscall with no subprocess, and it
// sees that case directly. Both floors have to be crossed for this to fire:
// free memory below the floor AND a meaningful drop since this run started.
// The second condition is what keeps it safe on a laptop that was already low
// on memory for unrelated reasons - that must not fail every submission, only
// a run that is itself eating what is left.
const SYSTEM_MEMORY_FLOOR_BYTES = 512 * 1024 * 1024; // 512MB free = danger
const SYSTEM_MEMORY_DROP_BYTES = 256 * 1024 * 1024; // ...and this run took 256MB
// How often the free-memory check runs. This one costs nothing (no
// subprocess), and a tight allocation loop can take gigabytes per second, so
// it is worth polling far more often than the process probe below.
const SYSTEM_CHECK_INTERVAL_MS = 200;

function sampleWindows(pid) {
  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true, timeout: PROBE_TIMEOUT_MS },
      (err, stdout) => {
        if (err) return resolve(null);
        const text = String(stdout).trim();
        // A dead pid makes tasklist print an "INFO: No tasks are running..."
        // line instead of a CSV row - that is the exited-process case.
        if (!text || !text.includes('","')) return resolve(null);
        // Last CSV field is "Mem Usage", e.g. "46,848 K" or "46.848 K" in a
        // different locale. Stripping every non-digit gets the KB figure
        // right in both (the thousands separator is the only punctuation an
        // integer number of KB can contain).
        const kb = Number(text.slice(text.lastIndexOf('","') + 3).replace(/[^0-9]/g, ''));
        resolve(Number.isFinite(kb) && kb > 0 ? kb : null);
      }
    );
  });
}

function sampleLinux(pid) {
  try {
    // Already in kB, and no subprocess - by far the cheapest probe.
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = /^VmRSS:\s+(\d+)\s+kB/m.exec(status);
    return Promise.resolve(match ? Number(match[1]) : null);
  } catch {
    // Process gone, or a platform without /proc.
    return Promise.resolve(null);
  }
}

function samplePosix(pid) {
  return new Promise((resolve) => {
    execFile('ps', ['-o', 'rss=', '-p', String(pid)], { timeout: PROBE_TIMEOUT_MS }, (err, stdout) => {
      if (err) return resolve(null);
      const kb = Number(String(stdout).trim());
      resolve(Number.isFinite(kb) && kb > 0 ? kb : null);
    });
  });
}

// One reading of the process's resident memory, in kB, or null if the process
// is gone / the reading failed. Never throws and never rejects.
function sampleMemoryKb(pid) {
  if (pid == null) return Promise.resolve(null);
  if (IS_WIN) return sampleWindows(pid);
  if (IS_LINUX) return sampleLinux(pid);
  return samplePosix(pid);
}

// Which mechanism this platform uses, for the broken-probe warning below to
// name in its message - so an operator reading the log can tell at a glance
// whether memory enforcement is actually live on this machine, rather than
// discovering months later that it never was (the exact failure this module
// exists to make impossible to hide).
function describeProbe() {
  if (IS_WIN) return 'tasklist (working set)';
  if (IS_LINUX) return '/proc/<pid>/status VmRSS';
  return 'ps -o rss=';
}

// Watches `pid` and calls onExceeded at most once: when the program's own
// working set passes `limitMb` (reason 'limit'), or when the machine's free
// memory drops through the floor because of this run (reason 'system').
//
// Two independent loops, deliberately:
//
//   - The system check is a bare os.freemem() - no subprocess, effectively
//     free - so it runs often. That frequency is the point: a tight
//     allocation loop can take gigabytes per second, so a backstop whose job
//     is to keep the machine out of swap has to notice in a fraction of a
//     second, not whenever the next process probe happens to land.
//   - The per-process probe spawns a tasklist, so it runs less often.
//
// Neither loop can overlap itself, which is exactly what the old
// `setInterval(async () => { await pidusage(pid) }, intervalMs)` got wrong:
// setInterval fires on a fixed schedule no matter how long the previous async
// callback is still taking, so any sample slower than the interval stacked
// another one on top - and on Windows each of those was a PowerShell process.
// Each loop here re-arms its timer only AFTER its work has finished, so there
// is ever only one probe in flight for a run, on any machine speed.
//
// `processProbe: false` runs the system backstop alone. That is for a program
// launched through jobrun.exe (see memory.js): the OS already enforces its
// memory limit as a hard cap, and the pid the caller holds is the launcher's,
// so sampling it would only measure the launcher.
//
// Returns a handle: { stop(), peakKb() }.
function startMemoryWatch(pid, { intervalMs = 500, limitMb, onExceeded, processProbe = true }) {
  let stopped = false;
  let probeTimer = null;
  let systemTimer = null;
  let peakKb = 0;
  let consecutiveFailures = 0;
  // Captured before the program has done anything, so the drop test measures
  // what THIS run consumed rather than the machine's existing load.
  const baselineFreeBytes = os.freemem();
  // A broken probe must be visible exactly once per run, not once per tick -
  // the old code logged a warning every 500ms for the whole run, which is what
  // buried the real problem in the log in the first place.
  let reportedFailure = false;

  function fire(reason) {
    if (stopped) return;
    stopped = true;
    if (probeTimer) clearTimeout(probeTimer);
    if (systemTimer) clearTimeout(systemTimer);
    onExceeded(peakKb, reason);
  }

  function checkSystemMemory() {
    if (stopped) return;
    const freeBytes = os.freemem();
    if (freeBytes < SYSTEM_MEMORY_FLOOR_BYTES && baselineFreeBytes - freeBytes > SYSTEM_MEMORY_DROP_BYTES) {
      fire('system');
      return;
    }
    systemTimer = setTimeout(checkSystemMemory, SYSTEM_CHECK_INTERVAL_MS);
  }

  async function probe() {
    if (stopped) return;
    const kb = await sampleMemoryKb(pid);
    if (stopped) return;

    if (kb == null) {
      // Ambiguous: either the program just exited (normal - every run ends
      // this way) or the probe itself is unusable. One missed reading proves
      // nothing, so only a sustained run of them is treated as a broken probe
      // worth surfacing. Nothing is enforced on a null reading either way;
      // there is no number to compare.
      consecutiveFailures++;
      if (consecutiveFailures >= 5 && !reportedFailure) {
        reportedFailure = true;
        console.warn(
          `[judge-cpp] memory probe ("${describeProbe()}") returned no reading 5 times in a row for pid ${pid} - ` +
            'the memory limit may not be enforceable on this machine.'
        );
      }
    } else {
      consecutiveFailures = 0;
      if (kb > peakKb) peakKb = kb;
      if (limitMb != null && kb > limitMb * 1024) {
        fire('limit');
        return;
      }
    }

    if (stopped) return;
    probeTimer = setTimeout(probe, intervalMs);
  }

  systemTimer = setTimeout(checkSystemMemory, SYSTEM_CHECK_INTERVAL_MS);
  if (processProbe) probeTimer = setTimeout(probe, intervalMs);

  return {
    stop() {
      stopped = true;
      if (probeTimer) clearTimeout(probeTimer);
      if (systemTimer) clearTimeout(systemTimer);
    },
    peakKb() {
      return peakKb;
    },
  };
}

module.exports = { sampleMemoryKb, startMemoryWatch, describeProbe };
