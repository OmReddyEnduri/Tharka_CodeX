const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const crypto = require("crypto");
const https = require("https");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const jsrsasign = require('jsrsasign');
const User = require("./models/User");
const Course = require("./models/Course");
const CourseModule = require("./models/CourseModule");
const Topic = require("./models/Topic");
const Problem = require("./models/Problem");
const Submission = require("./models/Submission");
const Video = require("./models/Video");
const Contest = require("./models/Contest");
const ContestProblem = require("./models/ContestProblem");
const ContestSubmission = require("./models/ContestSubmission");
const path = require("path");
const fs = require('fs');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

// --- Request Logger (Removed for production) ---
// app.use((req, res, next) => {
//   console.log(`[Request] ${req.method} ${req.url}`);
//   next();
// });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { family: 4 })
.then(() => {
  console.log("Connected to MongoDB");
  seedCourses();
})
.catch(err => console.error("Could not connect to MongoDB...", err));

const courses = [
    {
    id: "1",
    name: "Basic Programming",
    provider: "Tharka High School",
    description: [
      "Introduction to Computers & Programming",
      "Variables, Data Types, and Operators",
      "Input/Output and Basic Syntax",
      "Conditional Statements and Loops",
      "Simple Projects & Problem Solving",
    ],
  },
  {
    id: "2",
    name: "Basic DSA",
    provider: "Tharka High School",
    description: [
      "Introduction to Data Structures",
      "Arrays and Strings",
      "Stacks and Queues",
      "Linked Lists",
      "Basic Searching & Sorting Algorithms",
    ],
  },
  {
    id: "3",
    name: "Advanced DSA",
    provider: "Tharka High School",
    description: [
      "Trees and Graphs",
      "Advanced Searching & Sorting",
      "Recursion and Dynamic Programming",
      "Hashing and Heaps",
      "Algorithmic Problem Solving",
    ],
  },
];

async function seedCourses() {
  const count = await Course.countDocuments();
  if (count === 0) {
    console.log("Seeding courses...");
    await Course.insertMany(courses);
    console.log("Courses seeded.");
  }
}

app.get("/api", (req, res) => {
  res.send("Server is running");
});

const adminCourseContentRoutes = require('./routes/admin/courseContent');
const contestRoutes = require('./routes/contestRoutes');
const webhookRoutes = require('./routes/webhooks');

// --- MIDDLEWARE ---
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.auth || !req.auth.userId) {
            console.error("[Auth Error] req.auth is missing in requireAdmin");
            return res.status(401).json({ msg: 'Unauthorized' });
        }
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user || user.role !== 'admin') {
            return res.status(404).json({ msg: 'Access denied.' }); // 404 to hide admin existence
        }
        next();
    } catch (error) {
        console.error("[RequireAdmin Error]", error);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Mount Webhook Routes (No Auth required, handled internally)
app.use('/api/webhooks', webhookRoutes);

// Mount Admin Content Routes
app.use('/api/admin/content', ClerkExpressRequireAuth(), requireAdmin, adminCourseContentRoutes);

// Mount Contest Routes
app.use('/api/contests', ClerkExpressRequireAuth(), contestRoutes);

// --- COURSE ROUTES ---

// Get all courses (Public - Syllabus Only)
app.get("/api/courses", async (req, res) => {
    try {
        const courses = await Course.find()
            .sort({ name: 1 })
            .populate({
                path: 'modules',
                select: 'title description topics',
                populate: {
                    path: 'topics',
                    select: 'title description' // Only show topic titles, not content
                }
            });
        res.json(courses);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get Single Course (Public)
app.get("/api/courses/:id", async (req, res) => {
    try {
        const course = await Course.findOne({ id: req.params.id });
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }
        res.json(course);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get Single Course Full Content (Protected)
app.get("/api/courses/:id/full", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const course = await Course.findOne({ id: req.params.id })
            .populate({
                path: 'modules',
                populate: {
                    path: 'topics',
                    populate: {
                        path: 'problems videos'
                    }
                }
            });

        if (!course) return res.status(404).json({ msg: 'Course not found' });

        // Access Check
        const hasAccess = user.role === 'admin' || user.courses.some(c => c.toString() === course._id.toString());
        
        if (!hasAccess) {
             return res.status(403).json({ msg: 'Access denied. You do not have access to this course.' });
        }

        // --- Start: First Access Tracking ---
        if (user.role !== 'admin') {
            const accessRecord = await CourseAccess.findOne({ user: user._id, course: course._id });
            if (!accessRecord) {
                await CourseAccess.create({
                    user: user._id,
                    course: course._id,
                    firstAccessedAt: new Date()
                });
            }
        }
        // --- End: First Access Tracking ---

        res.json(course);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Create course (Admin)
app.post("/api/admin/courses", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const { id, name, provider, description } = req.body;
        
        // Validation
        if (!id || !name) {
            return res.status(400).json({ msg: 'Please provide id and name' });
        }

        const existingCourse = await Course.findOne({ id });
        if (existingCourse) {
            return res.status(400).json({ msg: 'Course with this ID already exists' });
        }

        const course = new Course({
            id,
            name,
            provider: provider || "Tharka High School",
            description: Array.isArray(description) ? description : [description]
        });

        await course.save();
        res.json(course);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Update course (Admin)
app.put("/api/admin/courses/:id", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const { name, provider, description } = req.body;
        const course = await Course.findOne({ id: req.params.id });
        
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }

        if (name) course.name = name;
        if (provider) course.provider = provider;
        if (description) course.description = Array.isArray(description) ? description : [description];

        await course.save();
        res.json(course);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Delete course (Admin)
app.delete("/api/admin/courses/:id", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const course = await Course.findOneAndDelete({ id: req.params.id });
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }
        res.json({ msg: 'Course deleted' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// --- USER ROUTES ---

// Sync User Data (Call on login)
app.post("/api/users/sync", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { email, name } = req.body;
        const updateData = {};
        if (email) updateData.email = email;
        if (name) updateData.name = name;

        const user = await User.findOneAndUpdate(
            { clerkId: req.auth.userId },
            { $set: updateData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json(user);
    } catch (error) {
        console.error("Sync Error:", error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

app.get("/api/users/me", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        let user = await User.findOne({ clerkId: req.auth.userId });
        if (!user) {
             // Create user if not exists (first login sync)
             user = new User({ clerkId: req.auth.userId, role: 'user', courses: [] });
             await user.save();
        }
        res.json(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

app.get("/api/users/me/courses", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const user = await User.findOne({clerkId: req.auth.userId})
            .populate({
                path: 'courses',
                populate: {
                    path: 'modules',
                    populate: {
                        path: 'topics',
                        populate: {
                            path: 'problems videos'
                        }
                    }
                }
            });
        
        if (!user) {
            // if user exists in clerk but not in our db, they have no courses
            return res.json([]);
        }

        if (user.role === 'admin') {
            const allCourses = await Course.find()
                .populate({
                    path: 'modules',
                    populate: {
                        path: 'topics',
                        populate: {
                            path: 'problems videos'
                        }
                    }
                });
            return res.json(allCourses);
        }

        res.json(user.courses);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get user stats (Admin or Self)
app.get("/api/users/:clerkId/stats", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        // Check access: Admin or same user
        if (req.auth.userId !== req.params.clerkId) {
             const requester = await User.findOne({ clerkId: req.auth.userId });
             if (!requester || requester.role !== 'admin') {
                 return res.status(403).json({ msg: 'Access denied' });
             }
        }

        const user = await User.findOne({ clerkId: req.params.clerkId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const submissions = await Submission.find({ user: user._id }).populate('problem');
        
        // Calculate stats
        const totalSubmissions = submissions.length;
        const uniqueProblems = new Set(submissions.map(s => s.problem?.toString()));
        const solvedProblems = new Set(submissions.filter(s => s.verdict === 'Accepted').map(s => s.problem?.toString()));
        
        const verdicts = {};
        submissions.forEach(s => {
            verdicts[s.verdict] = (verdicts[s.verdict] || 0) + 1;
        });
        
        const verdictStats = Object.keys(verdicts).map(k => ({ name: k, value: verdicts[k] }));

        res.json({
            totalSubmissions,
            problemsAttempted: uniqueProblems.size,
            problemsSolved: solvedProblems.size,
            verdicts: verdictStats,
            lastSubmitted: submissions.length > 0 ? submissions[0].submittedAt : null,
            recentSubmissions: submissions.slice(0, 5).map(s => ({
                problemTitle: s.problem?.title || 'Unknown Problem',
                verdict: s.verdict,
                submittedAt: s.submittedAt
            }))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// --- ADMIN USER MANAGEMENT ROUTES ---

// Get all users (Admin)
app.get("/api/admin/users", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ role: 1, name: 1 }); // Sort by role (admin first?) or just name
        res.json(users);
    } catch (error) {
        console.error("[Admin Users Error]", error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Update user role (Admin)
app.put("/api/admin/users/:clerkId/role", ClerkExpressRequireAuth(), requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ msg: 'Invalid role' });
        }

        const user = await User.findOneAndUpdate(
            { clerkId: req.params.clerkId },
            { role },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get my submissions
app.get("/api/my-submissions", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { problemId } = req.query;
        const user = await User.findOne({ clerkId: req.auth.userId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const filter = { user: user._id };
        
        if (problemId) {
            const problem = await Problem.findOne({ id: problemId });
            if (problem) {
                filter.problem = problem._id;
            }
        }

        const submissions = await Submission.find(filter)
            .sort({ submittedAt: -1 })
            .populate('problem', 'title id difficulty')
            .limit(50);

        res.json(submissions);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// --- CODE EXECUTION ROUTES ---

// Startup Check: Ensure g++ is available
exec('g++ --version', (error, stdout, stderr) => {
    if (error) {
        console.warn("⚠️  WARNING: g++ is not installed or not in PATH. Code execution will fail.");
    }
});

function runTestCase(execPath, input, timeLimit = 1000) {
  return new Promise((resolve, reject) => {

    const timeLimitSeconds = Math.max(1, Math.ceil(timeLimit / 1000));
    const memoryLimitMB = 128; // You can make this dynamic later if you add it to your problem model

    const child = spawn(
      "/bin/bash",
      ["./run_in_nsjail.sh", execPath, timeLimitSeconds.toString(), memoryLimitMB.toString()],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Time Limit Exceeded"));
    }, timeLimit + 500); // Give nsjail a buffer to enforce the limit first

    // Ensure proper input termination
    if (!input.endsWith("\n")) {
      input += "\n";
    }

    child.stdin.write(input, "utf8");
    child.stdin.end();

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      // Strip NSJail logs
      const cleanOutput = stdout
        .split("\n")
        .filter(line => !line.startsWith("["))
        .join("\n")
        .trimEnd();
      if (code !== 0) {
        console.log("Runtime Error Stderr:", stderr);   
        reject(new Error(stderr.trim() || "Runtime Error"));
      } else {
        resolve(cleanOutput);
      }
    });
  });
}


app.post("/api/submit", ClerkExpressRequireAuth(), async (req, res) => {
  const { problemId, code, mode, courseId, topicId } = req.body;
  
  if (!code) return res.status(400).json({ status: "Error", message: "No code provided" });

  let sourcePath = null;
  let execPath = null;

  try {
    // 0. Fetch User (Required for saving submission)
    let user = await User.findOne({ clerkId: req.auth.userId });
    if (!user) {
        console.warn(`[Submit] User not found in DB: ${req.auth.userId}. Auto-creating skeletal user.`);
        user = new User({ clerkId: req.auth.userId, role: 'user', courses: [] });
        await user.save();
    }

    // 0.1 Check Access
    if (!courseId) {
        console.warn("[Submit] No courseId provided in body");
        return res.status(400).json({ status: "Error", message: "Course ID required" });
    }

    let courseObj;
    try {
        courseObj = await Course.findById(courseId);
    } catch (err) {
        console.warn(`[Submit] Invalid Course ID format: ${courseId}`);
        return res.status(400).json({ status: "Error", message: "Invalid Course ID Format" });
    }

    if (!courseObj) {
        console.warn(`[Submit] Course not found for ID: ${courseId}`);
        return res.status(404).json({ status: "Error", message: `Course not found (ID: ${courseId})` });
    }
    
    const hasAccess = user.role === 'admin' || user.courses.some(c => c.toString() === courseObj._id.toString());
    if (!hasAccess) {
        console.warn(`[Submit] Access denied for user ${user.clerkId} to course ${courseId}`);
        return res.status(403).json({ status: "Error", message: "You must purchase the course to submit solutions." });
    }

    // 1. Fetch Problem
    const problemIdNum = parseInt(problemId, 10);
    
    const problem = await Problem.findOne({ id: problemIdNum });
    if (!problem) {
        console.warn(`[Submit] Problem not found in DB for ID: ${problemIdNum}`);
        return res.status(404).json({ status: "Error", message: `Problem not found (ID: ${problemId})` });
    }

    // Determine test cases based on mode ("run" = sample, default = hidden)
    const testCases = (mode === 'run') ? problem.sampleTestCases : problem.hiddenTestCases;
    
    if (!testCases || testCases.length === 0) {
        return res.json({ 
            status: "Error", 
            message: "No test cases found for this mode." 
        });
    }

    const timeLimit = problem.timeLimit || 1000;
    const uniqueId = Date.now();
    
    // Ensure temp directory exists
    const tempDir = path.resolve(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    sourcePath = path.join(tempDir, `sub_${uniqueId}.cpp`);
    execPath = path.join(tempDir, `sub_${uniqueId}`);

    // 2. Write File
    fs.writeFileSync(sourcePath, code);

    // 3. Compile
    try {
      await execPromise(`g++ "${sourcePath}" -o "${execPath}"`);
    } catch (compileError) {
      // Save Compilation Error if it's a real submission
      if (mode !== 'run') {
        await new Submission({
            user: user._id,
            problem: problem._id,
            course: courseId,
            topic: topicId,
            language: 'cpp',
            code,
            verdict: 'Compilation Error',
            errorLog: compileError.stderr || compileError.message
        }).save();
      }

      return res.json({ 
        status: "Compilation Error", 
        message: compileError.stderr || compileError.message 
      });
    }

    // 4. Run Test Cases
    let allPassed = true;
    let results = [];
    let maxTime = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = Date.now();
      try {
        const userOutput = await runTestCase(execPath, tc.input || "", timeLimit);
        const endTime = Date.now();
        const duration = endTime - startTime;
        if (duration > maxTime) maxTime = duration;

        const passed = userOutput.trim() === tc.output.trim();
        
        results.push({ 
          testCase: i + 1,
          passed,
          userOutput: userOutput.trim(),
          expectedOutput: tc.output.trim(),
          input: tc.input
        });
        
        if (!passed) allPassed = false;
      } catch (e) {
        allPassed = false;
        results.push({ 
          testCase: i + 1, 
          passed: false, 
          error: e.message === "Time Limit Exceeded" ? "TLE" : "Runtime Error" 
        });
      }
    }

    const finalVerdict = allPassed ? "Accepted" : "Wrong Answer";

    // 5. Save Submission (if not just running samples)
    if (mode !== 'run') {
        const submission = new Submission({
            user: user._id,
            problem: problem._id,
            course: courseId,
            topic: topicId,
            language: 'cpp',
            code,
            verdict: finalVerdict,
            testCasesPassed: results.filter(r => r.passed).length,
            totalTestCases: testCases.length,
            timeTaken: maxTime
        });
        await submission.save();
    }

    res.json({ 
      status: finalVerdict, 
      results 
    });

  } catch (err) {
    console.error("Submit Error:", err);
    res.status(500).json({ status: "Error", message: "Internal Server Error: " + err.message });
  } finally {
    // 5. Cleanup
    if (sourcePath && fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
    if (execPath && fs.existsSync(execPath)) fs.unlinkSync(execPath);
  }
});


app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;

    if (!name || !email || !message) {
      return res.status(400).json({ msg: "Please fill out all fields." });
    }

    if (!sendgridApiKey || sendgridApiKey.includes('YOUR_')) {
      console.error("FATAL: SendGrid API Key is not configured. Go to server/.env and add your key.");
      return res.status(500).json({
        msg: "Email service is not configured correctly. Please contact the site administrator.",
      });
    }

    const emailData = {
      personalizations: [{
        to: [{ email: "tharkaschool@gmail.com" }],
        subject: `New Message from ${name} via Contact Form`,
      }],
      from: { email: "no-reply@tharkaschool.com", name: "TharkaSchool Contact Form" },
      reply_to: { email: email, name: name },
      content: [{
        type: "text/plain",
        value: `You have received a new message from:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\n\nMessage:\n${message}`,
      }, {
        type: "text/html",
        value: `<p>You have a new message from:</p><ul><li><b>Name:</b> ${name}</li><li><b>Email:</b> ${email}</li><li><b>Phone:</b> ${phone || 'Not provided'}</li></ul><p><b>Message:</b></p><p>${message.replace(/\n/g, "<br>")}</p>`,
      }],
    };

    const postData = JSON.stringify(emailData);

    const options = {
      hostname: "api.sendgrid.com",
      port: 443,
      path: "/v3/mail/send",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => (responseBody += chunk));
      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          console.log("Email sent successfully via SendGrid.");
          res.json({ msg: "Your message has been sent successfully!" });
        } else {
          console.error("SendGrid Error:", response.statusCode, responseBody);
          res.status(response.statusCode).json({ msg: "Failed to send email.", detail: responseBody });
        }
      });
    });

    request.on("error", (error) => {
      console.error("HTTPS Request Error:", error);
      res.status(500).json({ msg: "Server error: could not send email.", detail: error.message });
    });

    request.write(postData);
    request.end();

  } catch (error) {
    console.error("Contact Form Error:", error);
    res.status(500).json({ msg: "An unexpected error occurred.", detail: error.message });
  }
});

// 404 Handler for API
app.use("/api/*", (req, res) => {
    res.status(404).json({ msg: `API Route not found: ${req.originalUrl}` });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
