const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const treeKill = require('tree-kill');
// Memory measurement lives in its own module now - see memoryProbe.js for why
// the old wmic-based pidusage had to go. Short version: on current Windows
// builds wmic.exe no longer exists, so every sample failed, the memory limit
// was silently never enforced, and a program that allocated in a loop could
// take the entire machine down with it.
const { startMemoryWatch } = require('./memoryProbe');
// jobrun.exe - the Windows Job Object launcher that makes the memory limit a
// hard OS cap instead of a sampled one (see memory.js / jobrun.c).
const { getJobRunner, markJobRunnerBroken, isAllocationFailure, JOBRUN_EXIT_HELPER } = require('./memory');

// Only a ceiling on how often memory may be sampled - memoryProbe.js re-arms
// its timer after each sample resolves rather than on a fixed schedule, so a
// slow sample can never stack a second probe on top of it.
const MEMORY_POLL_INTERVAL_MS = 500;
const DEFAULT_MAX_OUTPUT_BYTES = 1 * 1024 * 1024; // 1MB default - well beyond any legitimate judge-problem output; guards a print-flood loop

// Strips trailing whitespace/newlines only. Keeps leading whitespace, which
// is meaningful output (indented patterns, aligned columns) and must survive
// to the comparison in index.js - see the note at the resolve() below.
function trimTrailing(s) {
  return (s || '').replace(/\s+$/, '');
}

// Runs a compiled executable against one input, enforcing time and memory
// limits via subprocess supervision (no OS-level sandbox - see staticCheck.js
// for why that's an accepted tradeoff here). Resolves with a result object,
// never rejects - callers branch on `verdict`. `maxOutputBytes` is
// admin-configurable (see JudgeSettings) - defaults to 1MB.
async function execute(execPath, input, opts) {
  const result = await executeOnce(execPath, input, opts, getJobRunner());
  // The launcher itself could not start (not the student's program) - disable
  // it for the rest of this process and run again directly, under memoryProbe
  // sampling. One bad launcher must never fail a student's run.
  if (result.launcherFailed) {
    markJobRunnerBroken(result.stderr);
    return executeOnce(execPath, input, opts, null);
  }
  return result;
}

function executeOnce(execPath, input, { timeLimitMs, memoryLimitMb, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES }, runner) {
  return new Promise((resolve) => {
    // cwd = the run's own temp work dir, so relative-path file writes land in
    // a folder that is deleted afterwards (not the app/server directory).
    const workDir = path.dirname(execPath);
    // With jobrun (Windows), the program runs inside a Job Object: hard
    // committed-memory cap, 1 process, killed if the launcher dies, below-normal
    // priority. jobrun writes the job's peak committed memory to peakFile.
    const peakFile = runner ? path.join(workDir, 'peak.kb') : null;
    let child;
    try {
      child = runner
        ? spawn(runner, [String(Math.floor(memoryLimitMb * 1024 * 1024)), peakFile, execPath], { windowsHide: true, cwd: workDir })
        : spawn(execPath, [], { windowsHide: true, cwd: workDir });
    } catch (err) {
      // spawn() THROWS (rather than emitting 'error') for some failures - e.g.
      // `spawn UNKNOWN` for a corrupt or antivirus-mangled exe. Uncaught, that
      // would reject this promise-returning judge mid-run.
      resolve({ verdict: 'Runtime Error', stdout: '', stderr: err.message, memoryPeakKb: 0, launcherFailed: !!runner });
      return;
    }
    // A CPU-bound student program gets a full core for its whole run; at
    // below-normal priority the UI and the rest of the OS stay responsive
    // while it spins. Best effort (pid is undefined if the spawn failed).
    try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* best effort */ }

    let stdout = '';
    let stderr = '';
    let settled = false;
    // Assigned below, once finish() exists. Read through the optional chain
    // because a spawn 'error' can settle this before the watch is started.
    let memoryWatch = null;
    let jobPeakKb = 0;

    const finish = (verdict, extra = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      memoryWatch?.stop();
      // Trailing-only trim, NOT a full .trim(). A full trim also ate LEADING
      // whitespace, and only from the program's actual output - the admin's
      // expected output was never leading-trimmed to match. That asymmetry
      // failed every pattern-printing problem (`  *` / ` ***` / `*****`
      // pyramids, right-aligned tables), and worse, accepted a wrong answer
      // that omitted the leading spaces entirely. Leading whitespace is now
      // left intact on this side so checkers.js (whichever mode
      // problem.checker selects) is the single transformation, applied
      // identically to both sides of the compare.
      resolve({
        verdict,
        stdout: trimTrailing(stdout),
        stderr: trimTrailing(stderr),
        // Peak survives the watch being stopped, so an MLE verdict still
        // reports how far the program actually got. Under jobrun it is the
        // job's peak committed memory (read from peak.kb on exit) - the watch
        // never samples the launcher's pid, so its own peak stays 0.
        memoryPeakKb: runner ? jobPeakKb : memoryWatch?.peakKb() ?? 0,
        ...extra,
      });
    };

    // Settle the verdict synchronously the instant the limit fires, then kill
    // as best-effort cleanup. Waiting for tree-kill's completion callback
    // before resolving loses a race against the child's own 'close' event
    // (which fires as soon as the kill signal lands, often before tree-kill's
    // shelled-out confirmation returns on Windows), previously misreporting
    // TLE/MLE as "Runtime Error". Under jobrun, killing the launcher's tree
    // takes the program with it (and KILL_ON_JOB_CLOSE backs that up).
    const timeoutTimer = setTimeout(() => {
      finish('Time Limit Exceeded');
      treeKill(child.pid, 'SIGKILL');
    }, timeLimitMs);

    // Settle-then-kill, same pattern as the time limit above. onExceeded
    // fires at most once, and memoryProbe.js keeps only one sample in flight,
    // so this cannot queue up probes the way the old setInterval(pidusage)
    // did under a slow sampler.
    //
    // Under jobrun the OS enforces the problem's limit itself, so only the
    // system free-memory backstop runs (processProbe: false) - child.pid is
    // the launcher, and its working set says nothing about the program.
    // Either way `finish` settles once, so a backstop kill and the program's
    // own exit can never both be reported.
    if (child.pid != null) {
      memoryWatch = startMemoryWatch(child.pid, {
        intervalMs: MEMORY_POLL_INTERVAL_MS,
        limitMb: memoryLimitMb,
        processProbe: !runner,
        // `reason` is 'limit' (this program's own working set passed the
        // problem's limit) or 'system' (the machine was running out of free
        // memory and this run was eating it). Both surface to the student as
        // the same Memory Limit Exceeded verdict - from their side the answer
        // is the same: the program tried to use too much memory.
        onExceeded: (peakKb, reason) => {
          finish('Memory Limit Exceeded', reason === 'system' ? { systemMemoryKill: true } : {});
          treeKill(child.pid, 'SIGKILL');
        },
      });
    }

    // A program that exits before reading its input (or exits instantly,
    // e.g. `int main(){}`) closes its stdin pipe out from under us - writing
    // to it then raises an EPIPE 'error' on the stream. With no listener,
    // that's an uncaught exception that crashes the whole judge process
    // (there's no domain-wide safety net for this specific stream). The
    // 'close' handler below already settles the verdict correctly either
    // way, so this listener only needs to stop the crash, not report
    // anything itself.
    child.stdin.on('error', () => {});

    let inputToWrite = input || '';
    if (!inputToWrite.endsWith('\n')) inputToWrite += '\n';
    child.stdin.write(inputToWrite);
    child.stdin.end();

    let outputBytes = 0;
    const trackOutput = (d) => {
      outputBytes += d.length;
      if (outputBytes > maxOutputBytes) {
        finish('Output Limit Exceeded');
        treeKill(child.pid, 'SIGKILL');
        return true;
      }
      return false;
    };

    child.stdout.on('data', (d) => {
      if (trackOutput(d)) return;
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      if (trackOutput(d)) return;
      stderr += d.toString();
    });

    child.on('error', (err) => {
      // With a runner, a spawn error is the launcher's (missing, blocked by
      // antivirus...), not the student's - execute() retries without it.
      finish('Runtime Error', { stderr: err.message, launcherFailed: !!runner });
    });

    child.on('close', (code) => {
      if (settled) return;
      if (runner) {
        try { jobPeakKb = parseInt(fs.readFileSync(peakFile, 'utf8'), 10) || 0; } catch { /* no stats written */ }
        if (code === JOBRUN_EXIT_HELPER) {
          return finish('Runtime Error', { stderr: stderr || 'Could not start the program.', launcherFailed: true });
        }
      }
      // jobrun saw the job's memory cap hit, or the program died on a refused
      // allocation (std::bad_alloc) - see isAllocationFailure in memory.js.
      if (isAllocationFailure(code, stderr, !!runner)) return finish('Memory Limit Exceeded');
      finish(code === 0 ? 'Ran' : 'Runtime Error');
    });
  });
}

module.exports = { execute };
