const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Contest = require('./models/Contest');
const ContestProblem = require('./models/ContestProblem');

const level1Problems = [
  {
    id: 101,
    title: "Add Two Numbers",
    description: "Welcome to C++! Read two numbers A and B and print their sum.",
    category: "Basics",
    difficulty: "Easy",
    constraints: "1 <= A, B <= 1000",
    inputFormat: "Two space-separated integers A and B.",
    outputFormat: "A single integer representing A + B.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "3 5", output: "8" },
      { input: "10 20", output: "30" }
    ],
    hiddenTestCases: [
      { input: "1 1", output: "2" },
      { input: "100 250", output: "350" },
      { input: "500 500", output: "1000" },
      { input: "123 456", output: "579" },
      { input: "999 1", output: "1000" }
    ]
  },
  {
    id: 102,
    title: "Double and Triple",
    description: "Read an integer N. Calculate and print 2 * N and 3 * N separated by a space.",
    category: "Basics",
    difficulty: "Easy",
    constraints: "1 <= N <= 1000",
    inputFormat: "A single integer N.",
    outputFormat: "Print two integers separated by space: 2*N and 3*N.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "5", output: "10 15" }
    ],
    hiddenTestCases: [
      { input: "1", output: "2 3" },
      { input: "10", output: "20 30" },
      { input: "50", output: "100 150" },
      { input: "100", output: "200 300" },
      { input: "123", output: "246 369" }
    ]
  },
  {
    id: 103,
    title: "Candy Sharing",
    description: "You have N candies to share equally among K children. Print the number of candies each child gets, and the leftover candies, separated by a space.",
    category: "Arithmetic",
    difficulty: "Easy",
    constraints: "1 <= N <= 1000, 1 <= K <= 100",
    inputFormat: "Two integers N and K.",
    outputFormat: "Print (N / K) and (N % K) separated by a space.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "14 3", output: "4 2" }
    ],
    hiddenTestCases: [
      { input: "20 5", output: "4 0" },
      { input: "17 4", output: "4 1" },
      { input: "7 10", output: "0 7" },
      { input: "100 3", output: "33 1" },
      { input: "50 8", output: "6 2" }
    ]
  },
  {
    id: 104,
    title: "Area and Perimeter of a Rectangle",
    description: "Given the length L and width W of a rectangle, calculate and print its Area (L * W) and Perimeter (2 * (L + W)) separated by a space.",
    category: "Geometry",
    difficulty: "Easy",
    constraints: "1 <= L, W <= 500",
    inputFormat: "Two integers L and W.",
    outputFormat: "Print Area and Perimeter separated by a space.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "5 4", output: "20 18" }
    ],
    hiddenTestCases: [
      { input: "10 10", output: "100 40" },
      { input: "3 7", output: "21 20" },
      { input: "1 1", output: "1 4" },
      { input: "25 4", output: "100 58" },
      { input: "12 8", output: "96 40" }
    ]
  },
  {
    id: 105,
    title: "Total Marks of 3 Subjects",
    description: "A student scored marks in Math (M), Science (S), and English (E). Read the three marks and print their total sum.",
    category: "Arithmetic",
    difficulty: "Easy",
    constraints: "0 <= M, S, E <= 100",
    inputFormat: "Three space-separated integers M, S, and E.",
    outputFormat: "A single integer: M + S + E.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "80 90 95", output: "265" }
    ],
    hiddenTestCases: [
      { input: "100 100 100", output: "300" },
      { input: "35 40 50", output: "125" },
      { input: "0 0 0", output: "0" },
      { input: "75 85 92", output: "252" },
      { input: "45 60 70", output: "175" }
    ]
  }
];

const level2Problems = [
  {
    id: 201,
    title: "Even or Odd",
    description: "Read an integer N. If N is even, print \"EVEN\". If N is odd, print \"ODD\".",
    category: "Conditionals",
    difficulty: "Easy",
    constraints: "1 <= N <= 10000",
    inputFormat: "A single integer N.",
    outputFormat: "Print EVEN or ODD.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "6", output: "EVEN" },
      { input: "11", output: "ODD" }
    ],
    hiddenTestCases: [
      { input: "2", output: "EVEN" },
      { input: "99", output: "ODD" },
      { input: "1000", output: "EVEN" },
      { input: "1", output: "ODD" },
      { input: "54321", output: "ODD" },
      { input: "8888", output: "EVEN" }
    ]
  },
  {
    id: 202,
    title: "Pass or Fail",
    description: "A student needs at least 40 marks to pass an exam. Given score S, print \"PASS\" if S >= 40, otherwise print \"FAIL\".",
    category: "Conditionals",
    difficulty: "Easy",
    constraints: "0 <= S <= 100",
    inputFormat: "A single integer S.",
    outputFormat: "Print PASS or FAIL.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "75", output: "PASS" },
      { input: "38", output: "FAIL" }
    ],
    hiddenTestCases: [
      { input: "40", output: "PASS" },
      { input: "39", output: "FAIL" },
      { input: "100", output: "PASS" },
      { input: "0", output: "FAIL" },
      { input: "50", output: "PASS" },
      { input: "99", output: "PASS" }
    ]
  },
  {
    id: 203,
    title: "Bigger of Two Numbers",
    description: "Read two integers A and B. Print the larger number. If they are equal, print that number.",
    category: "Conditionals",
    difficulty: "Easy",
    constraints: "-1000 <= A, B <= 1000",
    inputFormat: "Two space-separated integers A and B.",
    outputFormat: "Print the larger integer.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "12 25", output: "25" },
      { input: "50 30", output: "50" }
    ],
    hiddenTestCases: [
      { input: "7 7", output: "7" },
      { input: "-5 -2", output: "-2" },
      { input: "0 10", output: "10" },
      { input: "999 1000", output: "1000" },
      { input: "-50 -100", output: "-50" }
    ]
  },
  {
    id: 204,
    title: "Positive, Negative, or Zero",
    description: "Given an integer N: if N > 0 print \"POSITIVE\", if N < 0 print \"NEGATIVE\", and if N == 0 print \"ZERO\".",
    category: "Conditionals",
    difficulty: "Easy",
    constraints: "-1000 <= N <= 1000",
    inputFormat: "A single integer N.",
    outputFormat: "Print POSITIVE, NEGATIVE, or ZERO.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "15", output: "POSITIVE" },
      { input: "-8", output: "NEGATIVE" },
      { input: "0", output: "ZERO" }
    ],
    hiddenTestCases: [
      { input: "1", output: "POSITIVE" },
      { input: "-100", output: "NEGATIVE" },
      { input: "0", output: "ZERO" },
      { input: "500", output: "POSITIVE" },
      { input: "-1", output: "NEGATIVE" }
    ]
  },
  {
    id: 205,
    title: "Age Category",
    description: "Given an age A:\n- If A <= 12, print \"CHILD\"\n- If 13 <= A <= 19, print \"TEEN\"\n- If A >= 20, print \"ADULT\"",
    category: "Conditionals",
    difficulty: "Easy",
    constraints: "1 <= A <= 100",
    inputFormat: "A single integer A.",
    outputFormat: "Print CHILD, TEEN, or ADULT.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "10", output: "CHILD" },
      { input: "15", output: "TEEN" },
      { input: "25", output: "ADULT" }
    ],
    hiddenTestCases: [
      { input: "12", output: "CHILD" },
      { input: "13", output: "TEEN" },
      { input: "19", output: "TEEN" },
      { input: "20", output: "ADULT" },
      { input: "5", output: "CHILD" },
      { input: "70", output: "ADULT" }
    ]
  }
];

const level3Problems = [
  {
    id: 301,
    title: "Count from 1 to N",
    description: "Given a positive integer N, use a for loop to print numbers from 1 to N separated by spaces on a single line.",
    category: "Loops",
    difficulty: "Easy",
    constraints: "1 <= N <= 100",
    inputFormat: "A single integer N.",
    outputFormat: "Print 1 2 3 ... N separated by spaces.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "5", output: "1 2 3 4 5" }
    ],
    hiddenTestCases: [
      { input: "1", output: "1" },
      { input: "3", output: "1 2 3" },
      { input: "10", output: "1 2 3 4 5 6 7 8 9 10" },
      { input: "8", output: "1 2 3 4 5 6 7 8" },
      { input: "15", output: "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15" }
    ]
  },
  {
    id: 302,
    title: "Multiplication Table of N",
    description: "Given an integer N, use a for loop to print the first 10 multiples of N (N*1, N*2, ..., N*10) separated by spaces.",
    category: "Loops",
    difficulty: "Easy",
    constraints: "1 <= N <= 50",
    inputFormat: "A single integer N.",
    outputFormat: "Print 10 space-separated integers.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "3", output: "3 6 9 12 15 18 21 24 27 30" }
    ],
    hiddenTestCases: [
      { input: "1", output: "1 2 3 4 5 6 7 8 9 10" },
      { input: "5", output: "5 10 15 20 25 30 35 40 45 50" },
      { input: "7", output: "7 14 21 28 35 42 49 56 63 70" },
      { input: "10", output: "10 20 30 40 50 60 70 80 90 100" },
      { input: "12", output: "12 24 36 48 60 72 84 96 108 120" }
    ]
  },
  {
    id: 303,
    title: "Sum from 1 to N",
    description: "Given an integer N, calculate and print the sum of all numbers from 1 to N (1 + 2 + ... + N) using a for loop.",
    category: "Loops",
    difficulty: "Easy",
    constraints: "1 <= N <= 500",
    inputFormat: "A single integer N.",
    outputFormat: "Print the total sum.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "5", output: "15" }
    ],
    hiddenTestCases: [
      { input: "1", output: "1" },
      { input: "10", output: "55" },
      { input: "20", output: "210" },
      { input: "50", output: "1275" },
      { input: "100", output: "5050" }
    ]
  },
  {
    id: 304,
    title: "Print Even Numbers up to N",
    description: "Given an integer N, print all even numbers from 2 up to N separated by spaces.",
    category: "Loops",
    difficulty: "Easy",
    constraints: "2 <= N <= 100",
    inputFormat: "A single integer N.",
    outputFormat: "Print all even numbers <= N separated by spaces.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "10", output: "2 4 6 8 10" }
    ],
    hiddenTestCases: [
      { input: "2", output: "2" },
      { input: "6", output: "2 4 6" },
      { input: "7", output: "2 4 6" },
      { input: "15", output: "2 4 6 8 10 12 14" },
      { input: "20", output: "2 4 6 8 10 12 14 16 18 20" }
    ]
  },
  {
    id: 305,
    title: "Repeat Word N Times",
    description: "Read an integer N. Use a for loop to print the word \"HELLO\" exactly N times, separated by spaces.",
    category: "Loops",
    difficulty: "Easy",
    constraints: "1 <= N <= 20",
    inputFormat: "A single integer N.",
    outputFormat: "Print HELLO repeated N times separated by space.",
    timeLimit: 1000,
    memoryLimit: 256,
    points: 100,
    checker: "token",
    sampleTestCases: [
      { input: "3", output: "HELLO HELLO HELLO" }
    ],
    hiddenTestCases: [
      { input: "1", output: "HELLO" },
      { input: "2", output: "HELLO HELLO" },
      { input: "5", output: "HELLO HELLO HELLO HELLO HELLO" },
      { input: "7", output: "HELLO HELLO HELLO HELLO HELLO HELLO HELLO" },
      { input: "10", output: "HELLO HELLO HELLO HELLO HELLO HELLO HELLO HELLO HELLO HELLO" }
    ]
  }
];

async function seedThreeContests() {
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log("Connected to MongoDB.");

  // Upsert Level 1 Problems
  const l1Saved = [];
  for (const p of level1Problems) {
    const doc = await ContestProblem.findOneAndUpdate({ id: p.id }, p, { upsert: true, new: true });
    l1Saved.push(doc);
  }
  console.log(`Saved ${l1Saved.length} Level 1 Problems.`);

  // Upsert Level 2 Problems
  const l2Saved = [];
  for (const p of level2Problems) {
    const doc = await ContestProblem.findOneAndUpdate({ id: p.id }, p, { upsert: true, new: true });
    l2Saved.push(doc);
  }
  console.log(`Saved ${l2Saved.length} Level 2 Problems.`);

  // Upsert Level 3 Problems
  const l3Saved = [];
  for (const p of level3Problems) {
    const doc = await ContestProblem.findOneAndUpdate({ id: p.id }, p, { upsert: true, new: true });
    l3Saved.push(doc);
  }
  console.log(`Saved ${l3Saved.length} Level 3 Problems.`);

  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // started yesterday
  const endTime = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // ends in 90 days

  // 1. Contest 1 (using the exact ID 6a9e85f5815c0df44fb18d7c from the prompt)
  const targetId = "6a9e85f5815c0df44fb18d7c";
  await Contest.findByIdAndUpdate(
    targetId,
    {
      id: "contest-level-1",
      name: "C++ Contest — Level 1: Basics & Arithmetic (cin, cout, int)",
      description: "Level 1 C++ programming contest for school beginners. Topics: cin, cout, int variables, basic arithmetic (+, -, *, /, %).",
      startTime,
      endTime,
      problems: l1Saved.map(p => p._id),
      problemIds: l1Saved.map(p => p.id)
    },
    { upsert: true }
  );
  console.log(`Updated Contest 1 (${targetId}) with Level 1 problems.`);

  // 2. Contest 2 (Level 2)
  const contest2 = await Contest.findOneAndUpdate(
    { id: "contest-level-2" },
    {
      name: "C++ Contest — Level 2: Conditions & Decisions (if, else)",
      description: "Level 2 C++ programming contest for school beginners. Topics: if, else, else if, comparisons (>, <, ==, >=, <=), and even/odd logic.",
      startTime,
      endTime,
      problems: l2Saved.map(p => p._id),
      problemIds: l2Saved.map(p => p.id)
    },
    { upsert: true, new: true }
  );
  console.log(`Saved Contest 2 (${contest2._id}) with Level 2 problems.`);

  // 3. Contest 3 (Level 3)
  const contest3 = await Contest.findOneAndUpdate(
    { id: "contest-level-3" },
    {
      name: "C++ Contest — Level 3: Loops & Repetition (for loop)",
      description: "Level 3 C++ programming contest for school beginners. Topics: for loops, counting, series, sums, and combining loops with if statements.",
      startTime,
      endTime,
      problems: l3Saved.map(p => p._id),
      problemIds: l3Saved.map(p => p.id)
    },
    { upsert: true, new: true }
  );
  console.log(`Saved Contest 3 (${contest3._id}) with Level 3 problems.`);

  console.log("🎉 ALL 3 CONTESTS & 15 PROBLEMS SUCCESSFULLY SEEDED INTO MONGODB!");
  process.exit(0);
}

seedThreeContests().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
