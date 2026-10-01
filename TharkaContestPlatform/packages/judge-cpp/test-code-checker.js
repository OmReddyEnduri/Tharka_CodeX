// End-to-end tests for the "code" checker (admin-written C++ checker
// function), through the real judge: needs g++ on PATH. Run with
//   node test-code-checker.js
const { run, validateCheckerCode, CHECKER_CODE_TEMPLATE } = require('./index');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

// "Print the numbers 1..n in any order": many valid answers.
const ANY_ORDER = `
bool checker(string expected, string user) {
    stringstream a(expected), b(user);
    multiset<long long> x, y;
    long long v;
    while (a >> v) x.insert(v);
    while (b >> v) y.insert(v);
    return x == y;
}`;
const testCases = [
  { input: '3', output: '1 2 3' },
  { input: '5', output: '1 2 3 4 5' },
];
const reversed = `#include <iostream>
int main(){ int n; std::cin >> n; for (int i = n; i >= 1; i--) std::cout << i << (i > 1 ? " " : "\\n"); }`;
const missingOne = `#include <iostream>
int main(){ int n; std::cin >> n; for (int i = 1; i < n; i++) std::cout << i << " "; }`;

(async () => {
  console.log('code checker through run():');

  let r = await run({ sourceCode: reversed, testCases, checker: 'code', checkerCode: ANY_ORDER });
  expect('reversed order is Accepted by an any-order checker', r.status === 'Accepted', JSON.stringify(r).slice(0, 200));
  expect('both test cases passed', r.testCasesPassed === 2);
  expect('raw output still shown', r.results[0].userOutput.trim() === '3 2 1');

  r = await run({ sourceCode: missingOne, testCases, checker: 'code', checkerCode: ANY_ORDER });
  expect('missing number is Wrong Answer', r.status === 'Wrong Answer', r.status);
  expect('wrong row keeps input/expected/user output', r.results[0].input === '3' && r.results[0].expectedOutput === '1 2 3');

  r = await run({ sourceCode: reversed, testCases, checker: 'code', checkerCode: 'bool checker(string e, string u) { return e == ; }' });
  expect('checker that does not compile -> Checker Error, not the student', r.status === 'Checker Error', r.status);

  r = await run({
    sourceCode: reversed,
    testCases,
    checker: 'code',
    checkerCode: 'bool checker(string e, string u){ int* p = nullptr; *p = 1; return true; }',
  });
  expect('crashing checker -> Checker Error row', r.status === 'Checker Error' && r.results[0].error === 'Checker Error', r.status);

  r = await run({ sourceCode: 'int main( { }', testCases, checker: 'code', checkerCode: ANY_ORDER });
  expect('student compile error is still a Compilation Error', r.status === 'Compilation Error', r.status);

  r = await run({ sourceCode: reversed, testCases, checker: 'code', checkerCode: CHECKER_CODE_TEMPLATE });
  expect('starter template (exact compare) fails a reordered answer', r.status === 'Wrong Answer', r.status);

  r = await run({ sourceCode: reversed, testCases: [{ input: '1', output: '1' }], checker: 'code', checkerCode: CHECKER_CODE_TEMPLATE });
  expect('starter template accepts an identical answer (trailing newline forgiven)', r.status === 'Accepted', r.status);

  console.log('validateCheckerCode:');
  expect('good code validates', (await validateCheckerCode(ANY_ORDER)).ok === true);
  const bad = await validateCheckerCode('int nope() { return 0; }');
  expect('missing function explains what to write', !bad.ok && /bool checker\(string expected, string user\)/.test(bad.error), bad.error);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
