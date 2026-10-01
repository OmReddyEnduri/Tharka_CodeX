// Plain-Node assertion tests for the output checkers (checkers.js). No test
// framework in this repo - kept as a standalone script rather than pulling in
// Jest/Mocha for one feature. Run:
//   node test-checkers.js
const assert = require('assert');
const {
  compareOutput,
  getChecker,
  isValidChecker,
  normalizeCheckerConfig,
  CHECKER_IDS,
  DEFAULT_CHECKER,
} = require('./index');

let passCount = 0;
let failCount = 0;

function check(label, checkerMode, actual, expected, expectPass, config) {
  const { passed } = compareOutput(actual, expected, checkerMode, config);
  try {
    assert.strictEqual(passed, expectPass, `expected passed=${expectPass}, got ${passed}`);
    console.log(`  ok  - ${label}`);
    passCount++;
  } catch (err) {
    console.error(`FAIL - ${label}: ${err.message}`);
    failCount++;
  }
}

function checkEqual(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`  ok  - ${label}`);
    passCount++;
  } catch (err) {
    console.error(`FAIL - ${label}: ${err.message}`);
    failCount++;
  }
}

console.log('Registry:');
checkEqual('every id resolves to itself', CHECKER_IDS.join(','), 'token,om,exact,numeric,unordered,custom,code');
checkEqual('default checker is token', DEFAULT_CHECKER, 'token');
checkEqual('unknown value falls back to the default', getChecker('nonsense').id, 'token');
checkEqual('undefined falls back to the default', getChecker(undefined).id, 'token');
checkEqual('isValidChecker accepts a real id', isValidChecker('om'), true);
checkEqual('isValidChecker rejects a typo', isValidChecker('exactt'), false);

console.log('\nToken checker:');
check('identical', 'token', '1 2 3', '1 2 3', true);
check('extra spaces between tokens', 'token', '1   2   3', '1 2 3', true);
check('newline-separated vs space-separated', 'token', '1\n2\n3', '1 2 3', true);
check('leading/trailing whitespace and mixed newlines', 'token', '\n  1 2 3  \n', '1 2 3', true);
check('multi-line expected, single-line actual, same tokens', 'token', '1 2 3 4 5 6', '1 2 3\n4 5 6', true);
check('wrong value', 'token', '1 2 4', '1 2 3', false);
check('wrong order', 'token', '1 3 2', '1 2 3', false);
check('missing token', 'token', '1 2', '1 2 3', false);
check('both empty', 'token', '', '', true);
check('empty vs non-empty', 'token', '', '1', false);
check('whitespace-only vs empty', 'token', '   \n  ', '', true);
// The reported bug: under the default checker these really are different
// answers - `x1=` is one token, while `x 1 =` is three.
check('no spaces around = vs spaced (token says different)', 'token', '1 x1= 1', '1 x 1 = 1', false);

console.log('\nExact checker:');
check('identical', 'exact', '1 2 3', '1 2 3', true);
check('trailing space ignored', 'exact', '1 2 3 ', '1 2 3', true);
check('trailing tab ignored', 'exact', '1 2 3\t', '1 2 3', true);
check('CRLF normalized to LF', 'exact', '\r\n1 2 3\r\n', '1 2 3', true);
check('leading/trailing blank lines ignored', 'exact', '\n\n1 2 3\n\n', '1 2 3', true);
check('internal double-space is significant', 'exact', '1  2  3', '1 2 3', false);
check('newlines are significant (vs token mode)', 'exact', '1\n2\n3', '1 2 3', false);
check(
  'leading spaces are significant (pattern-printing)',
  'exact',
  '*\n***\n*****\n*******',
  '    *\n   ***\n  *****',
  false
);
check('matching pattern with leading spaces passes', 'exact', '    *\n   ***', '    *\n   ***', true);
check('missing spaces around = fails (exact is strict)', 'exact', '1 x1= 1', '1 x 1 = 1', false);

console.log('\nOm checker (line by line, spaces ignored):');
check('identical', 'om', '1 2 3', '1 2 3', true);
check('spacing within a line is ignored', 'om', '5*2=10', '5 * 2 = 10', true);
check('extra internal spaces ignored', 'om', 'a  b   c', 'abc', true);
check('blank lines between content are ignored', 'om', 'ab\n\ncd', 'ab\ncd', true);
check('CRLF normalized to LF', 'om', '\r\nab\r\ncd\r\n', 'ab\ncd', true);
check('line order matters', 'om', 'ab\ncd', 'cd\nab', false);
check('line count matters (unlike token mode)', 'om', 'ab\ncd', 'abcd', false);
check('wrong content on a line', 'om', 'ab\ncd', 'ab\nce', false);
check('tabs inside a line ignored', 'om', 'a\tb\tc', 'abc', true);
// The reported bug, fixed by this checker.
check('no spaces around = passes (the reported case)', 'om', '1 x1= 1', '1 x 1 = 1', true);
check(
  'multiplication table, spaces ignored per line',
  'om',
  '1x1= 1\n1x2= 2\n1x3= 3',
  '1 x 1 = 1\n1 x 2 = 2\n1 x 3 = 3',
  true
);
check(
  'multiplication table, a real wrong value still fails',
  'om',
  '1x1= 1\n1x2= 3\n1x3= 3',
  '1 x 1 = 1\n1 x 2 = 2\n1 x 3 = 3',
  false
);
check(
  'multiplication table, rows swapped still fails',
  'om',
  '1x2= 2\n1x1= 1\n1x3= 3',
  '1 x 1 = 1\n1 x 2 = 2\n1 x 3 = 3',
  false
);

console.log('\nNumeric checker:');
check('identical integers', 'numeric', '1 2 3', '1 2 3', true);
check('float correct to fewer digits passes', 'numeric', '3.14159', '3.141592653589793', true);
check('leading dot vs zero passes', 'numeric', '.5', '0.5', true);
check('scientific notation vs decimal passes', 'numeric', '1e-3', '0.001', true);
check('genuinely different number fails', 'numeric', '3.14', '3.15', false);
check('one digit off at the end fails', 'numeric', '2.71828', '2.71829', false);
check('token count still matters', 'numeric', '1 2', '1 2 3', false);
check('non-numeric tokens must match exactly', 'numeric', 'Yes', 'yes', false);
check('hex-looking token is not treated as a number', 'numeric', '0x10', '16', false);
check('line layout still ignored', 'numeric', '1\n2\n3', '1 2 3', true);

console.log('\nUnordered checker:');
check('same tokens, different order passes', 'unordered', '3 1 2', '1 2 3', true);
check('duplicates are counted, not just set-membership', 'unordered', '1 1 2', '1 2 2', false);
check('extra value fails', 'unordered', '1 2 3 4', '1 2 3', false);
check('missing value fails', 'unordered', '1 2', '1 2 3', false);
check('different values fail', 'unordered', '1 2 9', '1 2 3', false);
check('identical still passes', 'unordered', '1 2 3', '1 2 3', true);
check('line layout ignored', 'unordered', '3\n1\n2', '1 2 3', true);

console.log('\nCustom checker (options):');
const LINES = { compareAs: 'lines' };
check('lines: spaces ignored by default', 'custom', '1x1=1', '1 x 1 = 1', true, LINES);
check('lines: spaces significant when turned off', 'custom', '1x1=1', '1 x 1 = 1', false, {
  ...LINES,
  ignoreWhitespace: false,
});
check('lines: order still matters', 'custom', 'ab\ncd', 'cd\nab', false, LINES);
check('lines: blank lines ignored by default', 'custom', 'ab\n\ncd', 'ab\ncd', true, LINES);
check('lines: blank lines significant when turned off', 'custom', 'ab\n\ncd', 'ab\ncd', false, {
  ...LINES,
  ignoreBlankLines: false,
});
check('lines: case matters by default', 'custom', 'YES', 'yes', false, LINES);
check('lines: case ignored when turned on', 'custom', 'YES', 'yes', true, { ...LINES, ignoreCase: true });
check('lines: comma ignored via ignoreChars', 'custom', '1,000', '1000', true, {
  ...LINES,
  ignoreChars: ',',
});
check('lines: brackets ignored via ignoreChars', 'custom', '(5)', '5', true, {
  ...LINES,
  ignoreChars: '()',
});
check('lines: without ignoreChars the comma is a real difference', 'custom', '1,000', '1000', false, LINES);
check('tokens: line breaks ignored', 'custom', 'a\nb\nc', 'a b c', true, { compareAs: 'tokens' });
check('tokens: order matters (unlike unordered)', 'custom', '3 1 2', '1 2 3', false, { compareAs: 'tokens' });
check('tokens: case matters by default', 'custom', 'AB cd', 'ab CD', false, { compareAs: 'tokens' });
check('tokens: case ignored when turned on', 'custom', 'Yes NO', 'yes no', true, {
  compareAs: 'tokens',
  ignoreCase: true,
});
check('tokens: text compared exactly without a tolerance', 'custom', '3.14159', '3.14159265', false, {
  compareAs: 'tokens',
});
check('tokens: tolerance makes the float pass', 'custom', '3.14159', '3.14159265', true, {
  compareAs: 'tokens',
  numberTolerance: 1e-6,
});
check('tokens: tolerance still fails a real difference', 'custom', '3.14', '3.15', false, {
  compareAs: 'tokens',
  numberTolerance: 1e-6,
});
check('tokens: tolerance leaves non-numbers exact', 'custom', 'Yes', 'yes', false, {
  compareAs: 'tokens',
  numberTolerance: 1e-6,
});
check('tokens: ignoreChars applies before tokenizing', 'custom', 'a, b, c', 'a b c', true, {
  compareAs: 'tokens',
  ignoreChars: ',',
});
check('no config at all still works', 'custom', '1x1=1', '1 x 1 = 1', true);

console.log('\nCustom checker (config sanitizing):');
checkEqual('defaults', normalizeCheckerConfig(undefined), {
  compareAs: 'lines',
  ignoreWhitespace: true,
  ignoreBlankLines: true,
  ignoreCase: false,
  ignoreChars: '',
  numberTolerance: null,
});
checkEqual('bad compareAs falls back', normalizeCheckerConfig({ compareAs: 'nonsense' }).compareAs, 'lines');
checkEqual('non-boolean flags ignored', normalizeCheckerConfig({ ignoreCase: 'yes' }).ignoreCase, false);
checkEqual('duplicate ignoreChars collapsed', normalizeCheckerConfig({ ignoreChars: 'aabb' }).ignoreChars, 'ab');
// 200 characters, but only 94 of them distinct - the cap applies to the
// de-duplicated set, so this must land on exactly 64.
const MANY_CHARS = Array.from({ length: 200 }, (_, i) => String.fromCharCode(33 + (i % 94))).join('');
checkEqual('ignoreChars capped at 64', normalizeCheckerConfig({ ignoreChars: MANY_CHARS }).ignoreChars.length, 64);
checkEqual('ignoreChars keeps all of a short set', normalizeCheckerConfig({ ignoreChars: '(){}[]' }).ignoreChars, '(){}[]');
checkEqual('negative tolerance rejected', normalizeCheckerConfig({ numberTolerance: -1 }).numberTolerance, null);
checkEqual('absurd tolerance clamped', normalizeCheckerConfig({ numberTolerance: 99 }).numberTolerance, 1e-2);
checkEqual('junk object does not throw', normalizeCheckerConfig('not an object').compareAs, 'lines');
checkEqual('a config meant for another mode is ignored', normalizeCheckerConfig({ ignoreCase: true }).ignoreCase, true);

console.log('\nTrailing noise ignored by EVERY mode:');
// The rule this whole section exists for: nothing may depend on what comes
// after the last non-space character - trailing spaces, a final endl, or
// however many blank lines the program left behind.
const TRAILING_VARIANTS = [
  ['a final endl', '1 2 3\n'],
  ['no final endl', '1 2 3'],
  ['two final endls', '1 2 3\n\n'],
  ['many blank lines at the end', '1 2 3\n\n\n\n'],
  ['trailing spaces on the last line', '1 2 3   '],
  ['trailing tab', '1 2 3\t'],
  ['trailing newline then whitespace-only lines', '1 2 3\n   \n\t\n'],
  ['spaces, blank lines and an endl combined', '1 2 3  \n \n \n'],
];
for (const mode of CHECKER_IDS.filter((id) => !getChecker(id).usesProgram)) {
  for (const [label, variant] of TRAILING_VARIANTS) {
    check(`${mode.padEnd(9)} vs expected "1 2 3" - ${label}`, mode, variant, '1 2 3', true);
  }
  // ...and the mirror image: trailing junk on the EXPECTED side only.
  check(`${mode.padEnd(9)} vs expected WITH trailing junk`, mode, '1 2 3', '1 2 3  \n\n', true);
  // Trailing noise inside a multi-line answer, not just at the very end.
  check(`${mode.padEnd(9)} trailing space on a middle line`, mode, '1 2 3   \n4 5 6', '1 2 3\n4 5 6', true);
}
check(
  'custom ignores trailing junk too',
  'custom',
  '1x1=1\n\n  \n',
  '1 x 1 = 1',
  true,
  { compareAs: 'lines' }
);

console.log('\nThe two DISPLAYED strings are the raw output, not the checker\'s version:');
// The verdict may forgive spacing, line breaks, blank lines and case - the
// "Your Output" / "Expected" panels may not. They show each side exactly as it
// came out of the programs, so the student can read the real difference; the
// forgiving version is what the verdict uses, and it never reaches the screen.
function checkDisplay(label, { actual, expected, mode, config, passed, actualDisplay, expectedDisplay }) {
  const got = compareOutput(actual, expected, mode, config);
  try {
    assert.strictEqual(got.passed, passed, `passed: expected ${passed}, got ${got.passed}`);
    assert.strictEqual(
      got.actualDisplay,
      actualDisplay,
      `actualDisplay: expected ${JSON.stringify(actualDisplay)}, got ${JSON.stringify(got.actualDisplay)}`
    );
    assert.strictEqual(
      got.expectedDisplay,
      expectedDisplay,
      `expectedDisplay: expected ${JSON.stringify(expectedDisplay)}, got ${JSON.stringify(got.expectedDisplay)}`
    );
    console.log(`  ok  - ${label}`);
    passCount++;
  } catch (err) {
    console.error(`FAIL - ${label}: ${err.message}`);
    failCount++;
  }
}

// An Accepted verdict the student can see is beat-for-beat different on screen:
// extra spaces, different line breaks, different blank lines - all forgiven by
// the verdict, none of it hidden from the reader.
checkDisplay('token: spacing is NOT collapsed for display', {
  actual: '1   2   3',
  expected: '1 2 3',
  mode: 'token',
  passed: true,
  actualDisplay: '1   2   3',
  expectedDisplay: '1 2 3',
});
checkDisplay('token: line breaks are NOT flattened for display', {
  actual: '1\n2\n3',
  expected: '1 2 3',
  mode: 'token',
  passed: true,
  actualDisplay: '1\n2\n3',
  expectedDisplay: '1 2 3',
});
checkDisplay('om: blank lines are NOT dropped for display', {
  actual: 'ab\n\ncd',
  expected: 'ab\ncd',
  mode: 'om',
  passed: true,
  actualDisplay: 'ab\n\ncd',
  expectedDisplay: 'ab\ncd',
});
checkDisplay('unordered: display keeps the printed order, not the sorted one', {
  actual: '3 1 2',
  expected: '1 2 3',
  mode: 'unordered',
  passed: true,
  actualDisplay: '3 1 2',
  expectedDisplay: '1 2 3',
});
checkDisplay('custom: display keeps the real characters (comma included)', {
  actual: '1,000',
  expected: '1000',
  mode: 'custom',
  config: { compareAs: 'lines', ignoreChars: ',' },
  passed: true,
  actualDisplay: '1,000',
  expectedDisplay: '1000',
});
checkDisplay('a final endl is kept on the side that has it', {
  actual: '1 2 3\n',
  expected: '1 2 3',
  mode: 'token',
  passed: true,
  actualDisplay: '1 2 3\n',
  expectedDisplay: '1 2 3',
});
checkDisplay('leading spaces are kept (pattern printing)', {
  actual: '    *\n   ***',
  expected: '    *\n   ***',
  mode: 'exact',
  passed: true,
  actualDisplay: '    *\n   ***',
  expectedDisplay: '    *\n   ***',
});
// The single exception, and only because it is invisible on screen: Windows
// stdio hands us '\r\n' for every '\n' a program writes, so a Correct answer
// would otherwise carry stray carriage returns into the panel.
checkDisplay('CRLF is shown as LF on both sides (cosmetic only)', {
  actual: '1 2 3\r\n4 5 6\r\n',
  expected: '1 2 3\n4 5 6\n',
  mode: 'token',
  passed: true,
  actualDisplay: '1 2 3\n4 5 6\n',
  expectedDisplay: '1 2 3\n4 5 6\n',
});
checkDisplay('a genuinely wrong answer still shows both real strings', {
  actual: '1 2 4',
  expected: '1 2 3',
  mode: 'token',
  passed: false,
  actualDisplay: '1 2 4',
  expectedDisplay: '1 2 3',
});

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
