const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(require('child_process').exec);

const DEFAULT_TIMEOUT_MS = 10000;

// Compiles a C++ source file in workDir. Returns { execPath } on success,
// or throws an Error carrying `.stderr` (compiler diagnostics) on failure.
// `timeoutMs` is admin-configurable (see JudgeSettings) - defaults to 10s.
async function compile(sourceCode, workDir, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const sourcePath = path.join(workDir, 'sub.cpp');
  const execPath = path.join(workDir, process.platform === 'win32' ? 'sub.exe' : 'sub');

  fs.writeFileSync(sourcePath, sourceCode);

  try {
    await execPromise(`g++ "${sourcePath}" -O2 -o "${execPath}"`, { timeout: timeoutMs });
  } catch (err) {
    const compileError = new Error('Compilation Error');
    compileError.stderr = err.stderr || err.message;
    throw compileError;
  }

  return { execPath };
}

module.exports = { compile };
