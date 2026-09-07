const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Contest = require("../models/Contest");
const ContestProblem = require("../models/ContestProblem");
const ContestSubmission = require("../models/ContestSubmission");
const judge = require("judge-cpp");
const { computeLeaderboard } = require("../lib/leaderboard");
const { getJudgeSettings } = require("../lib/judgeSettings");
const { isAdminRequest, requireAdmin } = require("../lib/adminAuth");
const { stripHiddenTestCaseIO } = require("../lib/hiddenTestCases");

// `checker` picks how a problem's output is compared - "token"
// (whitespace-insensitive, the default) or "exact" (line/spacing-sensitive,
// for pattern-printing problems) - see packages/judge-cpp/index.js. Used by
// every *creation* path (single-add, bulk-add, bulk-contest-import): a
// missing value defaults to "token", same default judge-cpp's run() and the
// schema itself both use for a problem that already exists with no value
// stored. An explicitly-supplied but unrecognized value (a typo in a
// bulk-import file, say) is a real mistake and must be rejected, not
// silently guessed.
function resolveChecker(value) {
  if (value === undefined || value === null || value === "") return { checker: "token" };
  if (value !== "token" && value !== "exact") {
    return { error: `Invalid checker "${value}" - must be "token" or "exact"` };
  }
  return { checker: value };
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
    inputFormat, outputFormat, timeLimit, memoryLimit, checker, points,
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
    const resolvedChecker = resolveChecker(checker);
    if (resolvedChecker.error) {
      return { id, title, status: "skipped", reason: resolvedChecker.error };
    }
    contestProblem = new ContestProblem({
      id, title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit, checker: resolvedChecker.checker, points,
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

// @route   GET /api/contests/live-status
// @desc    Is any contest currently running right now (startTime <= now <=
// endTime)? Used to gate anything that would disrupt every connected
// laptop at once - the server auto-deploy script (apps/server/deploy) and
// the Electron client's auto-update (main.js's installUpdateIfSafe) both
// hold off while this is true, so a code push or app update never cuts off
// a student mid-contest. Must be registered before the /:contestId route
// below, or Express would treat "live-status" as a contestId.
router.get("/live-status", async (req, res) => {
  try {
    const now = new Date();
    const liveContests = await Contest.find({ startTime: { $lte: now }, endTime: { $gte: now } }).select(
      "name startTime endTime"
    );
    res.json({ anyLive: liveContests.length > 0, liveContests });
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

    const contestObj = contest.toObject();
    contestObj.problems = contestObj.problems.map((p) => stripHiddenTestCaseIO(p, contest, req));

    res.json(contestObj);
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

    res.json(stripHiddenTestCaseIO(contestProblem, contest, req));
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/contests/:contestId/join
// @desc    Records a student's presence in a contest the moment they submit
// the name+roll join form (still identification, not authentication - see
// the no-auth decision in CLAUDE.md). Upserted by roll number, so re-joining
// (reload, different laptop) just refreshes name/joinedAt instead of
// duplicating. computeLeaderboard() seeds a zero-score row per participant,
// so the admin sees them on the leaderboard immediately, before any
// submission - not gated on startTime, since joining itself is harmless.
router.post("/:contestId/join", async (req, res) => {
  try {
    const { studentName, studentRollNumber } = req.body;
    if (!studentName || !studentRollNumber) {
      return res.status(400).json({ msg: "studentName and studentRollNumber are required" });
    }

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const existing = contest.participants.find((p) => p.studentRollNumber === studentRollNumber);
    if (existing) {
      existing.studentName = studentName;
      existing.joinedAt = new Date();
    } else {
      contest.participants.push({ studentRollNumber, studentName });
    }

    await contest.save();
    res.json({ msg: "Joined" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/contests
// @desc    Create a new contest
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, startTime, endTime, description, problemIds, settings } = req.body;
    let { id } = req.body;

    if (!id) id = crypto.randomBytes(4).toString("hex");

    const newContest = new Contest({
      id,
      name,
      startTime,
      endTime,
      description,
      problemIds: problemIds || [],
      settings,
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
router.post("/bulk", requireAdmin, async (req, res) => {
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
router.put("/:contestId", requireAdmin, async (req, res) => {
  try {
    const { name, startTime, endTime, description, problemIds, settings } = req.body;

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    contest.name = name ?? contest.name;
    contest.startTime = startTime ?? contest.startTime;
    contest.endTime = endTime ?? contest.endTime;
    contest.description = description ?? contest.description;
    contest.problemIds = problemIds ?? contest.problemIds;
    if (settings) contest.settings = { ...contest.settings?.toObject?.() ?? contest.settings, ...settings };

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
router.put("/:contestId/disqualify", requireAdmin, async (req, res) => {
  try {
    const { studentRollNumber, studentName, disqualified, reason } = req.body;
    if (!studentRollNumber) return res.status(400).json({ msg: "studentRollNumber is required" });

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    contest.disqualifiedStudents = contest.disqualifiedStudents.filter(
      (d) => d.studentRollNumber !== studentRollNumber
    );
    if (disqualified) {
      contest.disqualifiedStudents.push({ studentRollNumber, studentName, reason });
    }

    await contest.save();
    res.json({ disqualifiedStudents: contest.disqualifiedStudents });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   DELETE /api/contests/bulk
// @desc    Delete multiple contests in one shot - same cleanup per id as
// single DELETE /:contestId (submissions + attached problems + the contest
// itself). Registered before /:contestId so "bulk" isn't swallowed as a
// :contestId param. A missing/bad id is skipped and reported rather than
// failing the whole batch, same skip-and-report pattern as the other bulk
// routes in this file.
router.delete("/bulk", requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ msg: "Body must be { ids: [...] }" });
    }

    const results = [];
    for (const id of ids) {
      const contest = await Contest.findById(id).catch(() => null);
      if (!contest) {
        results.push({ id, status: "skipped", reason: "Contest not found" });
        continue;
      }

      await ContestSubmission.deleteMany({ contest: contest._id });
      await ContestProblem.deleteMany({ _id: { $in: contest.problems } });
      await Contest.findByIdAndDelete(id);
      results.push({ id, status: "deleted" });
    }

    res.json({ results });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   DELETE /api/contests/:contestId
router.delete("/:contestId", requireAdmin, async (req, res) => {
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

// @route   DELETE /api/contests/:contestId/problems/bulk
// @desc    Remove multiple problems from one contest in one shot - same
// detach-only semantics as single DELETE .../problems/:problemId (the
// ContestProblem document itself is NOT deleted, since a problem can be
// attached to more than one contest - only this contest's references to it
// are pulled). Registered before .../problems/:problemId so "bulk" isn't
// swallowed as a :problemId param.
router.delete("/:contestId/problems/bulk", requireAdmin, async (req, res) => {
  try {
    const { problemIds } = req.body;
    if (!Array.isArray(problemIds) || problemIds.length === 0) {
      return res.status(400).json({ msg: "Body must be { problemIds: [...] }" });
    }

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const results = [];
    for (const problemId of problemIds) {
      const problem = await ContestProblem.findOne({ id: problemId });
      if (!problem) {
        results.push({ problemId, status: "skipped", reason: "Problem not found" });
        continue;
      }
      contest.problems.pull(problem._id);
      contest.problemIds.pull(problem.id);
      results.push({ problemId, status: "removed" });
    }

    await contest.save();
    res.json({ results });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   DELETE /api/contests/:contestId/problems/:problemId
router.delete("/:contestId/problems/:problemId", requireAdmin, async (req, res) => {
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
router.post("/:contestId/problems", requireAdmin, async (req, res) => {
  try {
    const {
      id, title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit, checker, points,
      sampleTestCases, hiddenTestCases,
    } = req.body;

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    if (contest.problemIds.includes(id)) {
      return res.status(400).json({ msg: "Problem with this ID already exists in this contest" });
    }

    let contestProblem = await ContestProblem.findOne({ id });
    if (!contestProblem) {
      const resolvedChecker = resolveChecker(checker);
      if (resolvedChecker.error) return res.status(400).json({ msg: resolvedChecker.error });
      contestProblem = new ContestProblem({
        id, title, description, category, difficulty, constraints,
        inputFormat, outputFormat, timeLimit, memoryLimit, checker: resolvedChecker.checker, points,
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
router.post("/:contestId/problems/bulk", requireAdmin, async (req, res) => {
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
router.put("/:contestId/problems/:problemId", requireAdmin, async (req, res) => {
  try {
    const {
      title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit, checker, points,
      sampleTestCases, hiddenTestCases,
    } = req.body;

    const contestProblem = await ContestProblem.findOne({ id: req.params.problemId });
    if (!contestProblem) return res.status(404).json({ msg: "Problem not found" });

    // Unlike creation, a missing `checker` here means "this edit didn't
    // touch it" (an older admin build, or an API caller that only wants to
    // change other fields) - preserve whatever's already on the document
    // rather than resolving it to "token" and clobbering an intentional
    // "exact" via Object.assign.
    if (checker !== undefined) {
      const resolvedChecker = resolveChecker(checker);
      if (resolvedChecker.error) return res.status(400).json({ msg: resolvedChecker.error });
      contestProblem.checker = resolvedChecker.checker;
    }

    Object.assign(contestProblem, {
      title, description, category, difficulty, constraints,
      inputFormat, outputFormat, timeLimit, memoryLimit, points,
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
    const judgeSettings = await getJudgeSettings();

    const result = await judge.run({
      sourceCode: code,
      testCases,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
      judgeSettings,
      checker: problem.checker,
    });

    if (result.status === "Error") {
      return res.json(result);
    }

    // Hidden test cases are the "answer key" - while the contest is still
    // running (and the admin hasn't disabled this via contest.settings),
    // strip the actual input/expected/got values from a submit-mode result
    // so a student can't read them off a failed submission, keeping just the
    // verdict (Accepted/Wrong Answer/TLE/MLE/...) and which test number it
    // stopped on. Sample-testcase Run results are never redacted (the
    // student already has that I/O on the problem page), and once the
    // contest ends the full diff is restored for review.
    const shouldHideHiddenIO = contest.settings?.hideHiddenTestCasesWhileLive !== false;
    const contestStillRunning = contest.endTime && new Date(contest.endTime) > now;
    if (mode !== "run" && shouldHideHiddenIO && contestStillRunning && Array.isArray(result.results)) {
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
          source: "server-judged",
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
// client's local judge). Upserts by localId so retries are safe.
//
// This route is reachable by every student's laptop with no token (there is
// no per-device auth in this build - see the no-auth decision), so it can
// NEVER trust a client-reported verdict/testCasesPassed the way it used to:
// that let anyone with devtools open POST a fabricated "Accepted" for any
// problem with no code ever compiled. Instead this now re-judges every
// synced submission server-side against the real hidden test cases, exactly
// like the direct /submit route does - Electron's own local verdict is only
// ever a fast preview shown to the student while offline; this is the one
// that actually counts for the leaderboard. Yes, this means a submission
// gets compiled twice (once locally, once on sync) - that's the price of the
// server being the only thing that can authoritatively say "Accepted".
router.post("/:contestId/submissions/sync", async (req, res) => {
  try {
    const { contestId } = req.params;
    const { submissions } = req.body;
    if (!Array.isArray(submissions)) {
      return res.status(400).json({ msg: "submissions must be an array" });
    }

    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ msg: "Contest not found" });

    const judgeSettings = await getJudgeSettings();
    const results = [];
    for (const sub of submissions) {
      // Trust that this submission genuinely happened and save it even if
      // its submittedAt is after the contest ended (a laptop can push its
      // local queue well after the contest window closes, or a student
      // keeps practicing post-contest) - this is safe because the
      // leaderboard route filters by `submittedAt <= contest.endTime`
      // independently, so a late submission is recorded for the record but
      // can never move the leaderboard. What's re-judged below is only the
      // VERDICT of that submission, never whether it's allowed to exist.
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

      const problem = await ContestProblem.findOne({ id: sub.contestProblemId });
      let verdict, testCasesPassed, totalTestCases, timeTaken, errorLog;
      if (!problem || typeof sub.code !== "string" || !sub.code.trim()) {
        verdict = "Error";
        testCasesPassed = 0;
        totalTestCases = 0;
        timeTaken = undefined;
        errorLog = !problem ? "Problem not found" : "No code submitted";
      } else {
        const judged = await judge.run({
          sourceCode: sub.code,
          testCases: problem.hiddenTestCases,
          timeLimit: problem.timeLimit,
          memoryLimit: problem.memoryLimit,
          judgeSettings,
          checker: problem.checker,
        });
        verdict = judged.status;
        testCasesPassed = judged.testCasesPassed ?? 0;
        totalTestCases = judged.totalTestCases ?? (problem.hiddenTestCases || []).length;
        timeTaken = judged.timeTaken;
        errorLog = judged.errorLog;
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
          verdict,
          testCasesPassed,
          totalTestCases,
          timeTaken,
          errorLog,
          submittedAt: sub.submittedAt,
          source: "client-synced",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push({ localId: sub.localId, savedId: saved._id, verdict });
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
