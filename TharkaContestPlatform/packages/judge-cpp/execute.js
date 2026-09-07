const { spawn } = require('child_process');
const treeKill = require('tree-kill');
const pidusage = require('pidusage');

// pidusage's Windows backend shells out to wmic.exe per call, which
// routinely takes longer than 50ms in practice - at that interval,
// overlapping wmic subprocesses stack up per judged run (worse under a
// submission rush). 500ms is still frequent enough to catch a runaway
// allocation well before it matters, and matches interactive.js's interval.
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
function execute(execPath, input, { timeLimitMs, memoryLimitMb, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES }) {
  return new Promise((resolve) => {
    const child = spawn(execPath, [], { windowsHide: true });

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

    const memoryTimer = setInterval(async () => {
      try {
        const stats = await pidusage(child.pid);
        const kb = stats.memory / 1024;
        if (kb > memoryPeakKb) memoryPeakKb = kb;
        if (kb > memoryLimitMb * 1024) {
          finish('Memory Limit Exceeded');
          treeKill(child.pid, 'SIGKILL');
        }
      } catch (err) {
        // The common case is the process already exited between the
        // interval firing and pidusage reading it - nothing to do, the
        // 'close' handler will settle this. But if Node still thinks the
        // child is running (no exit code yet) and pidusage still failed,
        // that's a different, worth-knowing-about failure - most likely
        // pidusage's Windows backend (wmic.exe) itself is broken/missing,
        // which would otherwise silently disable memory-limit enforcement
        // entirely with zero visibility.
        if (child.exitCode === null && !child.killed) {
          console.warn(`[judge-cpp] pidusage failed for still-running pid ${child.pid}:`, err.message);
        }
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
      finish('Runtime Error', { stderr: err.message });
    });

    child.on('close', (code) => {
      if (settled) return;
      finish(code === 0 ? 'Ran' : 'Runtime Error');
    });
  });
}

module.exports = { execute };
