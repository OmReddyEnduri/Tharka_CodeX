const path = require('path');
const { runOnce } = require('../../packages/judge-cpp');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ContestProblem = require('./models/ContestProblem');

const referenceSolutions = {
  // Level 1: Basics
  101: `#include <iostream>\nusing namespace std;\nint main() { int a, b; if (cin >> a >> b) { cout << a + b << endl; } return 0; }`,
  102: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { cout << 2 * n << " " << 3 * n << endl; } return 0; }`,
  103: `#include <iostream>\nusing namespace std;\nint main() { int n, k; if (cin >> n >> k) { cout << n / k << " " << n % k << endl; } return 0; }`,
  104: `#include <iostream>\nusing namespace std;\nint main() { int l, w; if (cin >> l >> w) { cout << l * w << " " << 2 * (l + w) << endl; } return 0; }`,
  105: `#include <iostream>\nusing namespace std;\nint main() { int m, s, e; if (cin >> m >> s >> e) { cout << m + s + e << endl; } return 0; }`,

  // Level 2: Conditionals
  201: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { if (n % 2 == 0) cout << "EVEN" << endl; else cout << "ODD" << endl; } return 0; }`,
  202: `#include <iostream>\nusing namespace std;\nint main() { int s; if (cin >> s) { if (s >= 40) cout << "PASS" << endl; else cout << "FAIL" << endl; } return 0; }`,
  203: `#include <iostream>\nusing namespace std;\nint main() { int a, b; if (cin >> a >> b) { if (a >= b) cout << a << endl; else cout << b << endl; } return 0; }`,
  204: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { if (n > 0) cout << "POSITIVE" << endl; else if (n < 0) cout << "NEGATIVE" << endl; else cout << "ZERO" << endl; } return 0; }`,
  205: `#include <iostream>\nusing namespace std;\nint main() { int a; if (cin >> a) { if (a <= 12) cout << "CHILD" << endl; else if (a <= 19) cout << "TEEN" << endl; else cout << "ADULT" << endl; } return 0; }`,

  // Level 3: Loops
  301: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { for (int i = 1; i <= n; i++) { cout << i << (i == n ? "" : " "); } cout << endl; } return 0; }`,
  302: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { for (int i = 1; i <= 10; i++) { cout << n * i << (i == 10 ? "" : " "); } cout << endl; } return 0; }`,
  303: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { int sum = 0; for (int i = 1; i <= n; i++) { sum += i; } cout << sum << endl; } return 0; }`,
  304: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { for (int i = 2; i <= n; i += 2) { cout << i << " "; } cout << endl; } return 0; }`,
  305: `#include <iostream>\nusing namespace std;\nint main() { int n; if (cin >> n) { for (int i = 0; i < n; i++) { cout << "HELLO" << (i == n - 1 ? "" : " "); } cout << endl; } return 0; }`
};

async function testAll() {
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  const problems = await ContestProblem.find({ id: { $gte: 101, $lte: 305 } }).sort({ id: 1 });
  console.log(`Testing ${problems.length} problems with C++ compiler and judge...`);

  let passed = 0;
  for (const prob of problems) {
    const code = referenceSolutions[prob.id];
    if (!code) {
      console.error(`Missing reference solution for problem ${prob.id}`);
      process.exit(1);
    }

    const testcases = [...prob.sampleTestCases, ...prob.hiddenTestCases];
    let probPass = true;

    for (let i = 0; i < testcases.length; i++) {
      const tc = testcases[i];
      const result = await runOnce({
        sourceCode: code,
        input: tc.input,
        timeLimit: prob.timeLimit || 1000,
        memoryLimit: prob.memoryLimit || 256
      });
      if (result.status !== 'Ran') {
        console.error(`❌ Problem ${prob.id} "${prob.title}" TC ${i+1} FAILED with status: ${result.status}`, result);
        probPass = false;
        break;
      }
      // Check token match
      const got = (result.stdout || '').trim().replace(/\s+/g, ' ');
      const exp = (tc.output || '').trim().replace(/\s+/g, ' ');
      if (got !== exp) {
        console.error(`❌ Problem ${prob.id} "${prob.title}" TC ${i+1} Output mismatch: Got "${got}", Expected "${exp}"`);
        probPass = false;
        break;
      }
    }

    if (probPass) {
      console.log(`✅ Problem ${prob.id} [${prob.title}] passed all ${testcases.length} test cases!`);
      passed++;
    }
  }

  console.log(`\n🎉 RESULTS: ${passed}/${problems.length} PROBLEMS PASSED 100% OF SAMPLE & HIDDEN TEST CASES!`);
  process.exit(passed === problems.length ? 0 : 1);
}

testAll().catch(e => { console.error(e); process.exit(1); });
