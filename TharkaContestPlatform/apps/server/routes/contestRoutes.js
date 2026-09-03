const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Contest = require("../models/Contest");
const ContestProblem = require("../models/ContestProblem");
const ContestSubmission = require("../models/ContestSubmission");
const judge = require("judge-cpp");
const { computeLeaderboard } = require("../lib/leaderboard");

// No auth in this build (see plan decision: identification, not authentication).
// `admin=1` is a UX gate only (lets the admin app preview a contest before it
// starts) - it is not a security boundary. That's an accepted tradeoff of the
// no-auth decision, same as trusting client-reported judge verdicts on sync.
function isAdminRequest(req) {
  return req.query.admin === "1" || req.headers["x-contest-admin"] === "1";
}

// Used by the bulk importer when a problem entry omits `id` - single-add
// (the admin form) always sends an id because the UI generates one
// client-side, but a bulk JSON file may leave it out for convenience.
async function generateUniqueProblemId() {
  for (let i = 0; i < 20; i++) {
    const candidate = Math.floor(Math.random() * 900000) + 100000;
    if (!(await ContestProblem.findOne({ id: candidate }))) return candidate;
  }
  throw new Error("Could not generate a unique problem id");
}

// Shared by POST /:contestId/problems/bulk and POST /bulk (bulk contest
// creation, where each contest's `problems` array goes through this same
// path). Mutates `contest.problems`/`problemIds` in memory - caller is
// responsible for calling contest.save() afterwards. Mirrors the
// find-or-create-by-id behavior of the single-problem POST route: an id
// that already exists globally is reused as-is (not overwritten), an id
// already attached to this specific contest is skipped rather than erroring
// out the whole batch.
async function addProblemToContest(contest, data) {
  const {
    title, description, category, difficulty, constraints,
    inputFormat, outputFormat, timeLimit, memoryLimit,
    sampleTestCases, hiddenTestCases,
  } = data || {};

  let id = data && data.id;
  if (id === undefined || id === null || id === "") {
    id = await generateUniqueProblemId();
  }

  if (contest.problemIds.includes(id)) {
    return { id, title, status: "skipped", reason: "Problem with this ID already exists in this contest" };
  }

  let contestProblem = await ContestProblem.findOne({ id });
  let status = "reused";
  if (!contestProblem) {
    if (!title || !description || !difficulty) {
      return { id, title, status: "skipped", reason: "New problem id needs title, description, and difficulty" };
    }
    contestProblem = new ContestProblem({
      id, title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit,
      sampleTestCases: sampleTestCases || [], hiddenTestCases: hiddenTestCases || [],
    });
    await contestProblem.save();
    status = "created";
  }

  contest.problems.push(contestProblem._id);
  contest.problemIds.push(id);
  return { id, title: contestProblem.title, status, reason: null };
}

// @route   GET /api/contests
// @desc    List all contests
router.get("/", async (req, res) => {
  try {
    const contests = await Contest.find().sort({ startTime: -1 });
    res.json(contests);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   GET /api/contests/:contestId
router.get("/:contestId", async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.contestId).populate("problems");
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const now = new Date();
    if (contest.startTime > now && !isAdminRequest(req)) {
      contest.problems = [];
    }

    res.json(contest);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   GET /api/contests/:contestId/problems/:problemId
router.get("/:contestId/problems/:problemId", async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const now = new Date();
    if (contest.startTime > now && !isAdminRequest(req)) {
      return res.status(403).json({ msg: "Contest has not started yet." });
    }

    const contestProblem = await ContestProblem.findOne({ id: req.params.problemId });
    if (!contestProblem) return res.status(404).json({ msg: "Contest problem not found" });

    res.json(contestProblem);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/contests
// @desc    Create a new contest
router.post("/", async (req, res) => {
  try {
    const { name, startTime, endTime, description, problemIds } = req.body;
    let { id } = req.body;

    if (!id) id = crypto.randomBytes(4).toString("hex");

    const newContest = new Contest({
      id,
      name,
      startTime,
      endTime,
      description,
      problemIds: problemIds || [],
    });

    await newContest.save();
    res.status(201).json(newContest);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/contests/bulk
// @desc    Create multiple contests in one shot, each optionally carrying its
// own `problems` array (each optionally carrying its own sampleTestCases/
// hiddenTestCases) - see HOWTOUSE.md for the JSON format. Every level is
// optional: a contest can be created with zero problems, a problem with zero
// testcases. A bad/duplicate row is skipped and reported rather than failing
// the whole batch, so one typo doesn't lose an otherwise-good import.
router.post("/bulk", async (req, res) => {
  try {
    const { contests } = req.body;
    if (!Array.isArray(contests)) {
      return res.status(400).json({ msg: "Body must be { contests: [...] }" });
    }

    const results = [];
    for (const c of contests || []) {
      const { name, startTime, endTime, description, problems } = c || {};
      const id = (c && c.id) || crypto.randomBytes(4).toString("hex");

      if (!name || !startTime || !endTime) {
        results.push({ id, name, status: "skipped", reason: "Missing required field(s): name, startTime, endTime" });
        continue;
      }

      if (await Contest.findOne({ id })) {
        results.push({ id, name, status: "skipped", reason: "Contest with this ID already exists" });
        continue;
      }

      const contest = new Contest({ id, name, startTime, endTime, description, problems: [], problemIds: [] });

      const problemResults = [];
      if (Array.isArray(problems)) {
        for (const p of problems) {
          problemResults.push(await addProblemToContest(contest, p));
        }
      }

      await contest.save();
      results.push({ id, name, status: "created", contestObjectId: contest._id, problems: problemResults });
    }

    res.status(201).json({ results });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   PUT /api/contests/:contestId
router.put("/:contestId", async (req, res) => {
  try {
    const { name, startTime, endTime, description, problemIds } = req.body;

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    contest.name = name ?? contest.name;
    contest.startTime = startTime ?? contest.startTime;
    contest.endTime = endTime ?? contest.endTime;
    contest.description = description ?? contest.description;
    contest.problemIds = problemIds ?? contest.problemIds;

    await contest.save();
    res.json(contest);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   PUT /api/contests/:contestId/disqualify
// @desc    Toggle a student's disqualified status for this contest (by roll
// number). Disqualifying does not delete their submissions - the leaderboard
// route just flags and sorts them last instead of ranking their score, so
// this stays reversible if the admin flags the wrong student.
router.put("/:contestId/disqualify", async (req, res) => {
  try {
    const { studentRollNumber, studentName, disqualified } = req.body;
    if (!studentRollNumber) return res.status(400).json({ msg: "studentRollNumber is required" });

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    contest.disqualifiedStudents = contest.disqualifiedStudents.filter(
      (d) => d.studentRollNumber !== studentRollNumber
    );
    if (disqualified) {
      contest.disqualifiedStudents.push({ studentRollNumber, studentName });
    }

    await contest.save();
    res.json({ disqualifiedStudents: contest.disqualifiedStudents });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   DELETE /api/contests/:contestId
router.delete("/:contestId", async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    await ContestSubmission.deleteMany({ contest: contest._id });
    await ContestProblem.deleteMany({ _id: { $in: contest.problems } });
    await Contest.findByIdAndDelete(req.params.contestId);

    res.json({ msg: "Contest deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   DELETE /api/contests/:contestId/problems/:problemId
router.delete("/:contestId/problems/:problemId", async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const problem = await ContestProblem.findOne({ id: req.params.problemId });
    if (!problem) return res.status(404).json({ msg: "Problem not found" });

    contest.problems.pull(problem._id);
    contest.problemIds.pull(problem.id);
    await contest.save();

    res.json({ msg: "Problem removed from contest successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/contests/:contestId/problems
// @desc    Add a problem to a contest (or create a new problem)
router.post("/:contestId/problems", async (req, res) => {
  try {
    const {
      id, title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit,
      sampleTestCases, hiddenTestCases,
    } = req.body;

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    if (contest.problemIds.includes(id)) {
      return res.status(400).json({ msg: "Problem with this ID already exists in this contest" });
    }

    let contestProblem = await ContestProblem.findOne({ id });
    if (!contestProblem) {
      contestProblem = new ContestProblem({
        id, title, description, category, difficulty, constraints,
        inputFormat, outputFormat, timeLimit, memoryLimit,
        sampleTestCases, hiddenTestCases,
      });
      await contestProblem.save();
    }

    contest.problems.push(contestProblem._id);
    contest.problemIds.push(id);
    await contest.save();

    res.status(201).json(contestProblem);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/contests/:contestId/problems/bulk
// @desc    Add multiple problems to one existing contest in one shot, each
// optionally carrying its own sampleTestCases/hiddenTestCases. Same
// skip-and-report-per-row behavior as POST /bulk.
router.post("/:contestId/problems/bulk", async (req, res) => {
  try {
    const { problems } = req.body;
    if (!Array.isArray(problems)) {
      return res.status(400).json({ msg: "Body must be { problems: [...] }" });
    }

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const results = [];
    for (const p of problems) {
      results.push(await addProblemToContest(contest, p));
    }
    await contest.save();

    res.status(201).json({ results });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   PUT /api/contests/:contestId/problems/:problemId
router.put("/:contestId/problems/:problemId", async (req, res) => {
  try {
    const {
      title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit,
      sampleTestCases, hiddenTestCases,
    } = req.body;

    const contestProblem = await ContestProblem.findOne({ id: req.params.problemId });
    if (!contestProblem) return res.status(404).json({ msg: "Problem not found" });

    Object.assign(contestProblem, {
      title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit,
      sampleTestCases, hiddenTestCases,
    });

    await contestProblem.save();
    res.json(contestProblem);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/contests/:contestId/problems/:problemId/submit
// @desc    Judge code (interim: server-side, via packages/judge-cpp). Once the
// Electron client ships, this same judge module runs locally instead and this
// route is only hit by the plain-browser dev/demo path.
router.post("/:contestId/problems/:problemId/submit", async (req, res) => {
  const { code, mode, studentName, studentRollNumber, localId } = req.body;
  const { contestId, problemId } = req.params;

  if (!code) return res.status(400).json({ status: "Error", message: "No code provided" });
  if (mode !== "run" && (!studentName || !studentRollNumber)) {
    return res.status(400).json({ status: "Error", message: "studentName and studentRollNumber are required" });
  }

  try {
    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const now = new Date();
    if (contest.startTime > now && !isAdminRequest(req)) {
      return res.status(403).json({ status: "Error", message: "Contest has not started yet." });
    }
    // `submit` is intentionally NOT gated on endTime - students can keep
    // submitting after the contest ends (for practice/review, and so a
    // solution judged seconds after the buzzer isn't just lost). This is
    // safe because the leaderboard route (GET /:contestId/results) filters
    // every submission by `submittedAt <= contest.endTime` independently, so
    // a late submission is recorded but can never move the leaderboard,
    // regardless of what happens here.

    const problem = await ContestProblem.findOne({ id: problemId });
    if (!problem) return res.status(404).json({ msg: "Problem not found" });

    if (mode !== "run") {
      const alreadyAccepted = await ContestSubmission.findOne({
        contest: contest._id,
        contestProblemId: problem.id,
        studentRollNumber,
        verdict: "Accepted",
      });
      if (alreadyAccepted) {
        return res.json({
          status: "Accepted",
          message: "Already solved - this problem is already marked Accepted for you.",
          testCasesPassed: alreadyAccepted.testCasesPassed,
          totalTestCases: alreadyAccepted.totalTestCases,
          timeTaken: alreadyAccepted.timeTaken,
          alreadySolved: true,
        });
      }
    }

    const testCases = mode === "run" ? problem.sampleTestCases : problem.hiddenTestCases;

    const result = await judge.run({
      sourceCode: code,
      testCases,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
    });

    if (result.status === "Error") {
      return res.json(result);
    }

    // Hidden test cases are the "answer key" - while the contest is still
    // running, strip the actual input/expected/got values from a submit-mode
    // result so a student can't read them off a failed submission, keeping
    // just the verdict (Accepted/Wrong Answer/TLE/MLE/...) and which test
    // number it stopped on. Sample-testcase Run results are never redacted
    // (the student already has that I/O on the problem page), and once the
    // contest ends the full diff is restored for review.
    const contestStillRunning = contest.endTime && new Date(contest.endTime) > now;
    if (mode !== "run" && contestStillRunning && Array.isArray(result.results)) {
      result.results = result.results.map((r) => ({ testCase: r.testCase, passed: r.passed, error: r.error }));
    }

    if (mode !== "run") {
      await ContestSubmission.findOneAndUpdate(
        { localId: localId || crypto.randomUUID() },
        {
          contest: contest._id,
          contestProblemId: problem.id,
          studentName,
          studentRollNumber,
          language: "cpp",
          code,
          verdict: result.status,
          testCasesPassed: result.testCasesPassed,
          totalTestCases: result.totalTestCases,
          timeTaken: result.timeTaken,
          errorLog: result.errorLog,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    res.json(result);
  } catch (err) {
    console.error("Submit Error:", err);
    res.status(500).json({ status: "Error", message: "Internal Server Error: " + err.message });
  }
});

// @route   POST /api/contests/:contestId/submissions/sync
// @desc    Client push-up of locally-judged submissions (from the Electron
// client's local judge). Upserts by localId so retries are safe; the server
// trusts the client-computed verdict rather than re-judging.
router.post("/:contestId/submissions/sync", async (req, res) => {
  try {
    const { contestId } = req.params;
    const { submissions } = req.body;
    if (!Array.isArray(submissions)) {
      return res.status(400).json({ msg: "submissions must be an array" });
    }

    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const results = [];
    for (const sub of submissions) {
      // Trust the client's local judging and save it even if its
      // submittedAt is after the contest ended (a laptop can push its local
      // queue well after the contest window closes, or a student keeps
      // practicing post-contest) - this is safe because the leaderboard
      // route filters by `submittedAt <= contest.endTime` independently, so
      // a late submission is recorded for the record but can never move the
      // leaderboard.
      const alreadyAccepted = await ContestSubmission.findOne({
        contest: contest._id,
        contestProblemId: sub.contestProblemId,
        studentRollNumber: sub.studentRollNumber,
        verdict: "Accepted",
        localId: { $ne: sub.localId },
      });
      if (alreadyAccepted) {
        results.push({ localId: sub.localId, skipped: true, reason: "Already solved" });
        continue;
      }

      const saved = await ContestSubmission.findOneAndUpdate(
        { localId: sub.localId },
        {
          contest: contest._id,
          contestProblemId: sub.contestProblemId,
          studentName: sub.studentName,
          studentRollNumber: sub.studentRollNumber,
          language: sub.language || "cpp",
          code: sub.code,
          verdict: sub.verdict,
          testCasesPassed: sub.testCasesPassed,
          totalTestCases: sub.totalTestCases,
          timeTaken: sub.timeTaken,
          errorLog: sub.errorLog,
          submittedAt: sub.submittedAt,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push({ localId: sub.localId, savedId: saved._id });
    }

    res.json({ synced: results.length, results });
  } catch (error) {
    console.error("Sync submissions error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   GET /api/contests/:contestId/problems/:problemId/submissions?rollNumber=...
router.get("/:contestId/problems/:problemId/submissions", async (req, res) => {
  try {
    const { contestId, problemId } = req.params;
    const { rollNumber } = req.query;
    if (!rollNumber) return res.status(400).json({ msg: "rollNumber query param is required" });

    const submissions = await ContestSubmission.find({
      contest: contestId,
      contestProblemId: problemId,
      studentRollNumber: rollNumber,
    }).sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   GET /api/contests/:contestId/results
// @desc    Leaderboard for the contest, ranked by total score.
router.get("/:contestId/results", async (req, res) => {
  try {
    const { contestId } = req.params;

    const contest = await Contest.findById(contestId).populate("problems");
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const allSubmissions = await ContestSubmission.find({ contest: contestId }).sort({ submittedAt: "asc" });
    const { problems, leaderboard } = computeLeaderboard(contest, allSubmissions);

    res.json({ contestId, problems, leaderboard });
  } catch (error) {
    console.error("Error fetching contest results:", error);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
