const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const treeKill = require('tree-kill');
const pidusage = require('pidusage');

const { compile } = require('./compile');
const { staticCheck } = require('./staticCheck');

const DEFAULT_MAX_SESSION_MS = 5 * 60 * 1000; // hard cap - runaway/malicious programs get killed, not left running
const DEFAULT_MEMORY_LIMIT_MB = 256;
const MEMORY_POLL_MS = 500;
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
      ({ execPath } = await compile(sourceCode, this.workDir));
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

    this.child = spawn(execPath, [], { windowsHide: true });

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

    this._memoryTimer = setInterval(async () => {
      if (!this.child) return;
      try {
        const stats = await pidusage(this.child.pid);
        if (stats.memory / 1024 / 1024 > memoryLimitMb) {
          settle({ status: 'Memory Limit Exceeded' });
          this._kill();
        }
      } catch (err) {
        // Usually the process already exited - the 'close' handler below
        // settles it. But if Node still thinks it's running and pidusage
        // still failed, that's worth knowing about: most likely pidusage's
        // Windows backend (wmic.exe) itself is broken/missing, which would
        // otherwise silently disable memory-limit enforcement with zero
        // visibility.
        if (this.child && this.child.exitCode === null && !this.child.killed) {
          console.warn(`[judge-cpp] pidusage failed for still-running pid ${this.child.pid}:`, err.message);
        }
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
      onStderr(d.toString());
    });
    this.child.on('error', (err) => {
      settle({ status: 'Runtime Error', message: err.message });
      this._cleanup();
    });
    this.child.on('close', (code) => {
      clearTimeout(this._sessionTimer);
      clearInterval(this._memoryTimer);
      settle({ status: 'Exited', code });
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
      fs.rm(this.workDir, { recursive: true, force: true }, (err) => {
        if (err) console.warn(`[judge-cpp] failed to clean up ${this.workDir}:`, err.message);
      });
    }
    this.child = null;
  }
}

module.exports = { InteractiveSession };
