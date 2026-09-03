const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(require('child_process').exec);

const Contest = require("../models/Contest");
const ContestProblem = require("../models/ContestProblem");
const Course = require("../models/Course.js");
const ContestSubmission = require("../models/ContestSubmission");
// ... (rest of the file is same)

// ... (rest of the file is same)
const User = require("../models/User"); // Needed for checking user enrollment

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user || user.role !== 'admin') {
            return res.status(404).json({ msg: 'Access denied.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Middleware to check if user is enrolled in the course or is admin
const requireEnrollmentOrAdmin = async (req, res, next) => {
    try {
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (user.role === 'admin') {
            return next();
        }

        const courseIdParam = req.params.courseId || (req.contest && req.contest.courseId);
        if (!courseIdParam) {
            return res.status(400).json({ msg: 'Course ID missing' });
        }

        const course = await Course.findOne({ id: courseIdParam });
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }

        if (!user.courses.includes(course._id)) {
            return res.status(403).json({ msg: 'Access denied. You must be enrolled in this course.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};


// @route   GET /api/contests/courses/:courseId
// @desc    Get all contests for a specific course
// @access  Protected (Enrolled User or Admin)
router.get("/courses/:courseId", ClerkExpressRequireAuth(), requireEnrollmentOrAdmin, async (req, res) => {
    try {
        const contests = await Contest.find({ courseId: req.params.courseId }).populate('problems');
        res.json(contests);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET /api/contests/:contestId
// @desc    Get a single contest's details
// @access  Protected (Enrolled User or Admin)
router.get("/:contestId", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const contest = await Contest.findById(req.params.contestId)
                                     .populate('problems'); // Populate ContestProblem details

        if (!contest) {
            return res.status(404).json({ msg: 'Contest not found' });
        }

        const now = new Date();
        if (contest.startTime > now) {
            const user = await User.findOne({ clerkId: req.auth.userId });
            if (!user || user.role !== 'admin') {
                contest.problems = [];
            }
        }

        // Attach contest to request for requireEnrollmentOrAdmin middleware
        req.contest = contest;
        await requireEnrollmentOrAdmin(req, res, async () => {
            res.json(contest);
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET /api/contests/:contestId/problems/:problemId
// @desc    Get a single contest problem's details
// @access  Protected (Enrolled User or Admin)
router.get("/:contestId/problems/:problemId", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const contest = await Contest.findById(req.params.contestId);
        if (!contest) {
            return res.status(404).json({ msg: 'Contest not found' });
        }
        req.contest = contest; // Attach contest to request for requireEnrollmentOrAdmin middleware

        const now = new Date();
        if (contest.startTime > now) {
            const user = await User.findOne({ clerkId: req.auth.userId });
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ msg: 'Contest has not started yet.' });
            }
        }

        await requireEnrollmentOrAdmin(req, res, async () => {
            const contestProblem = await ContestProblem.findOne({ id: req.params.problemId });

            if (!contestProblem) {
                return res.status(404).json({ msg: 'Contest problem not found' });
            }
            res.json(contestProblem);
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});


// @route   POST /api/admin/contests
// @desc    Create a new contest
// @access  Admin
router.post("/", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const { name, courseId, startTime, endTime, description, problemIds } = req.body;
        let { id } = req.body;

        // If no ID is provided, generate a unique one.
        if (!id) {
            id = crypto.randomBytes(4).toString('hex'); // Creates an 8-character hex string
        }

        const newContest = new Contest({
            id,
            name,
            courseId,
            startTime,
            endTime,
            description,
            problemIds: problemIds || []
        });

        await newContest.save();
        res.status(201).json(newContest);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT /api/admin/contests/:contestId
// @desc    Update a contest
// @access  Admin
router.put("/:contestId", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const { name, courseId, startTime, endTime, description, problemIds } = req.body;

        const contest = await Contest.findById(req.params.contestId);
        if (!contest) {
            return res.status(404).json({ msg: 'Contest not found' });
        }

        contest.name = name || contest.name;
        contest.courseId = courseId || contest.courseId;
        contest.startTime = startTime || contest.startTime;
        contest.endTime = endTime || contest.endTime;
        contest.description = description || contest.description;
        contest.problemIds = problemIds || contest.problemIds;

        await contest.save();
        res.json(contest);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE /api/admin/contests/:contestId
// @desc    Delete a contest
// @access  Admin
router.delete("/:contestId", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const contest = await Contest.findById(req.params.contestId);
        if (!contest) {
            return res.status(404).json({ msg: 'Contest not found' });
        }

        // Delete associated submissions and problems
        await ContestSubmission.deleteMany({ contest: contest._id });
        await ContestProblem.deleteMany({ _id: { $in: contest.problems } });
        
        await Contest.findByIdAndDelete(req.params.contestId);

        res.json({ msg: 'Contest deleted successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE /api/admin/contests/:contestId/problems/:problemId
// @desc    Delete a problem from a contest
// @access  Admin
router.delete("/:contestId/problems/:problemId", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const contest = await Contest.findById(req.params.contestId);
        if (!contest) {
            return res.status(404).json({ msg: 'Contest not found' });
        }

        const problem = await ContestProblem.findOne({ id: req.params.problemId });
        if (!problem) {
            return res.status(404).json({ msg: 'Problem not found' });
        }

        // Remove problem from contest
        contest.problems.pull(problem._id);
        contest.problemIds.pull(problem.id);

        await contest.save();

        res.json({ msg: 'Problem removed from contest successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST /api/admin/contests/:contestId/problems
// @desc    Add a problem to a contest (or create a new problem)
// @access  Admin
router.post("/:contestId/problems", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const { id, title, description, category, difficulty, constraints,
                inputFormat, outputFormat, timeLimit, memoryLimit,
                sampleTestCases, hiddenTestCases } = req.body;
        
        const contest = await Contest.findById(req.params.contestId);
        if (!contest) {
            return res.status(404).json({ msg: 'Contest not found' });
        }

        // Check if problem with this ID already exists for this contest
        if (contest.problemIds.includes(id)) {
            return res.status(400).json({ msg: 'Problem with this ID already exists in this contest' });
        }

        let contestProblem = await ContestProblem.findOne({ id });
        if (contestProblem) {
            // If problem already exists in ContestProblem collection, just link it
            contest.problems.push(contestProblem._id);
            contest.problemIds.push(id);
        } else {
            // Create new ContestProblem
            contestProblem = new ContestProblem({
                id, title, description, category, difficulty, constraints,
                inputFormat, outputFormat, timeLimit, memoryLimit,
                sampleTestCases, hiddenTestCases
            });
            await contestProblem.save();
            contest.problems.push(contestProblem._id);
            contest.problemIds.push(id);
        }
        
        await contest.save();
        res.status(201).json(contestProblem);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT /api/contests/:contestId/problems/:problemId
// @desc    Update a problem in a contest
// @access  Admin
router.put("/:contestId/problems/:problemId", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const { title, description, category, difficulty, constraints,
                inputFormat, outputFormat, timeLimit, memoryLimit,
                sampleTestCases, hiddenTestCases } = req.body;
        
        let contestProblem = await ContestProblem.findOne({ id: req.params.problemId });

        if (!contestProblem) {
            return res.status(404).json({ msg: 'Problem not found' });
        }

        contestProblem.title = title;
        contestProblem.description = description;
        contestProblem.category = category;
        contestProblem.difficulty = difficulty;
        contestProblem.constraints = constraints;
        contestProblem.inputFormat = inputFormat;
        contestProblem.outputFormat = outputFormat;
        contestProblem.timeLimit = timeLimit;
        contestProblem.memoryLimit = memoryLimit;
        contestProblem.sampleTestCases = sampleTestCases;
        contestProblem.hiddenTestCases = hiddenTestCases;

        await contestProblem.save();
        res.json(contestProblem);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});




// ... (previous content)
async function runInJail(execPath, input, timeLimit) {
    const scriptPath = path.resolve(__dirname, '..', 'run_in_nsjail.sh');
    
    // The script needs to be executable
    try {
        fs.chmodSync(scriptPath, '755');
    } catch(e) {
        // ignore error if already executable
    }

    // nsjail time limit is in seconds
    const timeLimitInSeconds = Math.ceil(timeLimit / 1000);
    const memoryLimitMB = 256; // Default memory limit in MB

    return new Promise((resolve, reject) => {
        const child = spawn(scriptPath, [execPath, timeLimitInSeconds.toString(), memoryLimitMB.toString()]);
        let output = '';
        let error = '';

        child.stdin.write(input);
        child.stdin.end();

        child.stdout.on('data', (data) => output += data.toString());
        child.stderr.on('data', (data) => error += data.toString());

        child.on('close', (code) => {
            // Corresponds to nsjail's own exit codes. 109 is for timeout.
            if (code === 109) { 
                 return reject(new Error("Time Limit Exceeded"));
            }
            // Corresponds to the executed program's exit code
            if (code !== 0) {
                reject(new Error(error || "Runtime Error"));
            }
            else resolve(output);
        });
    });
}

router.post("/:contestId/problems/:problemId/submit", ClerkExpressRequireAuth(), async (req, res) => {
    const { code, mode } = req.body;
    const { contestId, problemId } = req.params;

    if (!code) return res.status(400).json({ status: "Error", message: "No code provided" });

    // WARNING: This blocklist-based security is not foolproof and can be bypassed.
    // A proper sandbox environment is the recommended way to run untrusted code.
    const blockedKeywords = ['rm', 'mv', 'chmod', 'chown', 'reboot', 'shutdown', 'halt', 'poweroff', 'mkfs', 'dd', 'wget', 'curl', 'apt', 'yum', 'pacman', 'systemctl', 'service', 'system', 'filesystem', 'unistd', 'fork', 'exec'];
    const blockedIncludes = ['<filesystem>', '<unistd.h>', '<curl/curl.h>', '<sys/socket.h>', '<netdb.h>'];

    const foundBlockedKeyword = blockedKeywords.find(cmd => {
        const regex = new RegExp(`\\b${cmd}\\b`);
        return regex.test(code);
    });

    const foundBlockedInclude = blockedIncludes.find(include => code.includes(include));

    if (foundBlockedKeyword || foundBlockedInclude) {
        return res.status(400).json({ status: "Error", message: "Your code appears to contain system commands or blocked libraries. Please remove them and submit again. dont do this again" });
    }

    let sourcePath = null;
    let execPath = null;

    try {
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const contest = await Contest.findById(contestId);
        if (!contest) return res.status(404).json({ msg: 'Contest not found' });

        const problem = await ContestProblem.findOne({ id: problemId });
        if (!problem) return res.status(404).json({ msg: 'Problem not found' });
        
        // Basic access check (can be enhanced with enrollment check)
        req.contest = contest;
        await requireEnrollmentOrAdmin(req, res, async () => {
            const testCases = (mode === 'run') ? problem.sampleTestCases : problem.hiddenTestCases;
            if (!testCases || testCases.length === 0) {
                return res.json({ status: "Error", message: "No test cases found for this mode." });
            }

            const timeLimit = problem.timeLimit || 2000; // 2 seconds
            const uniqueId = Date.now();
            
            const tempDir = path.resolve(__dirname, '..', 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            sourcePath = path.join(tempDir, `sub_contest_${uniqueId}.cpp`);
            execPath = path.join(tempDir, `sub_contest_${uniqueId}`);

            fs.writeFileSync(sourcePath, code);

            try {
                // Still compile outside the jail, but run inside.
                await execPromise(`g++ "${sourcePath}" -o "${execPath}"`);
            } catch (compileError) {
                if (mode !== 'run') {
                    await new ContestSubmission({
                        user: user._id,
                        contest: contest._id,
                        contestProblemId: problem.id,
                        language: 'cpp',
                        code,
                        verdict: 'Compilation Error',
                        errorLog: compileError.stderr || compileError.message
                    }).save();
                }
                return res.json({ status: "Compilation Error", message: compileError.stderr || compileError.message });
            }

            let allPassed = true;
            let results = [];
            let maxTime = 0;

            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                const startTime = Date.now();
                try {
                    const userOutput = await runInJail(execPath, tc.input || "", timeLimit);
                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    if (duration > maxTime) maxTime = duration;

                    const passed = userOutput.trim() === tc.output.trim();
                    results.push({ testCase: i + 1, passed, userOutput: userOutput.trim(), expectedOutput: tc.output.trim(), input: tc.input });
                    if (!passed) allPassed = false;
                } catch (e) {
                    allPassed = false;
                    let errorMessage = e.message;
                     if (e.message.includes("Time Limit Exceeded")) {
                        errorMessage = "TLE";
                    }
                    results.push({ testCase: i + 1, passed: false, error: errorMessage });
                     if (mode === 'run') break;
                }
            }

            const finalVerdict = allPassed ? "Accepted" : "Wrong Answer";

            if (mode !== 'run') {
                await new ContestSubmission({
                    user: user._id,
                    contest: contest._id,
                    contestProblemId: problem.id,
                    language: 'cpp',
                    code,
                    verdict: finalVerdict,
                    testCasesPassed: results.filter(r => r.passed).length,
                    totalTestCases: testCases.length,
                    timeTaken: maxTime
                }).save();
            }

            res.json({ status: finalVerdict, results });
        });
    } catch (err) {
        console.error("Submit Error:", err);
        res.status(500).json({ status: "Error", message: "Internal Server Error: " + err.message });
    } finally {
        if (sourcePath && fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
        if (execPath && fs.existsSync(execPath)) fs.unlinkSync(execPath);
    }
});

// @route   GET /api/contests/:contestId/problems/:problemId/submissions
// @desc    Get all submissions for a contest problem
// @access  Protected
router.get("/:contestId/problems/:problemId/submissions", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const { contestId, problemId } = req.params;
        
        const submissions = await ContestSubmission.find({ 
            user: user._id,
            contest: contestId,
            contestProblemId: problemId,
        })
        .sort({ submittedAt: -1 });

        res.json(submissions);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET /api/contests/:contestId/results
// @desc    Get results for the current user in a contest
// @access  Protected (Enrolled User or Admin)
router.get("/:contestId/results", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const { contestId } = req.params;

        const contest = await Contest.findById(contestId).populate('problems');
        if (!contest) return res.status(404).json({ msg: 'Contest not found' });
        
        // Authorization check
        req.contest = contest;
        await requireEnrollmentOrAdmin(req, res, async () => {
            // 1. Get all submissions for the current user in this contest
            const userSubmissions = await ContestSubmission.find({
                user: user._id,
                contest: contestId,
            }).sort({ submittedAt: 'asc' });

            // 2. Get all submissions for all users in this contest for ranking
            const allSubmissions = await ContestSubmission.find({ contest: contestId })
                .populate('user', 'name')
                .sort({ submittedAt: 'asc' });

            // 3. Calculate scores and build a leaderboard
            const leaderboard = {};

            for (const sub of allSubmissions) {
                const userId = sub.user._id.toString();
                if (!leaderboard[userId]) {
                    leaderboard[userId] = {
                        user: sub.user,
                        scores: {},
                        totalScore: 0,
                        lastSubmissionTime: null,
                    };
                }

                // If problem is not yet accepted
                if (leaderboard[userId].scores[sub.contestProblemId]?.verdict !== 'Accepted') {
                    const submissionTime = new Date(sub.submittedAt).getTime();
                    const contestStartTime = new Date(contest.startTime).getTime();
                    const timeInMinutes = Math.floor((submissionTime - contestStartTime) / (1000 * 60));

                    if (sub.verdict === 'Accepted') {
                        const previousAttempts = leaderboard[userId].scores[sub.contestProblemId]?.attempts || 0;
                        leaderboard[userId].scores[sub.contestProblemId] = {
                            verdict: 'Accepted',
                            score: 100, // Or some point system
                            time: timeInMinutes,
                            attempts: previousAttempts + 1,
                        };
                    } else {
                        const previousAttempts = leaderboard[userId].scores[sub.contestProblemId]?.attempts || 0;
                        leaderboard[userId].scores[sub.contestProblemId] = {
                            verdict: sub.verdict,
                            score: 0,
                            time: timeInMinutes,
                            attempts: previousAttempts + 1,
                        };
                    }
                }
            }
            
            // Calculate total scores
            for (const userId in leaderboard) {
                leaderboard[userId].totalScore = Object.values(leaderboard[userId].scores).reduce((acc, s) => acc + s.score, 0);
            }

            // 4. Sort leaderboard: higher score is better
            const sortedLeaderboard = Object.values(leaderboard).sort((a, b) => {
                return b.totalScore - a.totalScore;
            });

            // 5. Find current user's rank
            const userRank = sortedLeaderboard.findIndex(entry => entry.user._id.toString() === user._id.toString()) + 1;
            
            // 6. Prepare user-specific results
            const userResult = {
                rank: userRank > 0 ? userRank : "N/A",
                totalScore: leaderboard[user._id.toString()]?.totalScore || 0,
                problemSummary: contest.problems.map((p) => {
                    const userProblemData = leaderboard[user._id.toString()]?.scores[p.id];
                    return {
                        id: p.id,
                        title: p.title,
                        status: userProblemData?.verdict || 'Not Attempted',
                        attempts: userProblemData?.attempts || 0,
                        time: userProblemData?.verdict === 'Accepted' ? userProblemData.time : null
                    }
                }),
                submissions: userSubmissions,
                leaderboard: sortedLeaderboard.map((u, index) => ({
                    rank: index + 1,
                    name: u.user.name,
                    score: u.totalScore,
                }))
            };

            res.json(userResult);
        });
    } catch (error) {
        console.error("Error fetching contest results:", error);
        res.status(500).json({ msg: 'Server Error' });
    }
});


module.exports = router;
       