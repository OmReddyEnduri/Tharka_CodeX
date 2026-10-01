// The "code" checker: the problem's admin writes a C++ function
//
//     bool checker(string expected, string user) { ... return true/false; }
//
// and that function - not a fixed rule - decides whether a student's output
// is correct. Used for answers with many valid forms (any valid path, any
// permutation that satisfies a property, a float within a problem-specific
// error, "print any one solution", ...).
//
// How it runs: the function is wrapped in a tiny harness (PRELUDE + the
// admin's code + HARNESS) that reads the two strings from files named on its
// command line, calls checker(expected, user), and exits 0 (correct) or 1
// (wrong). The wrapped program is compiled ONCE per distinct checker source
// and cached on disk, so judging a submission only costs one extra process
// launch per test case, not a compile.
//
// Both the server and the Electron client run this same module (the client
// mirrors packages/judge-cpp - see scripts/check-judge-cpp-drift.js), so a
// problem grades identically whether it was judged on the server or offline
// on a lab laptop. The checker source travels to laptops inside the problem
// (problem.checkerCode) via the sync snapshot; it is stripped from anything a
// student's screen receives (see the server's lib/hiddenTestCases.js and the
// Electron main.js redaction).
//
// What the function receives: both strings with Windows line endings turned
// into '\n' and trailing whitespace/newlines at the very END removed (the
// same "a final endl can never be the reason it failed" rule every other
// checker applies). Everything else - inner spaces, blank lines, case - is
// exactly as printed, so the admin's code decides what matters.
//
// Admin code is trusted (only the admin site can save it), so it is not put
// through the student keyword blocklist, but it IS time-limited, so a buggy
// checker can never hang judging.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const treeKill = require('tree-kill');
const { compile } = require('./compile');

// Bump when PRELUDE/HARNESS change, so stale cached builds are not reused.
const HARNESS_VERSION = 1;
const CHECKER_COMPILE_TIMEOUT_MS = 60 * 1000; // <bits/stdc++.h> is slow to compile on lab PCs
const CHECKER_RUN_TIMEOUT_MS = 5 * 1000;
const MAX_CHECKER_SOURCE_BYTES = 64 * 1024;
const CACHE_DIR = path.join(os.tmpdir(), 'contest-checkers');

// Exit codes from the harness.
const EXIT_CORRECT = 0;
const EXIT_WRONG = 1;

// `#line 1` makes g++ report errors against the admin's own line numbers.
const PRELUDE = '#include <bits/stdc++.h>\nusing namespace std;\n#line 1 "checker.cpp"\n';
const HARNESS = `
#line 100000 "tharka-checker-harness.cpp"
static std::string tharka_read_whole_file(const char* p) {
  std::ifstream f(p, std::ios::binary);
  std::ostringstream s;
  s << f.rdbuf();
  return s.str();
}
int main(int argc, char** argv) {
  if (argc < 3) return 3;
  std::string tharka_expected = tharka_read_whole_file(argv[1]);
  std::string tharka_user = tharka_read_whole_file(argv[2]);
  return checker(tharka_expected, tharka_user) ? 0 : 1;
}
`;

// What a new "code" problem starts with in the admin editor.
const CHECKER_CODE_TEMPLATE = `// Return true if the student's output is correct.
//   expected = this test case's expected output
//   user     = what the student's program printed
// Both use '\\n' line endings, with trailing spaces/newlines at the end removed.
bool checker(string expected, string user) {
    return expected == user;
}
`;

function normalizeSide(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+$/, '');
}

function cacheKey(code) {
  return crypto.createHash('sha256').update(`v${HARNESS_VERSION}\n${code}`).digest('hex').slice(0, 24);
}

const inFlight = new Map(); // cacheKey -> Promise<execPath>

// Compiles (or reuses) the checker. Resolves the executable path; rejects with
// an Error whose `.stderr` holds the compiler output when the code is bad.
function getCompiledChecker(code) {
  if (typeof code !== 'string' || !code.trim()) {
    return Promise.reject(Object.assign(new Error('Checker code is empty'), { stderr: 'Checker code is empty.' }));
  }
  if (Buffer.byteLength(code) > MAX_CHECKER_SOURCE_BYTES) {
    return Promise.reject(Object.assign(new Error('Checker code too large'), { stderr: 'Checker code is larger than 64KB.' }));
  }
  const key = cacheKey(code);
  const finalDir = path.join(CACHE_DIR, key);
  const exeName = process.platform === 'win32' ? 'sub.exe' : 'sub';
  const finalExe = path.join(finalDir, exeName);
  if (fs.existsSync(finalExe)) return Promise.resolve(finalExe);
  if (inFlight.has(key)) return inFlight.get(key);

  const job = (async () => {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const tmpDir = path.join(CACHE_DIR, `${key}-${crypto.randomUUID()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      await compile(PRELUDE + code + HARNESS, tmpDir, CHECKER_COMPILE_TIMEOUT_MS);
      try {
        fs.renameSync(tmpDir, finalDir);
      } catch {
        // Another process (server + its own judge, two Electron windows)
        // finished the same checker first - use theirs.
        if (!fs.existsSync(finalExe)) throw new Error('Could not store the compiled checker');
        fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, () => {});
      }
      return finalExe;
    } catch (err) {
      fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, () => {});
      throw err;
    }
  })();
  inFlight.set(key, job);
  job.then(
    () => inFlight.delete(key),
    () => inFlight.delete(key)
  );
  return job;
}

// For the admin site: does this checker compile? Resolves { ok: true } or
// { ok: false, error } - never rejects.
async function validateCheckerCode(code) {
  try {
    await getCompiledChecker(code);
    return { ok: true };
  } catch (err) {
    const raw = (err && (err.stderr || err.message)) || 'Checker failed to compile';
    const hint = /'checker' was not declared/.test(raw)
      ? 'Your code must define the function:  bool checker(string expected, string user)\n\n'
      : '';
    return { ok: false, error: hint + raw };
  }
}

// Runs one comparison. Resolves { passed: boolean } or, when the checker
// itself misbehaves (crash, timeout, odd exit code), { error: string } - the
// caller reports that as a checker problem, never as the student's fault.
function runCodeChecker(execPath, expectedRaw, userRaw, workDir) {
  return new Promise((resolve) => {
    const dir = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'contest-chk-'));
    const id = crypto.randomUUID().slice(0, 8);
    const expectedFile = path.join(dir, `chk-expected-${id}.txt`);
    const userFile = path.join(dir, `chk-user-${id}.txt`);
    try {
      fs.writeFileSync(expectedFile, normalizeSide(expectedRaw));
      fs.writeFileSync(userFile, normalizeSide(userRaw));
    } catch (err) {
      resolve({ error: `Checker could not be prepared: ${err.message}` });
      return;
    }
    const cleanup = () => {
      for (const f of [expectedFile, userFile]) fs.rm(f, { force: true }, () => {});
      if (!workDir) fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, () => {});
    };

    let settled = false;
    let stderr = '';
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(value);
    };

    const child = spawn(execPath, [expectedFile, userFile], { windowsHide: true, cwd: dir });
    const timer = setTimeout(() => {
      finish({ error: `Checker took longer than ${CHECKER_RUN_TIMEOUT_MS / 1000}s` });
      treeKill(child.pid, 'SIGKILL');
    }, CHECKER_RUN_TIMEOUT_MS);
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => {
      if (stderr.length < 4096) stderr += d.toString();
    });
    child.on('error', (err) => finish({ error: `Checker could not start: ${err.message}` }));
    child.on('close', (code) => {
      if (code === EXIT_CORRECT) finish({ passed: true });
      else if (code === EXIT_WRONG) finish({ passed: false });
      else finish({ error: `Checker crashed (exit code ${code})${stderr ? `: ${stderr.trim()}` : ''}` });
    });
  });
}

module.exports = {
  CHECKER_CODE_TEMPLATE,
  getCompiledChecker,
  validateCheckerCode,
  runCodeChecker,
  normalizeCheckerSide: normalizeSide,
};
