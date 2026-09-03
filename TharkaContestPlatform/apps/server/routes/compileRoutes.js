const express = require("express");
const router = express.Router();
const judge = require("judge-cpp");

// @route   POST /api/compile/run
// @desc    Freeform "online compiler" - no contest/problem context, just
// compiles and runs C++ against whatever stdin the user typed in.
router.post("/run", async (req, res) => {
  const { code, input } = req.body;
  if (!code) return res.status(400).json({ status: "Error", message: "No code provided" });

  try {
    const result = await judge.runOnce({ sourceCode: code, input: input || "" });
    res.json(result);
  } catch (err) {
    console.error("Compiler run error:", err);
    res.status(500).json({ status: "Error", message: "Internal Server Error: " + err.message });
  }
});

module.exports = router;
