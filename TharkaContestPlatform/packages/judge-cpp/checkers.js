// Output checkers - the single source of truth for "is this output correct?".
//
// Extracted from index.js so the comparison rules live in exactly one place
// and adding a mode is one entry in one table, not another `if` in another
// function. Both the server (server-side judging) and the Electron client
// (local judging) import this module - see scripts/check-judge-cpp-drift.js,
// which fails the build if apps/client-electron/judge-cpp/checkers.js ever
// drifts from this file.
//
// Each checker is a small object:
//   id      - the value stored in `problem.checker` (see models/ContestProblem.js)
//   label   - short name for the admin dropdown
//   hint    - one-line "when do I pick this" text for the admin dropdown
//   normalize(raw, config) -> { key, display }
//             `key` is the canonical form compared for the verdict - the only
//             thing the verdict is ever made from. `display` is this checker's
//             own normalized rendering of one side; it is NOT what a student is
//             shown. The panels always show each side's RAW output (see
//             compareOutput), so a student can see exactly what their program
//             printed, and this module never rewrites what they read.
//   equals(aKey, bKey, config) -> boolean   (optional; default is a === b)
//
// `config` is only meaningful for "custom" (see normalizeCheckerConfig); every
// other mode ignores it and is free to have a plain `equals`.
//
// The verdict is `equals` on the two keys, and ONLY on the two keys. Everything
// a mode forgives - spacing, line breaks, trailing newlines, case - is forgiven
// in `key` alone, so what a student reads on screen is their real output and the
// real expected answer, and the verdict is still decided by the problem's own
// rule. Normalizing the display as well (the old behaviour) hid exactly the
// difference worth seeing when an answer was genuinely wrong.
//
// Unknown / missing checker values fall back to DEFAULT_CHECKER rather than
// throwing: a problem saved before this field existed has no value at all,
// and it must keep grading exactly the way it always did.

const DEFAULT_CHECKER = 'token';

// --- shared normalization helpers -----------------------------------------

// Windows text-mode stdio turns every '\n' a compiled program writes into
// '\r\n' before it reaches our pipe, so a correct multi-line answer's raw
// bytes never equal an admin-typed expected output (plain '\n'). Everything
// below normalizes line endings first for that reason - it is the one
// difference no student can see or control.
function splitLines(s) {
  return (s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

// A trailing newline (or lack of one) and blank lines at the very start/end
// are layout noise, not answer content. Blank lines *between* content are left
// alone except by the checkers that drop them explicitly (see `om`).
function trimOuterBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === '') start++;
  while (end > start && lines[end - 1] === '') end--;
  return lines.slice(start, end);
}

// APPLIED TO EVERY MODE, before its own rules run - see compareOutput below.
//
// Nothing a checker compares may depend on what comes after the last non-space
// character of the output: a final `endl`, a trailing `cout << " "`, trailing
// spaces on the last line, or however many blank lines the program left at the
// end. A student can't see any of it on a terminal, can't reliably control it,
// and "my answer is right but it says wrong" is the most confusing verdict a
// judge can hand out. Stripping it here - once, from BOTH sides, for every mode
// - means no checker can start checking it again by accident, and adding a
// seventh mode can't forget to.
//
// Deliberately trailing-only. *Leading* whitespace stays significant, because
// for a pattern-printing problem an indented line is the answer ('exact'), and
// the modes that ignore it do so as part of their own rule (`om` deletes it,
// the token-based modes split on it).
function stripTrailingNoise(s) {
  return (s || '').replace(/\s+$/, '');
}

// Whitespace-separated tokens. Any run of spaces/tabs/newlines is one
// separator, so line layout is invisible to token-based modes.
// ''.split(/\s+/) is [''] rather than [] - an empty/whitespace-only output has
// to tokenize to *no* tokens, or two blank outputs would compare as a
// one-fake-token list instead of as equal-but-empty.
function tokenize(s) {
  const trimmed = (s || '').trim();
  return trimmed === '' ? [] : trimmed.split(/\s+/);
}

// Keeps the student's own line breaks (a row-printing answer's `endl`s are
// real structure to a human reader) while collapsing runs of horizontal
// whitespace inside a line and dropping blank lines - so the panel still looks
// like the program's real output rather than a flattened token stream.
function displayAsLines(s) {
  return trimOuterBlankLines(
    splitLines(s).map((line) => line.trim().replace(/\s+/g, ' ')).filter((line) => line !== '')
  ).join('\n');
}

const NUMERIC_TOKEN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

// Relative tolerance, so it scales with the magnitude of the number instead of
// becoming a meaningless 0.000001 for answers in the millions.
function numericTokenMatches(actual, expected, tolerance) {
  if (actual === expected) return true;
  if (!NUMERIC_TOKEN.test(actual) || !NUMERIC_TOKEN.test(expected)) return false;
  const x = Number(actual);
  const y = Number(expected);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= Math.max(tolerance, Math.abs(y) * tolerance);
}

function tokensEqual(actualTokens, expectedTokens, tolerance) {
  if (actualTokens.length !== expectedTokens.length) return false;
  if (tolerance == null) return actualTokens.every((t, i) => t === expectedTokens[i]);
  return actualTokens.every((t, i) => numericTokenMatches(t, expectedTokens[i], tolerance));
}

// --- the custom checker's config ------------------------------------------
//
// A "custom" problem stores a small options object next to the checker id
// (`problem.checkerConfig`). Options rather than a script, on purpose: a
// comparison rule is something an admin should be able to read, audit and see
// on screen, and neither the server (running it on every submission) nor the
// Electron client (judging offline on a student's own laptop) should be
// executing admin-authored code to decide a verdict.
//
// The schema is deliberately tiny and flat so it round-trips unchanged through
// JSON, the Mongo document, the sync snapshot and the admin form.
const CUSTOM_DEFAULTS = {
  // 'lines' - line structure matters (like `om`); 'tokens' - order only, line
  // breaks and wrapping ignored (like `token`).
  compareAs: 'lines',
  // 'lines' only: delete every space/tab inside each line before comparing.
  ignoreWhitespace: true,
  // Drop lines that are blank once the other rules have run.
  ignoreBlankLines: true,
  // Lower-case both sides ('Yes' == 'yes').
  ignoreCase: false,
  // Characters deleted from BOTH sides before anything else - e.g. "," to
  // ignore thousands separators, or "-()" for a formatted answer. Capped at
  // 64 characters; duplicates are collapsed.
  ignoreChars: '',
  // 'tokens' only: compare number-like tokens to this relative tolerance
  // instead of as text. null = compare everything as exact text.
  numberTolerance: null,
};

const MAX_IGNORE_CHARS = 64;
const MAX_TOLERANCE = 1e-2;

// Coerces whatever arrived (an admin form, a bulk-import JSON file, an old
// document, or nothing at all) into a valid config. Never throws: an unusable
// value falls back to that field's default, so a bad config degrades to a
// sane comparison instead of failing every submission.
function normalizeCheckerConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const cfg = { ...CUSTOM_DEFAULTS };

  if (src.compareAs === 'tokens' || src.compareAs === 'lines') cfg.compareAs = src.compareAs;
  for (const key of ['ignoreWhitespace', 'ignoreBlankLines', 'ignoreCase']) {
    if (typeof src[key] === 'boolean') cfg[key] = src[key];
  }

  if (typeof src.ignoreChars === 'string') {
    cfg.ignoreChars = [...new Set(src.ignoreChars.split(''))].join('').slice(0, MAX_IGNORE_CHARS);
  }

  const tolerance = Number(src.numberTolerance);
  cfg.numberTolerance = Number.isFinite(tolerance) && tolerance > 0 ? Math.min(tolerance, MAX_TOLERANCE) : null;

  return cfg;
}

// --- the custom checker's two shapes --------------------------------------

function customStripChars(raw, cfg) {
  if (!cfg.ignoreChars) return raw;
  const ignored = new Set(cfg.ignoreChars.split(''));
  return [...raw].filter((ch) => !ignored.has(ch)).join('');
}

// 'lines': the line structure is part of the answer, so line count and order
// are kept - only the spacing/case/characters the admin chose are forgiven.
function customLines(raw, config) {
  const cfg = normalizeCheckerConfig(config);
  let lines = splitLines(customStripChars(raw, cfg)).map((line) => {
    // Trailing whitespace on the *last* line is already gone
    // (stripTrailingNoise ran on the whole output); this handles spacing
    // inside every line, plus trailing spaces on the earlier ones.
    const withoutSpacing = cfg.ignoreWhitespace ? line.replace(/\s+/g, '') : line.replace(/[ \t]+$/, '');
    return cfg.ignoreCase ? withoutSpacing.toLowerCase() : withoutSpacing;
  });
  if (cfg.ignoreBlankLines) lines = lines.filter((line) => line.trim() !== '');
  const joined = trimOuterBlankLines(lines).join('\n');
  return { key: joined, display: joined };
}

// 'tokens': layout is not part of the answer at all - only which tokens appear,
// in which order (or, with numberTolerance, how they compare numerically).
function customTokens(raw, config) {
  const cfg = normalizeCheckerConfig(config);
  const tokens = tokenize(customStripChars(raw, cfg)).map((t) => (cfg.ignoreCase ? t.toLowerCase() : t));
  return { key: tokens, display: tokens.join(' ') };
}

// --- the checkers ---------------------------------------------------------

const CHECKERS = {
  // Whitespace-insensitive, Codeforces-style: `1 2 3`, `1   2   3` and
  // `1\n2\n3` are all the same answer, but `1 2 4` and `1 3 2` are not. The
  // platform default - most competitive-programming problems don't care how an
  // answer is laid out across whitespace, only which numbers/words appear in
  // which order.
  token: {
    id: 'token',
    label: 'Token (whitespace-insensitive)',
    hint: 'Spaces, tabs and line breaks are all ignored - only the sequence of words/numbers matters. The right default for almost every problem.',
    normalize(raw) {
      // '\u0000' can't appear in a token, so joining on it can't merge two
      // different token lists into the same key.
      return { key: tokenize(raw).join('\u0000'), display: displayAsLines(raw) };
    },
  },

  // Line structure preserved, every space/tab inside a line ignored.
  // `5*2=10` == `5 * 2 = 10`, but line count and line order both matter,
  // unlike `token` (which also ignores newlines) - so the right numbers on the
  // wrong lines still fails. Blank lines are dropped, so a genuinely empty
  // line can't fail an otherwise-correct answer.
  om: {
    id: 'om',
    label: 'Line by line, ignore spaces',
    hint: 'Compares line by line: the number and order of lines must match, but spaces/tabs inside each line are ignored. Use when an answer has several meaningful lines (e.g. a multiplication table) but spacing is just formatting.',
    normalize(raw) {
      const lines = trimOuterBlankLines(splitLines(raw).map((line) => line.replace(/\s+/g, ''))).filter(
        (line) => line !== ''
      );
      return { key: lines.join('\n'), display: lines.join('\n') };
    },
  },

  // Line/spacing-sensitive. Lenient only about formatting noise a student can't
  // see or doesn't consider meaningful: line-ending style, trailing whitespace
  // on a line (`cout << x << " ";` loop idioms leave one invisible trailing
  // space), and a trailing newline / blank lines at either end. Leading
  // whitespace, internal spacing, and blank lines between content are left
  // untouched - those are meaningful (alignment, pattern-printing problems like
  // a `  * / *** / *****` pyramid) and a mismatch there is a real Wrong Answer.
  // Must never become whitespace-insensitive.
  exact: {
    id: 'exact',
    label: 'Exact (spacing-sensitive)',
    hint: 'Everything must match character for character, including leading spaces and blank lines - only trailing spaces, line endings and a trailing newline are forgiven. Use for pattern-printing problems where the shape is the answer.',
    normalize(raw) {
      const lines = trimOuterBlankLines(splitLines(raw).map((line) => line.replace(/[ \t]+$/, '')));
      return { key: lines.join('\n'), display: lines.join('\n') };
    },
  },

  // `token` plus numeric tolerance. Same token sequence, but two tokens that
  // are both numbers only have to agree to a small relative tolerance instead
  // of exactly - so a floating-point answer correct to the displayed precision
  // isn't failed by the last digit (`3.14159` vs `3.141592653589793`), and
  // equivalent spellings of the same number (`.5` vs `0.5`, `1e-3` vs `0.001`)
  // match. Non-numeric tokens (`Yes`/`No`) still have to match exactly.
  numeric: {
    id: 'numeric',
    label: 'Numeric (tolerance on floats)',
    hint: 'Like Token, but floating-point answers only need to match to ~6 significant digits, so 3.14159 passes against 3.14159265. Use for geometry/maths problems with real-number answers.',
    normalize(raw) {
      return { key: tokenize(raw), display: displayAsLines(raw) };
    },
    equals: (a, b) => tokensEqual(a, b, 1e-6),
  },

  // Same multiset of tokens, in any order - for answers that are a set rather
  // than a sequence (the divisors of n, the distinct values found, a list of
  // pairs where the order is arbitrary). Still requires the same number of
  // tokens, so a missing or extra item is a Wrong Answer; only the ordering is
  // forgiven.
  unordered: {
    id: 'unordered',
    label: 'Token, any order',
    hint: 'Like Token, but the order of the values is ignored - only how many of each value you printed matters. Use when the problem says "in any order".',
    normalize(raw) {
      // Sorted on both sides, so the panels show the comparison as it is
      // actually made - a wrong count of a value is then visible as a
      // difference between the two lists rather than hidden by ordering.
      const sorted = [...tokenize(raw)].sort();
      return { key: sorted.join('\u0000'), display: sorted.join(' ') };
    },
  },

  // The escape hatch: the five above are the shapes almost every problem falls
  // into, and this covers the rest without anyone writing code. Each rule in
  // `problem.checkerConfig` can be turned on or off - see
  // normalizeCheckerConfig for the schema and its defaults.
  custom: {
    id: 'custom',
    label: 'Custom (your own rules)',
    hint: 'Build your own rule from the options: compare line by line or as tokens, ignore spaces/case/blank lines, delete specific characters (e.g. commas), and optionally compare numbers with a tolerance. Use when none of the standard five fit.',
    normalize(raw, config) {
      return normalizeCheckerConfig(config).compareAs === 'tokens'
        ? customTokens(raw, config)
        : customLines(raw, config);
    },
    equals(actualKey, expectedKey, config) {
      const cfg = normalizeCheckerConfig(config);
      if (cfg.compareAs === 'tokens') {
        // keys are token arrays here, so the numeric tolerance option applies.
        return tokensEqual(actualKey, expectedKey, cfg.numberTolerance);
      }
      return actualKey === expectedKey;
    },
  },

  // Admin-written C++: `bool checker(string expected, string user)` decides.
  // The verdict comes from running that function (see codeChecker.js), which
  // is asynchronous, so index.js's run() handles this mode itself and never
  // reaches compareOutput with it. normalize/equals below are only a strict
  // fallback (exact text after the shared trailing-noise strip), so a caller
  // that somehow bypasses run() can never pass a wrong answer.
  code: {
    id: 'code',
    label: 'Code (your own C++ checker)',
    hint: 'Write a C++ function  bool checker(string expected, string user)  that returns true when the student output is correct. Use when an answer has many valid forms (any order, any valid path, "print any solution", custom tolerance).',
    usesProgram: true,
    normalize(raw) {
      const text = displayRaw(raw);
      return { key: text, display: text };
    },
  },
};

// --- public API -----------------------------------------------------------

const CHECKER_IDS = Object.keys(CHECKERS);

// Never returns undefined - an unknown/missing value resolves to the default
// checker, which is what keeps problems saved before `checker` existed grading
// the way they always did.
function getChecker(id) {
  return CHECKERS[id] || CHECKERS[DEFAULT_CHECKER];
}

function isValidChecker(id) {
  return Object.prototype.hasOwnProperty.call(CHECKERS, id);
}

// What a student is shown for one side of a comparison: their program's output
// exactly as it came out of the pipe - every space, tab, blank line and line
// break still where the program put it - so the "Your Output" panel answers
// "what did my program actually print?" and nothing else. The ONLY thing
// changed is CRLF -> LF, because Windows text-mode stdio rewrites every `\n` a
// program writes into `\r\n` before we see it; that difference is invisible on
// screen and would otherwise leave stray control characters in the panel.
//
// Deliberately not the checker's normalized form: under the whitespace-blind
// modes that form is a flattened token stream (or a de-blanked, re-spaced set of
// lines), which is fine for a verdict but actively unhelpful on screen - it
// deletes the very spaces and blank lines a student needs to eyeball when their
// answer IS wrong, and quietly rewrites their output into something their code
// never printed. Forgiveness belongs to the comparison (`key`), not the display.
function displayRaw(raw) {
  return (raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// The one function every caller uses to get a verdict. Returns the boolean plus
// the two strings to show a student. The boolean comes from the checker's
// normalized `key`s (so "1 2 3" still equals "1\n2\n3" under the default
// checker); the two strings are the raw outputs, so what a student reads is
// always exactly what both programs produced.
function compareOutput(actualRaw, expectedRaw, checkerId, checkerConfig) {
  const checker = getChecker(checkerId);
  // stripTrailingNoise first, so "ends with endl or not" can never be the
  // reason a correct answer failed - in any mode, including a future one.
  const actual = checker.normalize(stripTrailingNoise(actualRaw), checkerConfig);
  const expected = checker.normalize(stripTrailingNoise(expectedRaw), checkerConfig);
  const equals = checker.equals || ((a, b) => a === b);
  return {
    passed: equals(actual.key, expected.key, checkerConfig),
    actualDisplay: displayRaw(actualRaw),
    expectedDisplay: displayRaw(expectedRaw),
  };
}

module.exports = {
  CHECKERS,
  CHECKER_IDS,
  DEFAULT_CHECKER,
  CUSTOM_DEFAULTS,
  compareOutput,
  getChecker,
  isValidChecker,
  normalizeCheckerConfig,
};
