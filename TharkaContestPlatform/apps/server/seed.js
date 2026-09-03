// Dev/demo seed: one sample contest with two real C++ problems, for manually
// verifying the API end-to-end (create/edit/submit/results) without needing
// the admin UI built yet.
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Contest = require("./models/Contest");
const ContestProblem = require("./models/ContestProblem");
const ContestSubmission = require("./models/ContestSubmission");

const problems = [
  {
    id: 1,
    title: "Sum of Two Numbers",
    description: "Read two integers A and B and print their sum.",
    category: "Introductory",
    difficulty: "Easy",
    constraints: "-10^9 <= A, B <= 10^9",
    inputFormat: "Two space-separated integers A and B.",
    outputFormat: "A single integer: A + B.",
    timeLimit: 1000,
    memoryLimit: 256,
    sampleTestCases: [{ input: "2 3", output: "5" }],
    hiddenTestCases: [
      { input: "2 3", output: "5" },
      { input: "-5 5", output: "0" },
      { input: "1000000000 1000000000", output: "2000000000" },
    ],
  },
  {
    id: 2,
    title: "Reverse a String",
    description: "Read a string S and print it reversed.",
    category: "Strings",
    difficulty: "Easy",
    constraints: "1 <= |S| <= 1000, no spaces",
    inputFormat: "A single string S.",
    outputFormat: "S reversed.",
    timeLimit: 1000,
    memoryLimit: 256,
    sampleTestCases: [{ input: "hello", output: "olleh" }],
    hiddenTestCases: [
      { input: "hello", output: "olleh" },
      { input: "a", output: "a" },
      { input: "racecar", output: "racecar" },
    ],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log("Connected. Wiping existing contest data...");

  await ContestSubmission.deleteMany({});
  await ContestProblem.deleteMany({});
  await Contest.deleteMany({});

  const savedProblems = await ContestProblem.insertMany(problems);

  const now = new Date();
  const contest = await Contest.create({
    id: "demo-contest",
    name: "Demo Contest",
    description: "Seeded demo contest for local testing.",
    startTime: new Date(now.getTime() - 5 * 60 * 1000), // started 5 min ago
    endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // ends in 2 hours
    problems: savedProblems.map((p) => p._id),
    problemIds: savedProblems.map((p) => p.id),
  });

  console.log(`Seeded contest "${contest.id}" with ${savedProblems.length} problems.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
