const mongoose = require('mongoose');
// The checker ids/types come from the judge itself - see the `checker` field
// below for why this list is not written out a second time here.
const { CHECKER_IDS, DEFAULT_CHECKER } = require('judge-cpp');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: false, default: "" },
  output: { type: String, required: false, default: "" }
});

// Options for the "custom" checker only - every other checker ignores them
// (see packages/judge-cpp/checkers.js's normalizeCheckerConfig, which is the
// authority on this shape and refuses to throw on anything malformed). Stored
// as a real subdocument rather than Mixed so an admin can read a problem's
// grading rule straight out of the database, but the judge still sanitizes
// what it receives: this schema is the storage contract, not the comparison
// logic.
const checkerConfigSchema = new mongoose.Schema(
  {
    compareAs: { type: String, enum: ["lines", "tokens"], default: "lines" },
    ignoreWhitespace: { type: Boolean, default: true },
    ignoreBlankLines: { type: Boolean, default: true },
    ignoreCase: { type: Boolean, default: false },
    ignoreChars: { type: String, default: "" },
    numberTolerance: { type: Number, default: null },
  },
  { _id: false }
);

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
  // How output is compared. The enum comes from judge-cpp's own checker
  // registry rather than a second hand-written list here, so a value can
  // never be storable without judging knowing how to apply it (and vice
  // versa). See packages/judge-cpp/checkers.js for each mode's rules and
  // admin-web's lib/checkers.ts for the labels/help text. Applies
  // platform-wide to any problem, old or new - a problem saved before this
  // field existed reads back as the default too, same as one created today
  // without touching the dropdown.
  checker: { type: String, enum: CHECKER_IDS, default: DEFAULT_CHECKER },
  // Read only when `checker` is "custom"; harmless on every other problem.
  checkerConfig: { type: checkerConfigSchema, default: () => ({}) },
  // Read only when `checker` is "code": the admin's C++ source defining
  // `bool checker(string expected, string user)` (see
  // packages/judge-cpp/codeChecker.js). Validated (compiled) on every save,
  // synced to lab laptops so offline judging uses the same function, and
  // stripped from every response a student's screen receives.
  checkerCode: { type: String, default: "" },
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
