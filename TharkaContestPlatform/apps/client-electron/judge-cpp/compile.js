const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(require('child_process').exec);

// Compiles a C++ source file in workDir. Returns { execPath } on success,
// or throws an Error carrying `.stderr` (compiler diagnostics) on failure.
async function compile(sourceCode, workDir) {
  const sourcePath = path.join(workDir, 'sub.cpp');
  const execPath = path.join(workDir, process.platform === 'win32' ? 'sub.exe' : 'sub');

  fs.writeFileSync(sourcePath, sourceCode);

  try {
    await execPromise(`g++ "${sourcePath}" -O2 -o "${execPath}"`, { timeout: 10000 });
  } catch (err) {
    const compileError = new Error('Compilation Error');
    compileError.stderr = err.stderr || err.message;
    throw compileError;
  }

  return { execPath };
}

module.exports = { compile };
