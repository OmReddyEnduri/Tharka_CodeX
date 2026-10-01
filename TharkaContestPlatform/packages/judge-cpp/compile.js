const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const treeKill = require('tree-kill');

const DEFAULT_TIMEOUT_MS = 10000;

// Compiles a C++ source file in workDir. Returns { execPath } on success,
// or throws an Error carrying `.stderr` (compiler diagnostics) on failure.
// `timeoutMs` is admin-configurable (see JudgeSettings) - defaults to 10s.
//
// Uses spawn + tree-kill, not exec()'s built-in {timeout} - exec's timeout
// only kills the wrapping shell it runs the command through, not the actual
// g++/cc1plus/as/ld process tree underneath it (documented Node behavior).
// A hung compile (a runaway template-recursion pattern is a common,
// often-accidental way to trigger this) used to leave the real compiler
// process running at full CPU forever, invisible to the judge, with no
// verdict ever returned. spawn() with an argv array also sidesteps shell
// string-building entirely, same pattern already used in execute.js.
// `defines` (e.g. ['LOCAL']) becomes `-D<name>` compiler flags - used only by
// the standalone Compiler page's "Define LOCAL" setting (see runOnce/
// InteractiveSession.start), never by contest judging, which must always
// compile exactly as a real judge would.
function compile(sourceCode, workDir, timeoutMs = DEFAULT_TIMEOUT_MS, defines = []) {
  return new Promise((resolve, reject) => {
    const sourcePath = path.join(workDir, 'sub.cpp');
    const execPath = path.join(workDir, process.platform === 'win32' ? 'sub.exe' : 'sub');

    fs.writeFileSync(sourcePath, sourceCode);

    const defineArgs = defines.map((d) => `-D${d}`);
    const child = spawn('g++', [sourcePath, ...defineArgs, '-O2', '-fmax-errors=10', '-o', execPath], { windowsHide: true });

    let stderr = '';
    let settled = false;

    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      const compileError = new Error('Compilation Error');
      compileError.stderr = message;
      reject(compileError);
    };

    // Settle synchronously the instant the timeout fires, then kill as
    // best-effort cleanup - same settled-before-kill pattern as execute.js,
    // so a 'close' event that arrives after the kill can't also try to
    // resolve/reject.
    const timeoutTimer = setTimeout(() => {
      fail(`Compilation timed out after ${timeoutMs}ms`);
      treeKill(child.pid, 'SIGKILL');
    }, timeoutMs);

    child.stderr.on('data', (d) => {
      // A template-error bomb can emit tens of MB; keep only what a student can read.
      if (stderr.length < 65536) stderr += d.toString();
    });

    child.on('error', (err) => fail(err.message));

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (code === 0) {
        resolve({ execPath });
      } else {
        const compileError = new Error('Compilation Error');
        compileError.stderr = stderr || `g++ exited with code ${code}`;
        reject(compileError);
      }
    });
  });
}

module.exports = { compile };
