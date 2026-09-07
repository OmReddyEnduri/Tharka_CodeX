const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: false, default: "" },
  output: { type: String, required: false, default: "" }
});

const contestProblemSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true }, // Custom ID for the problem
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: "General" },
  difficulty: { type: String, required: true },
  constraints: { type: String, required: false },
  inputFormat: { type: String, default: "Standard Input" },
  outputFormat: { type: String, default: "Standard Output" },
  // A floor, not just "required": 0 (or a typo'd negative number) would
  // instant-TLE/MLE every correct submission to this problem for the rest
  // of the contest, with no way for an admin to notice until a student
  // reports it.
  timeLimit: { type: Number, required: true, default: 1000, min: 100 },
  memoryLimit: { type: Number, required: true, default: 256, min: 16 },
  // How output is compared - "token" (whitespace-insensitive - the default,
  // right for almost all competitive-programming problems) or "exact"
  // (line/spacing-sensitive - only needed for pattern-printing/formatting
  // problems where leading spaces and line breaks are part of the answer).
  // See packages/judge-cpp/index.js's compareOutput() for the checkers
  // themselves. Applies platform-wide to any problem, old or new - a
  // problem saved before this field existed reads back as "token" too, same
  // as one created today without touching this dropdown.
  checker: { type: String, enum: ["token", "exact"], default: "token" },
  // How many leaderboard points an Accepted verdict on this problem is
  // worth - not every problem has to be worth the same amount (a Hard
  // problem can outweigh three Easy ones). See lib/leaderboard.js, which
  // looks this up per problem instead of using one fixed value for every
  // problem in every contest. A problem saved before this field existed
  // reads back as 100, matching what every problem was implicitly worth
  // when that was the only value that ever existed.
  points: { type: Number, required: true, default: 100, min: 1 },
  sampleTestCases: [testCaseSchema],
  hiddenTestCases: [testCaseSchema],
}, { timestamps: true });

module.exports = mongoose.model('ContestProblem', contestProblemSchema);
