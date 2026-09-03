const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { staticCheck } = require('./staticCheck');
const { compile } = require('./compile');
const { execute } = require('./execute');

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
// programmer errors (bad args). Returns:
//   { status, results, testCasesPassed, totalTestCases, timeTaken, errorLog }
async function run({ sourceCode, testCases, timeLimit, memoryLimit }) {
  if (!testCases || testCases.length === 0) {
    return { status: 'Error', message: 'No test cases found for this mode.' };
  }

  const check = staticCheck(sourceCode);
  if (check.blocked) {
    return { status: 'Error', message: check.reason };
  }

  const timeLimitMs = timeLimit || DEFAULT_TIME_LIMIT_MS;
  const memoryLimitMb = memoryLimit || DEFAULT_MEMORY_LIMIT_MB;

  const workDir = makeWorkDir();

  try {
    let execPath;
    try {
      ({ execPath } = await compile(sourceCode, workDir));
    } catch (compileError) {
      return { status: 'Compilation Error', message: compileError.stderr, errorLog: compileError.stderr };
    }

    const results = [];
    let maxTime = 0;
    let overallVerdict = 'Accepted';

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startedAt = Date.now();
      const outcome = await execute(execPath, tc.input || '', { timeLimitMs, memoryLimitMb });
      const durationMs = Date.now() - startedAt;
      if (durationMs > maxTime) maxTime = durationMs;

      if (outcome.verdict === 'Ran') {
        const expected = (tc.output || '').trim();
        const passed = outcome.stdout === expected;
        results.push({
          testCase: i + 1,
          passed,
          userOutput: outcome.stdout,
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
async function runOnce({ sourceCode, input, timeLimit, memoryLimit }) {
  const check = staticCheck(sourceCode);
  if (check.blocked) {
    return { status: 'Error', message: check.reason };
  }

  const timeLimitMs = timeLimit || DEFAULT_TIME_LIMIT_MS;
  const memoryLimitMb = memoryLimit || DEFAULT_MEMORY_LIMIT_MB;

  const workDir = makeWorkDir();

  try {
    let execPath;
    try {
      ({ execPath } = await compile(sourceCode, workDir));
    } catch (compileError) {
      return { status: 'Compilation Error', message: compileError.stderr, errorLog: compileError.stderr };
    }

    const startedAt = Date.now();
    const outcome = await execute(execPath, input || '', { timeLimitMs, memoryLimitMb });
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
