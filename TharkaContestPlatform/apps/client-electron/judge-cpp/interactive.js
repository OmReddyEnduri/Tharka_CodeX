const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const treeKill = require('tree-kill');
// Non-overlapping child-memory sampler - see memoryProbe.js. This replaced
// pidusage because its Windows backend spawns a PowerShell + WMI query per
// sample, which a long-lived interactive session used to stack up without
// bound (the sampler was a setInterval(async ...) with no overlap guard).
const { startMemoryWatch } = require('./memoryProbe');
const { getJobRunner, markJobRunnerBroken, isAllocationFailure, JOBRUN_EXIT_HELPER } = require('./memory');

const { compile, cleanupWorkDir } = require('./compile');
const { staticCheck } = require('./staticCheck');

const DEFAULT_MAX_SESSION_MS = 5 * 60 * 1000; // hard cap - runaway/malicious programs get killed, not left running
const DEFAULT_MEMORY_LIMIT_MB = 256;
const MEMORY_POLL_INTERVAL_MS = 1000;
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
    this._memoryWatch = null;
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

    this._sessionTimer = setTimeout(() => {
      settle({ status: 'Time Limit Exceeded', message: `Session exceeded the max run time (${maxSessionMs / 1000}s).` });
      this._kill();
    }, maxSessionMs);

    const memoryLimitMessage = `Program exceeded the ${memoryLimitMb}MB memory limit.`;
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

    // Spawns the program, through jobrun.exe when it is available (Windows:
    // hard OS memory cap, 1 process, dies with the launcher, below-normal
    // priority - see memory.js). If the launcher itself fails to start, it is
    // marked broken and the program is launched again directly, under
    // memoryProbe sampling - a bad launcher must not cost the student a run.
    const launch = (runner) => {
      // cwd = this session's temp work dir, so relative-path file writes land
      // in a folder that is deleted afterwards (not the app/server directory).
      let child;
      try {
        child = runner
          ? spawn(runner, [String(Math.floor(memoryLimitMb * 1024 * 1024)), '-', execPath], { windowsHide: true, cwd: this.workDir })
          : spawn(execPath, [], { windowsHide: true, cwd: this.workDir });
      } catch (err) {
        // spawn() THROWS (rather than emitting 'error') for some failures -
        // e.g. `spawn UNKNOWN` for a corrupt or antivirus-mangled exe.
        if (runner) {
          markJobRunnerBroken(err.message);
          launch(null);
          return;
        }
        clearTimeout(this._sessionTimer);
        settle({ status: 'Runtime Error', message: err.message });
        this._cleanup();
        return;
      }
      this.child = child;
      // A CPU-bound program gets a full core for the whole session; at
      // below-normal priority the UI and the rest of the OS stay responsive.
      try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* best effort */ }

      // Events from a launch that has since been replaced (launcher failure ->
      // direct retry) or torn down must not touch the session.
      const current = () => this.child === child;

      // A program that exits while the student is mid-keystroke (or right
      // after it stops reading input) closes its stdin pipe out from under
      // write() below - even with the writable check there, spawn/exit and a
      // renderer-driven write are two independent event sources, so the check
      // can pass a moment before the pipe actually closes. Writing to a closed
      // pipe raises an EPIPE 'error'; with no listener that's an uncaught
      // exception that crashes the whole Electron/server process, not just
      // this one session.
      child.stdin.on('error', () => {});

      const fallBack = (why) => {
        markJobRunnerBroken(why);
        this._memoryWatch?.stop();
        this._memoryWatch = null;
        if (this._settled || this._stopped) {
          this._cleanup();
          return;
        }
        launch(null);
      };

      // A live session can run for minutes, so this is the one place a leaking
      // sampler really hurt: at one spawned probe per tick with no overlap
      // guard, the old implementation kept several PowerShell/WMI providers
      // alive for the whole session on a Windows box. memoryProbe.js keeps
      // exactly one probe in flight and costs a ~180ms tasklist call. Under
      // jobrun only the system free-memory backstop runs: the OS enforces the
      // limit itself, and child.pid is the launcher, not the program.
      if (child.pid != null) {
        this._memoryWatch = startMemoryWatch(child.pid, {
          intervalMs: MEMORY_POLL_INTERVAL_MS,
          limitMb: memoryLimitMb,
          processProbe: !runner,
          onExceeded: (peakKb, reason) => {
            if (!current()) return;
            settle({
              status: 'Memory Limit Exceeded',
              message:
                reason === 'system'
                  ? "Stopped before it could freeze the computer: the program was consuming the machine's free memory."
                  : memoryLimitMessage,
            });
            this._kill();
          },
        });
      }

      // Last few hundred chars of stderr, so a "bad_alloc" split across two
      // chunks is still seen.
      let stderrTail = '';
      child.stdout.on('data', (d) => {
        if (!current() || trackOutput(d)) return;
        onStdout(d.toString());
      });
      child.stderr.on('data', (d) => {
        if (!current() || trackOutput(d)) return;
        const text = d.toString();
        stderrTail = (stderrTail + text).slice(-512);
        // jobrun's own diagnostics (launcher failure) are not program output.
        if (runner && text.startsWith('jobrun: ')) return;
        onStderr(text);
      });
      child.on('error', (err) => {
        if (!current()) return;
        // With a runner, a spawn error is the launcher's, not the program's.
        if (runner) return fallBack(err.message);
        settle({ status: 'Runtime Error', message: err.message });
        this._cleanup();
      });
      child.on('close', (code) => {
        if (!current()) return;
        if (runner && code === JOBRUN_EXIT_HELPER) return fallBack(stderrTail.trim() || 'launcher exited with a helper failure');
        clearTimeout(this._sessionTimer);
        this._memoryWatch?.stop();
        // jobrun saw the job's memory cap hit, or the program died on a
        // refused allocation (std::bad_alloc) - see memory.js.
        if (isAllocationFailure(code, stderrTail, !!runner)) settle({ status: 'Memory Limit Exceeded', message: memoryLimitMessage });
        else settle({ status: 'Exited', code });
        this._cleanup();
      });
    };

    launch(getJobRunner());
  }

  write(data) {
    if (this.child && this.child.stdin.writable) {
      this.child.stdin.write(data);
    }
  }

  _kill() {
    clearTimeout(this._sessionTimer);
    this._memoryWatch?.stop();
    // pid is undefined when the spawn itself failed; tree-kill throws on that.
    if (this.child?.pid != null) treeKill(this.child.pid, 'SIGKILL');
  }

  stop() {
    this._stopped = true;
    this._kill();
    this._cleanup();
  }

  _cleanup() {
    // Windows holds a file lock on a just-SIGKILL'd process's own exe, so the
    // first delete attempt loses the race against taskkill finishing -
    // cleanupWorkDir retries until the lock clears instead of leaking the
    // folder (see its comment in compile.js).
    cleanupWorkDir(this.workDir);
    this.child = null;
  }
}

module.exports = { InteractiveSession };
