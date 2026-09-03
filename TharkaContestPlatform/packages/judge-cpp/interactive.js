const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const treeKill = require('tree-kill');
const pidusage = require('pidusage');

const { compile } = require('./compile');
const { staticCheck } = require('./staticCheck');

const MAX_SESSION_MS = 5 * 60 * 1000; // hard cap - runaway/malicious programs get killed, not left running
const MEMORY_LIMIT_MB = 256;
const MEMORY_POLL_MS = 500;
const MAX_OUTPUT_BYTES = 1 * 1024 * 1024; // 1MB - guards against a print-flood loop filling memory over a 5min session

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
  }

  async start(sourceCode, { onStdout, onStderr, onExit }) {
    // Settle exactly once: a killed process's own 'close' event can still
    // fire after a timeout/memory-limit kill already reported the verdict
    // (same race as execute.js) - without this guard the caller would see
    // "Time Limit Exceeded" immediately followed by a spurious "Exited".
    const settle = (info) => {
      if (this._settled) return;
      this._settled = true;
      onExit(info);
    };

    const check = staticCheck(sourceCode);
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

    this.child = spawn(execPath, [], { windowsHide: true });

    this._sessionTimer = setTimeout(() => {
      settle({ status: 'Time Limit Exceeded', message: `Session exceeded the max run time (${MAX_SESSION_MS / 1000}s).` });
      this._kill();
    }, MAX_SESSION_MS);

    this._memoryTimer = setInterval(async () => {
      if (!this.child) return;
      try {
        const stats = await pidusage(this.child.pid);
        if (stats.memory / 1024 / 1024 > MEMORY_LIMIT_MB) {
          settle({ status: 'Memory Limit Exceeded' });
          this._kill();
        }
      } catch {
        // process already exited - the 'close' handler below settles it.
      }
    }, MEMORY_POLL_MS);

    let outputBytes = 0;
    const trackOutput = (d) => {
      outputBytes += d.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        settle({ status: 'Output Limit Exceeded', message: `Program produced more than ${MAX_OUTPUT_BYTES / 1024 / 1024}MB of output.` });
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
    this._kill();
    this._cleanup();
  }

  _cleanup() {
    if (this.workDir) fs.rm(this.workDir, { recursive: true, force: true }, () => {});
    this.child = null;
  }
}

module.exports = { InteractiveSession };
