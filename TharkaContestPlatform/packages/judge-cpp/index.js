const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { staticCheck } = require('./staticCheck');
const { compile } = require('./compile');
const { execute } = require('./execute');

const DEFAULT_TIME_LIMIT_MS = 2000;
const DEFAULT_MEMORY_LIMIT_MB = 256;

// Judge output comparison is deliberately lenient about formatting noise a
// student can't see or doesn't consider meaningful:
//   - line-ending style: Windows text-mode stdio translates every '\n' a
//     compiled program writes to '\r\n' before it reaches our pipe, so a
//     correct multi-line answer's raw bytes never equal an admin-typed
//     expected output (plain '\n') without normalizing both to '\n' first.
//   - trailing whitespace on a line: `cout << x << " ";` loop idioms and
//     similar routinely leave one invisible trailing space students can't
//     see on screen but that would otherwise fail a byte-exact compare.
//   - trailing blank lines / a trailing newline (or lack of one): whether a
//     program ends with `endl` or not is not a meaningful difference.
// Leading whitespace and blank lines *between* content are left untouched -
// those can be meaningful (alignment, intentional spacing) and a mismatch
// there is a real Wrong Answer.
function normalizeOutput(s) {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .replace(/^\n+/, '');
}

function makeWorkDir() {
  const workDir = path.join(os.tmpdir(), 'contest-judge', crypto.randomUUID());
  fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

// Runs `sourceCode` against `testCases` ([{input, output}]) with the given
// limits. Stops at the first failing test case (standard judge behavior).
// Never throws for judging outcomes (WA/TLE/MLE/RE/CE) - only for
// programmer errors (bad args). Returns:
//   { status, results, testCasesPassed, totalTestCases, timeTaken, errorLog }
async function run({ sourceCode, testCases, timeLimit, memoryLimit, judgeSettings }) {
  if (!testCases || testCases.length === 0) {
    return { status: 'Error', message: 'No test cases found for this mode.' };
  }

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
        // Report the *normalized* forms on both sides, not the raw stdout.
        // The "Your Output" / "Expected" panels a student reads on a Wrong
        // Answer must show exactly the two strings that were compared -
        // otherwise the pair looks byte-different (a stray trailing space, a
        // Windows \r) in ways the judge deliberately ignored, and the student
        // hunts a difference that had nothing to do with the verdict.
        const expected = normalizeOutput(tc.output);
        const actual = normalizeOutput(outcome.stdout);
        const passed = actual === expected;
        results.push({
          testCase: i + 1,
          passed,
          userOutput: actual,
          expectedOutput: expected,
          input: tc.input,
        });
        if (!passed) {
          overallVerdict = 'Wrong Answer';
          break;
        }
      } else {
        results.push({ testCase: i + 1, passed: false, error: outcome.verdict, stderr: outcome.stderr });
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
    fs.rm(workDir, { recursive: true, force: true }, () => {});
  }
}

// Compiles and runs `sourceCode` once against arbitrary `input`, with no
// expected output to compare against - for a freeform "online compiler"
// page, not a contest problem. Returns:
//   { status, stdout, stderr, timeTaken, errorLog }
// where status is 'Ran' | 'Compilation Error' | 'Time Limit Exceeded' |
// 'Memory Limit Exceeded' | 'Runtime Error' | 'Error' (blocked by staticCheck).
async function runOnce({ sourceCode, input, timeLimit, memoryLimit, judgeSettings }) {
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

    const startedAt = Date.now();
    const outcome = await execute(execPath, input || '', { timeLimitMs, memoryLimitMb, maxOutputBytes: judgeSettings?.maxOutputBytes });
    const timeTaken = Date.now() - startedAt;

    return {
      status: outcome.verdict === 'Ran' ? 'Ran' : outcome.verdict,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      timeTaken,
    };
  } finally {
    fs.rm(workDir, { recursive: true, force: true }, () => {});
  }
}

module.exports = { run, runOnce, staticCheck };
