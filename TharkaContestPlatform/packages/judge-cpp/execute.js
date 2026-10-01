const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const treeKill = require('tree-kill');
const fs = require('fs');
const { getMemoryBytes, getJobRunner, markJobRunnerBroken, JOBRUN_EXIT_MLE, JOBRUN_EXIT_HELPER } = require('./memory');

// Each memory sample spawns a tasklist.exe (see memory.js), which can take a
// few hundred ms on a loaded machine. Polls never overlap (see the in-flight
// guard below), so this is a minimum spacing, not a guaranteed rate.
const MEMORY_POLL_INTERVAL_MS = 250;
// Consecutive failed samples on a still-running program before we give up on
// monitoring and kill it: running with no memory limit can freeze the PC.
const MAX_MEMORY_POLL_FAILURES = 8;
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
  const result = await executeOnce(execPath, input, opts);
  // The launcher itself could not start (not the student's program) - disable it and run again directly.
  if (result.launcherFailed) {
    markJobRunnerBroken(result.stderr);
    return executeOnce(execPath, input, opts);
  }
  return result;
}

function executeOnce(execPath, input, { timeLimitMs, memoryLimitMb, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES }) {
  return new Promise((resolve) => {
    // cwd = the run's own temp dir, so relative-path file writes land in a folder that is deleted afterwards (not the app dir).
    // On Windows the program runs inside jobrun.exe's Job Object (hard OS memory cap, 1 process, dies with
    // the launcher) - no polling needed. Without it, fall back to sampling memory below.
    const runner = getJobRunner();
    const peakFile = runner ? path.join(path.dirname(execPath), 'peak.kb') : null;
    const child = runner
      ? spawn(runner, [String(Math.floor(memoryLimitMb * 1024 * 1024)), peakFile, execPath], { windowsHide: true, cwd: path.dirname(execPath) })
      : spawn(execPath, [], { windowsHide: true, cwd: path.dirname(execPath) });
    // A CPU-bound student program gets a full core for its whole run; at below-normal
    // priority the UI and the rest of the OS stay responsive while it spins.
    try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* best effort */ }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let memoryPeakKb = 0;

    const finish = (verdict, extra = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearInterval(memoryTimer);
      // Trailing-only trim, NOT a full .trim(). A full trim also ate LEADING
      // whitespace, and only from the program's actual output - the admin's
      // expected output was never leading-trimmed to match. That asymmetry
      // failed every pattern-printing problem (`  *` / ` ***` / `*****`
      // pyramids, right-aligned tables), and worse, accepted a wrong answer
      // that omitted the leading spaces entirely. Leading whitespace is now
      // left intact on this side so index.js's checker (normalizeExactOutput
      // or tokenizeOutput, depending on problem.checker) is the single
      // transformation, applied identically to both sides of the compare.
      resolve({ verdict, stdout: trimTrailing(stdout), stderr: trimTrailing(stderr), memoryPeakKb, ...extra });
    };

    // Settle the verdict synchronously the instant the limit fires, then kill
    // as best-effort cleanup. Waiting for tree-kill's completion callback
    // before resolving loses a race against the child's own 'close' event
    // (which fires as soon as the kill signal lands, often before tree-kill's
    // shelled-out confirmation returns on Windows), previously misreporting
    // TLE/MLE as "Runtime Error".
    const timeoutTimer = setTimeout(() => {
      finish('Time Limit Exceeded');
      treeKill(child.pid, 'SIGKILL');
    }, timeLimitMs);

    let polling = false;
    let pollFailures = 0;
    const memoryTimer = runner ? null : setInterval(async () => {
      if (polling || settled) return;
      polling = true;
      try {
        const memBytes = await getMemoryBytes(child.pid);
        // The run may have ended while we awaited; its pid could even have
        // been reused, so never act on a stale sample.
        if (settled) return;
        pollFailures = 0;
        const kb = memBytes / 1024;
        if (kb > memoryPeakKb) memoryPeakKb = kb;
        if (kb > memoryLimitMb * 1024) {
          finish('Memory Limit Exceeded');
          treeKill(child.pid, 'SIGKILL');
        }
      } catch (err) {
        // The common case is the process already exited between the
        // interval firing and the sample landing - the 'close' handler
        // settles that. But if Node still thinks the child is running and
        // sampling keeps failing, the memory limit is silently off, so
        // fail closed rather than let a runaway allocation freeze the PC.
        if (!settled && child.exitCode === null && !child.killed) {
          pollFailures++;
          if (pollFailures === 1) {
            console.warn(`[judge-cpp] memory sample failed for still-running pid ${child.pid}:`, err.message);
          }
          if (pollFailures >= MAX_MEMORY_POLL_FAILURES) {
            finish('Runtime Error', { stderr: 'Memory monitor unavailable - run aborted for safety.' });
            treeKill(child.pid, 'SIGKILL');
          }
        }
      } finally {
        polling = false;
      }
    }, MEMORY_POLL_INTERVAL_MS);

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
      finish('Runtime Error', { stderr: err.message, launcherFailed: !!runner });
    });

    child.on('close', (code) => {
      if (settled) return;
      if (runner) {
        try { memoryPeakKb = parseInt(fs.readFileSync(peakFile, 'utf8'), 10) || 0; } catch { /* no stats written */ }
        // jobrun saw the cap hit, or the program died on a refused allocation (std::bad_alloc), which a
        // single oversized request can do without tripping the job's limit notification.
        if (code === JOBRUN_EXIT_MLE || /bad_alloc/.test(stderr)) return finish('Memory Limit Exceeded');
        if (code === JOBRUN_EXIT_HELPER) return finish('Runtime Error', { stderr: stderr || 'Could not start the program.', launcherFailed: true });
      }
      finish(code === 0 ? 'Ran' : 'Runtime Error');
    });
  });
}

module.exports = { execute };
