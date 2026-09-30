require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { extractProblem } = require("./lib/ai");
const contestApi = require("./lib/contestApi");
const cfApi = require("./lib/cfApi");

function extractContestRef(block) {
  const m = block.match(/codeforces\.com\/(?:problemset\/problem|contest\/(\d+)\/problem|gym\/(\d+)\/problem)\/(\d+)?\/?([A-Za-z0-9]+)/i);
  if (!m) return null;
  const contestId = m[1] || m[2] || m[3];
  const index = m[4];
  if (!contestId || !index) return null;
  return { contestId: Number(contestId), index: index.toUpperCase() };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

function assembleProblem(ai) {
  const difficulty = ["Easy", "Medium", "Hard"].includes(ai?.difficulty) ? ai.difficulty : "Medium";
  return {
    title: ai?.title || "Untitled problem",
    description: ai?.description || "",
    category: ai?.category || "General",
    difficulty,
    constraints: ai?.constraints || "",
    inputFormat: ai?.inputFormat || "Standard Input",
    outputFormat: ai?.outputFormat || "Standard Output",
    timeLimit: Number.isFinite(ai?.timeLimitMs) ? ai.timeLimitMs : 1000,
    memoryLimit: Number.isFinite(ai?.memoryLimitMb) ? ai.memoryLimitMb : 256,
    sampleTestCases: Array.isArray(ai?.sampleTestCases) ? ai.sampleTestCases : [],
    hiddenTestCases: Array.isArray(ai?.hiddenTestCases) ? ai.hiddenTestCases : [],
  };
}

// AI-extract one or more pasted Codeforces problem statements in one call.
app.post("/api/convert", async (req, res) => {
  const { blocks, provider, apiKey, baseUrl, model, generateHidden } = req.body || {};
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return res.status(400).json({ msg: "blocks must be a non-empty array of pasted problem statements" });
  }
  if (!provider || !apiKey || !model) {
    return res.status(400).json({ msg: "provider, apiKey, and model are required" });
  }

  const results = [];
  for (const block of blocks) {
    const label = block.trim().slice(0, 60).replace(/\s+/g, " ") || "(empty)";
    const cfRef = extractContestRef(block);
    const meta = cfRef ? await cfApi.lookupMeta(cfRef.contestId, cfRef.index) : null;
    try {
      const ai = await extractProblem({ provider, apiKey, baseUrl, model }, block, !!generateHidden, meta);
      results.push({ ref: label, ok: true, problem: assembleProblem(ai) });
    } catch (err) {
      results.push({ ref: label, ok: false, error: `AI step failed: ${err.message}` });
    }
  }

  res.json({ results });
});

app.get("/api/contests", async (_req, res) => {
  try {
    const contests = await contestApi.listContests();
    res.json(contests);
  } catch (err) {
    res.status(502).json({ msg: `Could not reach contest platform server: ${err.message}` });
  }
});

app.post("/api/send-to-contest", async (req, res) => {
  const { contestId, problems } = req.body || {};
  if (!contestId || !Array.isArray(problems) || problems.length === 0) {
    return res.status(400).json({ msg: "contestId and a non-empty problems array are required" });
  }
  try {
    const result = await contestApi.bulkAddProblems(contestId, problems);
    res.json(result);
  } catch (err) {
    res.status(502).json({ msg: `Could not send to contest platform server: ${err.message}` });
  }
});

const PORT = process.env.PORT || 5200;
app.listen(PORT, () => {
  console.log(`CF Importer running on http://localhost:${PORT}`);
});
