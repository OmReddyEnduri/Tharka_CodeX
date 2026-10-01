const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { staticCheck } = require('./staticCheck');
const { compile, cleanupWorkDir } = require('./compile');
const { execute } = require('./execute');
// All the output-comparison rules live in checkers.js - see that file for the
// answer each mode gives and why. This module only wires them into a run.
const {
  compareOutput,
  getChecker,
  isValidChecker,
  normalizeCheckerConfig,
  CHECKER_IDS,
  DEFAULT_CHECKER,
  CUSTOM_DEFAULTS,
} = require('./checkers');
const { CHECKER_CODE_TEMPLATE, getCompiledChecker, runCodeChecker, validateCheckerCode } = require('./codeChecker');

const DEFAULT_TIME_LIMIT_MS = 2000;
const DEFAULT_MEMORY_LIMIT_MB = 256;

function makeWorkDir() {
  const workDir = path.join(os.tmpdir(), 'contest-judge', crypto.randomUUID());
  fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

// Runs `sourceCode` against `testCases` ([{input, output}]) with the given
// limits. Stops at the first failing test case (standard judge behavior).
// Never throws for judging outcomes (WA/TLE/MLE/RE/CE) - only for
// programmer errors (bad args). `checker` is the problem's own
// `problem.checker` field - one of checkers.js's ids, i.e. "token" (default)
// | "om" | "exact" | "numeric" | "unordered". Anything unrecognized -
// including undefined, for a problem saved before this field existed -
// resolves to the default, so an old problem keeps grading exactly the way
// it always did. Only problems that genuinely need a different rule opt into
// one via the admin problem editor's dropdown. `checkerConfig` is read only by
// the "custom" checker - every other mode ignores it, exactly as it ignores
// any other config a problem happens to carry (see checkers.js's
// normalizeCheckerConfig, which is what turns whatever was stored into a valid
// set of options).
// `checkerCode` is read only by the "code" checker: the admin's C++ defining
// `bool checker(string expected, string user)` (see codeChecker.js).
async function run({ sourceCode, testCases, timeLimit, memoryLimit, judgeSettings, checker, checkerConfig, checkerCode }) {
  if (!testCases || testCases.length === 0) {
    return { status: 'Error', message: 'No test cases found for this mode.' };
  }

  const checkerMode = getChecker(checker).id;

  const check = staticCheck(sourceCode, judgeSettings?.blockedKeywords);
  if (check.blocked) {
    return { status: 'Error', message: check.reason };
  }

  const timeLimitMs = timeLimit || DEFAULT_TIME_LIMIT_MS;
  const memoryLimitMb = memoryLimit || DEFAULT_MEMORY_LIMIT_MB;

  const workDir = makeWorkDir();

  try {
    let execPath;
    try {
      ({ execPath } = await compile(sourceCode, workDir, judgeSettings?.compileTimeoutMs));
    } catch (compileError) {
      return { status: 'Compilation Error', message: compileError.stderr, errorLog: compileError.stderr };
    }

    // "code" checker: compile (or reuse the cached build of) the admin's
    // checker before running anything. A broken checker is the problem's
    // fault, not the student's, so it is reported as a Checker Error.
    let checkerExe = null;
    if (checkerMode === 'code') {
      try {
        checkerExe = await getCompiledChecker(checkerCode);
      } catch (err) {
        return {
          status: 'Checker Error',
          message: "This problem's checker could not be compiled. Please tell the contest admin - your code was not judged.",
          errorLog: (err && (err.stderr || err.message)) || 'checker compile failed',
        };
      }
    }

    const results = [];
    let maxTime = 0;
    let overallVerdict = 'Accepted';

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startedAt = Date.now();
      const outcome = await execute(execPath, tc.input || '', { timeLimitMs, memoryLimitMb, maxOutputBytes: judgeSettings?.maxOutputBytes });
      const durationMs = Date.now() - startedAt;
      if (durationMs > maxTime) maxTime = durationMs;

      if (outcome.verdict === 'Ran') {
        // Report both sides RAW - the student's own stdout and the admin's
        // expected output, each untouched except for CRLF normalization. The
        // "Your Output" / "Expected" panels exist so a student can read what
        // their program printed and compare it against the answer themselves;
        // rewriting either side into the checker's normalized form (collapsing
        // runs of spaces, dropping blank lines) hides the spacing that is
        // exactly what they need to see when the verdict is wrong. What the
        // whitespace-blind modes forgive is forgiven inside the verdict only -
        // see compareOutput in checkers.js.
        const compared = compareOutput(outcome.stdout, tc.output, checkerMode, checkerConfig);
        const { actualDisplay, expectedDisplay } = compared;
        let { passed } = compared;
        if (checkerExe) {
          // The admin's function decides. compareOutput above only supplied
          // the raw display strings.
          const verdict = await runCodeChecker(checkerExe, tc.output, outcome.stdout, workDir);
          if (verdict.error) {
            results.push({
              testCase: i + 1,
              passed: false,
              error: 'Checker Error',
              message: "This problem's checker failed on this test case. Please tell the contest admin.",
              checkerError: verdict.error,
              userOutput: actualDisplay,
              expectedOutput: expectedDisplay,
              input: tc.input,
              memoryPeakKb: outcome.memoryPeakKb,
            });
            overallVerdict = 'Checker Error';
            break;
          }
          passed = verdict.passed;
        }
        results.push({
          testCase: i + 1,
          passed,
          userOutput: actualDisplay,
          expectedOutput: expectedDisplay,
          input: tc.input,
          // Surfaced rather than discarded: the memory limit is enforced from
          // a sampled figure, and a run that reported a peak is direct
          // evidence the sampler was working on this machine (see
          // memoryProbe.js). Previously this was measured and thrown away.
          memoryPeakKb: outcome.memoryPeakKb,
        });
        if (!passed) {
          overallVerdict = 'Wrong Answer';
          break;
        }
      } else {
        // input/expectedOutput ride along so a sample "Run" that errors out
        // (TLE, runtime error, ...) still shows the student the sample it ran
        // on. Submit-mode callers redact results down to
        // { testCase, passed, error } before anything reaches a student, so
        // hidden cases stay hidden.
        results.push({
          testCase: i + 1,
          passed: false,
          error: outcome.verdict,
          stderr: outcome.stderr,
          input: tc.input,
          expectedOutput: tc.output,
          memoryPeakKb: outcome.memoryPeakKb,
        });
        overallVerdict = outcome.verdict;
        break;
      }
    }

    return {
      status: overallVerdict,
      results,
      testCasesPassed: results.filter((r) => r.passed).length,
      totalTestCases: testCases.length,
      timeTaken: maxTime,
    };
  } finally {
    cleanupWorkDir(workDir);
  }
}

// Compiles and runs `sourceCode` once against arbitrary `input`, with no
// expected output to compare against - for a freeform "online compiler"
// page, not a contest problem. Returns:
//   { status, stdout, stderr, timeTaken, errorLog }
// where status is 'Ran' | 'Compilation Error' | 'Time Limit Exceeded' |
// 'Memory Limit Exceeded' | 'Runtime Error' | 'Error' (blocked by staticCheck).
// `defineLocal` compiles with -DLOCAL - opt-in from the Compiler page's
// settings (see editorSettings.ts's defineLocalMacro), for templates that
// gate debug-print macros behind `#ifdef LOCAL`. Never used by contest
// judging (run() above never accepts it) - only this freeform playground.
async function runOnce({ sourceCode, input, timeLimit, memoryLimit, judgeSettings, defineLocal }) {
  const check = staticCheck(sourceCode, judgeSettings?.blockedKeywords);
  if (check.blocked) {
    return { status: 'Error', message: check.reason };
  }

  const timeLimitMs = timeLimit || DEFAULT_TIME_LIMIT_MS;
  const memoryLimitMb = memoryLimit || DEFAULT_MEMORY_LIMIT_MB;

  const workDir = makeWorkDir();

  try {
    let execPath;
    try {
      ({ execPath } = await compile(sourceCode, workDir, judgeSettings?.compileTimeoutMs, defineLocal ? ['LOCAL'] : []));
    } catch (compileError) {
      return { status: 'Compilation Error', message: compileError.stderr, errorLog: compileError.stderr };
    }

    const startedAt = Date.now();
    const outcome = await execute(execPath, input || '', { timeLimitMs, memoryLimitMb, maxOutputBytes: judgeSettings?.maxOutputBytes });
    const timeTaken = Date.now() - startedAt;

    return {
      status: outcome.verdict === 'Ran' ? 'Ran' : outcome.verdict,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      timeTaken,
      memoryPeakKb: outcome.memoryPeakKb,
    };
  } finally {
    cleanupWorkDir(workDir);
  }
}

module.exports = {
  run,
  runOnce,
  // "code" checker support for the server's admin routes (validate on save,
  // the "Check code" button, the editor's starting template).
  validateCheckerCode,
  CHECKER_CODE_TEMPLATE,
  staticCheck,
  // The checker API is re-exported rather than duplicated, so a caller that
  // needs to validate an admin-supplied `checker` value (server routes,
  // bulk import) uses the exact same list the judge does - it is impossible
  // to accept a value here that judging would then fall back to a default on.
  compareOutput,
  getChecker,
  isValidChecker,
  normalizeCheckerConfig,
  CHECKER_IDS,
  DEFAULT_CHECKER,
  CUSTOM_DEFAULTS,
};
