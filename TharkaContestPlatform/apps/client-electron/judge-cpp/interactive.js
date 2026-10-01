const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const treeKill = require('tree-kill');
const { getMemoryBytes, getJobRunner, JOBRUN_EXIT_MLE, JOBRUN_EXIT_HELPER } = require('./memory');

const { compile } = require('./compile');
const { staticCheck } = require('./staticCheck');

const DEFAULT_MAX_SESSION_MS = 5 * 60 * 1000; // hard cap - runaway/malicious programs get killed, not left running
const DEFAULT_MEMORY_LIMIT_MB = 256;
const MEMORY_POLL_MS = 250;
// Consecutive failed memory samples on a still-running program before it is
// killed: running with no memory limit can freeze the PC.
const MAX_MEMORY_POLL_FAILURES = 8;
const DEFAULT_MAX_OUTPUT_BYTES = 1 * 1024 * 1024; // 1MB - guards against a print-flood loop filling memory over a long session

// A live, interactive run: unlike run()/runOnce() (which supply one fixed
// input blob and wait for exit), this keeps the process's stdin open so a
// terminal-style UI can feed it lines while it's running and stream stdout
// back as it's produced - for the standalone compiler page, not judging.
class InteractiveSession {
  constructor() {
    this.child = null;
    this.workDir = null;
    this._sessionTimer = null;
    this._memoryTimer = null;
    this._settled = false;
    // Set by stop() if it's called while still compiling (this.child is
    // still null then, so _kill()'s `if (this.child)` is a no-op) - without
    // this, a caller that starts a new session before the old one finishes
    // compiling (re-clicking Run quickly) would find its "stopped" old
    // session spawn anyway once compile() resolves, orphaned but still
    // wired to the same onStdout/onStderr/onExit callbacks - interleaving
    // two unrelated programs' output into the same terminal, unstoppable
    // from the UI until it hits its own session timeout.
    this._stopped = false;
  }

  // `settings` (all optional, admin-configurable via JudgeSettings) lets the
  // Compiler page's interactive Console respect the same admin-controlled
  // limits/blocklist as contest judging, instead of these being separately
  // hardcoded here.
  async start(sourceCode, { onStdout, onStderr, onExit }, settings = {}) {
    const {
      maxSessionMs = DEFAULT_MAX_SESSION_MS,
      memoryLimitMb = DEFAULT_MEMORY_LIMIT_MB,
      maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
      blockedKeywords,
      // Opt-in -DLOCAL, from the Compiler page's settings - see index.js's
      // runOnce for why this only ever applies to this playground, not
      // contest judging.
      defineLocal,
    } = settings;

    // Settle exactly once: a killed process's own 'close' event can still
    // fire after a timeout/memory-limit kill already reported the verdict
    // (same race as execute.js) - without this guard the caller would see
    // "Time Limit Exceeded" immediately followed by a spurious "Exited".
    const settle = (info) => {
      if (this._settled) return;
      this._settled = true;
      onExit(info);
    };

    const check = staticCheck(sourceCode, blockedKeywords);
    if (check.blocked) {
      settle({ status: 'Error', message: check.reason });
      return;
    }

    this.workDir = path.join(os.tmpdir(), 'contest-compiler', crypto.randomUUID());
    fs.mkdirSync(this.workDir, { recursive: true });

    let execPath;
    try {
      ({ execPath } = await compile(sourceCode, this.workDir, undefined, defineLocal ? ['LOCAL'] : []));
    } catch (err) {
      settle({ status: 'Compilation Error', message: err.stderr });
      this._cleanup();
      return;
    }

    // stop() was called while we were still compiling - don't spawn a
    // process nothing references anymore.
    if (this._stopped) {
      this._cleanup();
      return;
    }

    // Windows: run inside jobrun.exe's Job Object (hard OS memory cap, 1 process) - see memory.js. Else poll.
    const runner = getJobRunner();
    const child = (this.child = runner
      ? spawn(runner, [String(Math.floor(memoryLimitMb * 1024 * 1024)), '-', execPath], { windowsHide: true, cwd: this.workDir })
      : spawn(execPath, [], { windowsHide: true, cwd: this.workDir }));
    let sawBadAlloc = false;
    // A CPU-bound student program gets a full core for its whole run; at below-normal
    // priority the UI and the rest of the OS stay responsive while it spins.
    try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* best effort */ }

    // A program that exits while the student is mid-keystroke (or right
    // after it stops reading input) closes its stdin pipe out from under
    // write() below - even with the writable check there, spawn/exit and a
    // renderer-driven write are two independent event sources, so the check
    // can pass a moment before the pipe actually closes. Writing to a closed
    // pipe raises an EPIPE 'error'; with no listener that's an uncaught
    // exception that crashes the whole Electron/server process, not just
    // this one session.
    this.child.stdin.on('error', () => {});

    this._sessionTimer = setTimeout(() => {
      settle({ status: 'Time Limit Exceeded', message: `Session exceeded the max run time (${maxSessionMs / 1000}s).` });
      this._kill();
    }, maxSessionMs);

    let polling = false;
    let pollFailures = 0;
    this._memoryTimer = runner ? null : setInterval(async () => {
      // Polls never overlap: each sample spawns tasklist.exe, which can be slower than the interval.
      if (!this.child || polling) return;
      const child = this.child;
      polling = true;
      try {
        const memBytes = await getMemoryBytes(child.pid);
        // Ended/stopped while awaiting (pid may be reused) - drop the sample.
        if (this.child !== child || this._settled) return;
        pollFailures = 0;
        if (memBytes / 1024 / 1024 > memoryLimitMb) {
          settle({ status: 'Memory Limit Exceeded' });
          this._kill();
        }
      } catch (err) {
        // Usually the process already exited - the 'close' handler below
        // settles it. But if it is still running and sampling keeps failing,
        // the memory limit is silently off, so fail closed.
        if (this.child === child && !this._settled && child.exitCode === null && !child.killed) {
          pollFailures++;
          if (pollFailures === 1) {
            console.warn(`[judge-cpp] memory sample failed for still-running pid ${child.pid}:`, err.message);
          }
          if (pollFailures >= MAX_MEMORY_POLL_FAILURES) {
            settle({ status: 'Error', message: 'Memory monitor unavailable - run aborted for safety.' });
            this._kill();
          }
        }
      } finally {
        polling = false;
      }
    }, MEMORY_POLL_MS);

    let outputBytes = 0;
    const trackOutput = (d) => {
      outputBytes += d.length;
      if (outputBytes > maxOutputBytes) {
        settle({ status: 'Output Limit Exceeded', message: `Program produced more than ${maxOutputBytes / 1024 / 1024}MB of output.` });
        this._kill();
        return true;
      }
      return false;
    };

    this.child.stdout.on('data', (d) => {
      if (trackOutput(d)) return;
      onStdout(d.toString());
    });
    this.child.stderr.on('data', (d) => {
      if (trackOutput(d)) return;
      if (runner && !sawBadAlloc && d.includes('bad_alloc')) sawBadAlloc = true;
      onStderr(d.toString());
    });
    this.child.on('error', (err) => {
      settle({ status: 'Runtime Error', message: err.message });
      this._cleanup();
    });
    this.child.on('close', (code) => {
      clearTimeout(this._sessionTimer);
      clearInterval(this._memoryTimer);
      if (runner && (code === JOBRUN_EXIT_MLE || sawBadAlloc)) settle({ status: 'Memory Limit Exceeded' });
      else if (runner && code === JOBRUN_EXIT_HELPER) settle({ status: 'Error', message: 'Could not start the program.' });
      else settle({ status: 'Exited', code });
      this._cleanup();
    });
  }

  write(data) {
    if (this.child && this.child.stdin.writable) {
      this.child.stdin.write(data);
    }
  }

  _kill() {
    clearTimeout(this._sessionTimer);
    clearInterval(this._memoryTimer);
    if (this.child) treeKill(this.child.pid, 'SIGKILL');
  }

  stop() {
    this._stopped = true;
    this._kill();
    this._cleanup();
  }

  _cleanup() {
    // Windows can briefly hold a file lock on a just-SIGKILL'd process's own
    // exe, which can fail this delete - previously silent, so a workDir
    // leak from that would accumulate unnoticed over a long contest.
    if (this.workDir) {
      fs.rm(this.workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, (err) => {
        if (err) console.warn(`[judge-cpp] failed to clean up ${this.workDir}:`, err.message);
      });
    }
    this.child = null;
  }
}

module.exports = { InteractiveSession };
