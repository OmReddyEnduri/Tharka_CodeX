const express = require("express");
const router = express.Router();

const Contest = require("../models/Contest");
const ContestSubmission = require("../models/ContestSubmission");
const SyncState = require("../models/SyncState");
const { broadcastSync, getConnectedCount } = require("../sockets/syncSocket");
const { computeLeaderboard } = require("../lib/leaderboard");
const { getJudgeSettings } = require("../lib/judgeSettings");
const { requireAdmin } = require("../lib/adminAuth");
const { requireSyncDevice } = require("../lib/syncAuth");

// Atomic upsert, not find-then-create - see lib/judgeSettings.js's
// getJudgeSettings() for why: two requests racing before this doc exists
// would otherwise both see null and both try to create it, and the loser
// throws a duplicate-key error. This one is hit even harder than
// judgeSettings - GET /api/sync/version is polled continuously by every
// connected Electron client.
async function getOrCreateSyncState() {
  return SyncState.findOneAndUpdate(
    { _id: "global" },
    { $setOnInsert: { version: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// @route   GET /api/sync/version
// `serverTime` lets clients (the Electron app, specifically) detect their
// own clock being wrong or deliberately tampered with, rather than trusting
// a student laptop's local clock for anything contest-integrity-sensitive
// (e.g. whether hidden testcase I/O should still be redacted) - see
// client-electron/main.js's getAuthoritativeNow().
router.get("/version", async (req, res) => {
  try {
    const state = await getOrCreateSyncState();
    res.json({
      version: state.version,
      lastSyncedAt: state.lastSyncedAt,
      connectedClients: getConnectedCount(),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get sync version error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   GET /api/sync/full
// @desc    Full snapshot of all contests + problems + each contest's current
// leaderboard. No pagination - the dataset is lab-scale, so a full replace
// on the client is simple and robust. Leaderboard is embedded here (not a
// separate live-only endpoint) so it's still viewable offline after a sync,
// same as problems/testcases - it just only ever updates when the admin
// presses Sync, not continuously.
//
// This deliberately returns hidden test cases UNREDACTED - Electron's local
// judge needs the real values to judge offline (see client-electron/main.js,
// which runs the same judge module straight off this synced copy). That's
// exactly why this route requires the separate sync-device token (see
// lib/syncAuth.js) instead of the per-route redaction the rest of the API
// uses: redacting here would silently break local judging during a live
// contest, which is the one time it matters most.
router.get("/full", requireSyncDevice, async (req, res) => {
  try {
    const state = await getOrCreateSyncState();
    // Private contests (admin-site only) are never mirrored to lab laptops - their
    // leaderboards, problems and hidden testcases stay on this server.
    const contests = await Contest.find({ isPrivate: { $ne: true } }).populate("problems").sort({ startTime: 1 });

    const contestsWithResults = await Promise.all(
      contests.map(async (contest) => {
        const submissions = await ContestSubmission.find({ contest: contest._id }).sort({ submittedAt: "asc" });
        const results = computeLeaderboard(contest, submissions);
        return { ...contest.toObject(), results };
      })
    );

    // judgeSettings rides along in the same snapshot so an admin's change to
    // the blocklist/limits (see models/JudgeSettings.js) reaches every lab
    // PC's local judge on the next sync, with no separate endpoint the
    // Electron client needs to poll.
    const judgeSettings = await getJudgeSettings();

    res.json({ version: state.version, contests: contestsWithResults, judgeSettings });
  } catch (error) {
    console.error("Get full sync snapshot error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route   POST /api/sync/trigger
// @desc    Admin presses "Sync" -> bump version, push to all connected clients.
router.post("/trigger", requireAdmin, async (req, res) => {
  try {
    const state = await getOrCreateSyncState();
    state.version += 1;
    state.lastSyncedAt = new Date();
    await state.save();

    broadcastSync(state.version);

    res.json({ version: state.version, lastSyncedAt: state.lastSyncedAt, notifiedClients: getConnectedCount() });
  } catch (error) {
    console.error("Trigger sync error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
