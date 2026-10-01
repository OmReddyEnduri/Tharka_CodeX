const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { staticCheck } = require('./staticCheck');
const { compile } = require('./compile');
const { execute } = require('./execute');

const DEFAULT_TIME_LIMIT_MS = 2000;
const DEFAULT_MEMORY_LIMIT_MB = 256;

// Two output-checking modes, selected per-problem via `problem.checker`
// (see models/ContestProblem.js):
//
//   "exact" - line/spacing-sensitive. Lenient only about formatting noise a
//   student can't see or doesn't consider meaningful:
//     - line-ending style: Windows text-mode stdio translates every '\n' a
//       compiled program writes to '\r\n' before it reaches our pipe, so a
//       correct multi-line answer's raw bytes never equal an admin-typed
//       expected output (plain '\n') without normalizing both to '\n' first.
//     - trailing whitespace on a line: `cout << x << " ";` loop idioms and
//       similar routinely leave one invisible trailing space students can't
//       see on screen but that would otherwise fail a byte-exact compare.
//     - trailing blank lines / a trailing newline (or lack of one): whether
//       a program ends with `endl` or not is not a meaningful difference.
//   Leading whitespace, internal spacing, and blank lines *between* content
//   are left untouched - those are meaningful (alignment, pattern-printing
//   problems like a `  * / *** / *****` pyramid) and a mismatch there is a
//   real Wrong Answer. This was the platform's only checker before "token"
//   existed, and is still the default for exactly the problems it was built
//   for - it must never become whitespace-insensitive.
//
//   "token" - Codeforces-style whitespace-insensitive. Splits both outputs
//   into whitespace-separated tokens (any run of spaces/tabs/newlines is one
//   separator) and compares the token sequence in order - so `1 2 3`,
//   `1   2   3`, and `1\n2\n3` are all the same answer, but `1 2 4` and
//   `1 3 2` are not. This is the default: most competitive-programming
//   problems don't care how an answer is laid out across whitespace, only
//   which numbers/words appear in which order.
//
//   "om" - line-structure-sensitive but spacing-insensitive *within* a
//   line: strips every space/tab out of each line, then compares line by
//   line (so line count/order still matters, unlike "token", which also
//   ignores newlines entirely). `5*2=10` and `5 * 2 = 10` are the same
//   answer under "om" - only the non-space characters on each line matter,
//   not how a student chose to space them out. Leading/trailing blank lines
//   are ignored (same leniency as "exact"). Use this for problems whose
//   answer genuinely has multiple lines worth keeping separate, but where
//   spacing within a line is just a formatting choice, not part of the
//   answer - "token" would be too lenient there (it would also accept the
//   right numbers on the wrong lines) and "exact" too strict (it would fail
//   over a single extra space).
function normalizeOmOutput(s) {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .replace(/^\n+/, '');
}

function normalizeExactOutput(s) {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .replace(/^\n+/, '');
}

function tokenizeOutput(s) {
  const trimmed = (s || '').trim();
  // ''.split(/\s+/) is [''] , not [] - an empty/whitespace-only output must
  // tokenize to no tokens, not one fake empty-string token, or two blank
  // outputs would wrongly compare as different-length token lists.
  return trimmed === '' ? [] : trimmed.split(/\s+/);
}

// Token-mode's pass/fail is whitespace-blind by design (see compareOutput
// below), but the "Your Output" / "Expected" panel still needs to look like
// what the student actually printed - a row-printing problem's `endl`s are
// real structure to a human reader even though the checker ignores them for
// grading. Keeps line breaks; only collapses runs of horizontal whitespace
// within a line and drops blank lines (same leniency tokenizeOutput already
// grants for verdicts, just not flattened onto one line).
function normalizeTokenDisplay(s) {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line !== '')
    .join('\n');
}

// Single place both judging (index.js) and anything that needs to show a
// diff read the verdict from - returns the boolean plus the exact strings
// that were compared, so a "Your Output" / "Expected" panel can show a
// student precisely what the judge saw, not the raw stdout that might look
// byte-different in ways the checker deliberately ignored.
function compareOutput(actualRaw, expectedRaw, checkerMode) {
  if (checkerMode === 'exact') {
    const actual = normalizeExactOutput(actualRaw);
    const expected = normalizeExactOutput(expectedRaw);
    return { passed: actual === expected, actualDisplay: actual, expectedDisplay: expected };
  }
  if (checkerMode === 'om') {
    const actual = normalizeOmOutput(actualRaw);
    const expected = normalizeOmOutput(expectedRaw);
    return { passed: actual === expected, actualDisplay: actual, expectedDisplay: expected };
  }
  const actualTokens = tokenizeOutput(actualRaw);
  const expectedTokens = tokenizeOutput(expectedRaw);
  const passed =
    actualTokens.length === expectedTokens.length && actualTokens.every((t, i) => t === expectedTokens[i]);
  return {
    passed,
    actualDisplay: normalizeTokenDisplay(actualRaw),
    expectedDisplay: normalizeTokenDisplay(expectedRaw),
  };
}

function makeWorkDir() {
  const workDir = path.join(os.tmpdir(), 'contest-judge', crypto.randomUUID());
  fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

// Runs `sourceCode` against `testCases` ([{input, output}]) with the given
// limits. Stops at the first failing test case (standard judge behavior).
// Never throws for judging outcomes (WA/TLE/MLE/RE/CE) - only for
// programmer errors (bad args). `checker` is the problem's own
// `problem.checker` field ("token" | "exact" | "om"). Anything other than
// the literal strings "exact"/"om" - including undefined, for a problem
// saved before this field existed - defaults to "token", the platform-wide
// default for any problem, old or new. Only pattern-printing/formatting-
// sensitive problems need to explicitly opt into "exact"/"om" via the admin
// problem editor.
async function run({ sourceCode, testCases, timeLimit, memoryLimit, judgeSettings, checker }) {
  if (!testCases || testCases.length === 0) {
    return { status: 'Error', message: 'No test cases found for this mode.' };
  }

  const checkerMode = checker === 'exact' || checker === 'om' ? checker : 'token';

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
        // Report the *normalized/tokenized* forms on both sides, not the raw
        // stdout. The "Your Output" / "Expected" panels a student reads on a
        // Wrong Answer must show exactly what the checker actually compared -
        // otherwise the pair looks byte-different (a stray trailing space, a
        // Windows \r, different line breaks under the token checker) in ways
        // the judge deliberately ignored, and the student hunts a difference
        // that had nothing to do with the verdict.
        const { passed, actualDisplay, expectedDisplay } = compareOutput(outcome.stdout, tc.output, checkerMode);
        results.push({
          testCase: i + 1,
          passed,
          userOutput: actualDisplay,
          expectedOutput: expectedDisplay,
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
    fs.rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, (err) => {
      if (err) console.warn(`[judge-cpp] failed to clean up ${workDir}:`, err.message);
    });
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
    };
  } finally {
    fs.rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, (err) => {
      if (err) console.warn(`[judge-cpp] failed to clean up ${workDir}:`, err.message);
    });
  }
}

module.exports = { run, runOnce, staticCheck, compareOutput, tokenizeOutput, normalizeExactOutput };
