const express = require("express");
const router = express.Router();

const SyncState = require("../models/SyncState");
const { DEFAULT_BLOCKED_KEYWORDS } = require("judge-cpp/staticCheck");
const { getJudgeSettings } = require("../lib/judgeSettings");
const { broadcastSync } = require("../sockets/syncSocket");

// @route   GET /api/judge-settings
router.get("/", async (req, res) => {
  const settings = await getJudgeSettings();
  res.json({ ...settings.toObject(), defaultBlockedKeywords: DEFAULT_BLOCKED_KEYWORDS });
});

// @route   PUT /api/judge-settings
// @desc    Admin-editable judge engine config (blocklist, compile timeout,
// output cap, interactive session cap) - see models/JudgeSettings.js. Bumps
// the shared sync version so every connected Electron client (whose local
// judge reads these same settings out of its own synced copy) picks up the
// change immediately, exactly like an admin-triggered contest sync.
router.put("/", async (req, res) => {
  try {
    const { blockedKeywords, compileTimeoutMs, maxOutputBytes, interactiveSessionMaxMs } = req.body;
    const settings = await getJudgeSettings();

    if (Array.isArray(blockedKeywords)) {
      settings.blockedKeywords = blockedKeywords.map((k) => String(k).trim()).filter(Boolean);
    }
    if (typeof compileTimeoutMs === "number" && compileTimeoutMs > 0) settings.compileTimeoutMs = compileTimeoutMs;
    if (typeof maxOutputBytes === "number" && maxOutputBytes > 0) settings.maxOutputBytes = maxOutputBytes;
    if (typeof interactiveSessionMaxMs === "number" && interactiveSessionMaxMs > 0) {
      settings.interactiveSessionMaxMs = interactiveSessionMaxMs;
    }

    await settings.save();

    const state = await SyncState.findByIdAndUpdate(
      "global",
      { $inc: { version: 1 }, lastSyncedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    broadcastSync(state.version);

    res.json({ ...settings.toObject(), defaultBlockedKeywords: DEFAULT_BLOCKED_KEYWORDS });
  } catch (error) {
    console.error("Update judge settings error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
