const { spawn } = require('child_process');
const treeKill = require('tree-kill');
const pidusage = require('pidusage');

const MEMORY_POLL_INTERVAL_MS = 50;
const MAX_OUTPUT_BYTES = 1 * 1024 * 1024; // 1MB - well beyond any legitimate judge-problem output; guards a print-flood loop

// Runs a compiled executable against one input, enforcing time and memory
// limits via subprocess supervision (no OS-level sandbox - see staticCheck.js
// for why that's an accepted tradeoff here). Resolves with a result object,
// never rejects - callers branch on `verdict`.
function execute(execPath, input, { timeLimitMs, memoryLimitMb }) {
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
      resolve({ verdict, stdout: stdout.trim(), stderr: stderr.trim(), memoryPeakKb, ...extra });
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
      } catch {
        // process already exited between the interval firing and pidusage
        // reading it - nothing to do, the 'close' handler will settle this.
      }
    }, MEMORY_POLL_INTERVAL_MS);

    let inputToWrite = input || '';
    if (!inputToWrite.endsWith('\n')) inputToWrite += '\n';
    child.stdin.write(inputToWrite);
    child.stdin.end();

    let outputBytes = 0;
    const trackOutput = (d) => {
      outputBytes += d.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
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
