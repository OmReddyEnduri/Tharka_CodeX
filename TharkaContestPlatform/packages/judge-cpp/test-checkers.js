// Plain-Node assertion tests for the two output checkers (packages/judge-cpp
// index.js's compareOutput()). No test framework in this repo - kept as a
// standalone script rather than pulling in Jest/Mocha for one feature. Run:
//   node test-checkers.js
const assert = require('assert');
const { compareOutput } = require('./index');

let passCount = 0;
let failCount = 0;

function check(label, checkerMode, actual, expected, expectPass) {
  const { passed } = compareOutput(actual, expected, checkerMode);
  try {
    assert.strictEqual(passed, expectPass, `expected passed=${expectPass}, got ${passed}`);
    console.log(`  ok  - ${label}`);
    passCount++;
  } catch (err) {
    console.error(`FAIL - ${label}: ${err.message}`);
    failCount++;
  }
}

console.log('Token checker:');
check('identical', 'token', '1 2 3', '1 2 3', true);
check('extra spaces between tokens', 'token', '1   2   3', '1 2 3', true);
check('newline-separated vs space-separated', 'token', '1\n2\n3', '1 2 3', true);
check('leading/trailing whitespace and mixed newlines', 'token', '\n  1 2 3  \n', '1 2 3', true);
check('multi-line expected, single-line actual, same tokens', 'token', '1 2 3 4 5 6', '1 2 3\n4 5 6', true);
check('multi-line expected, differently-wrapped actual, same tokens', 'token', '  1 2\n3 4 5 6', '1 2 3\n4 5 6', true);
check('wrong value', 'token', '1 2 4', '1 2 3', false);
check('wrong order', 'token', '1 3 2', '1 2 3', false);
check('missing token', 'token', '1 2', '1 2 3', false);
check('reordered whole sequence', 'token', '1 2 3 6 5 4', '1 2 3 4 5 6', false);
check('shorter sequence', 'token', '1 2 3\n4 5', '1 2 3\n4 5 6', false);
check('both empty', 'token', '', '', true);
check('empty vs non-empty', 'token', '', '1', false);
check('whitespace-only vs empty', 'token', '   \n  ', '', true);

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
  '    *\n   ***\n  *****\n *******',
  false
);
check('matching pattern with leading spaces passes', 'exact', '    *\n   ***', '    *\n   ***', true);

console.log('\nOm checker:');
check('identical', 'om', '1 2 3', '1 2 3', true);
check('spacing within a line is ignored', 'om', '5*2=10', '5 * 2 = 10', true);
check('extra internal spaces ignored', 'om', 'a  b   c', 'abc', true);
check('leading/trailing blank lines ignored', 'om', '\n\n1 2 3\n\n', '1 2 3', true);
check('CRLF normalized to LF', 'om', '\r\nab\r\ncd\r\n', 'ab\ncd', true);
check('line order matters', 'om', 'ab\ncd', 'cd\nab', false);
check('line count matters (unlike token mode)', 'om', 'ab\ncd', 'abcd', false);
check('wrong content on a line', 'om', 'ab\ncd', 'ab\nce', false);
check('both empty', 'om', '', '', true);

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
