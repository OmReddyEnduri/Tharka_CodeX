const express = require("express");
const router = express.Router();

const Contest = require("../models/Contest");
const ContestSubmission = require("../models/ContestSubmission");
const SyncState = require("../models/SyncState");
const { broadcastSync, getConnectedCount } = require("../sockets/syncSocket");
const { computeLeaderboard } = require("../lib/leaderboard");

async function getOrCreateSyncState() {
  let state = await SyncState.findById("global");
  if (!state) state = await SyncState.create({ _id: "global", version: 0 });
  return state;
}

// @route   GET /api/sync/version
router.get("/version", async (req, res) => {
  const state = await getOrCreateSyncState();
  res.json({ version: state.version, lastSyncedAt: state.lastSyncedAt, connectedClients: getConnectedCount() });
});

// @route   GET /api/sync/full
// @desc    Full snapshot of all contests + problems + each contest's current
// leaderboard. No pagination - the dataset is lab-scale, so a full replace
// on the client is simple and robust. Leaderboard is embedded here (not a
// separate live-only endpoint) so it's still viewable offline after a sync,
// same as problems/testcases - it just only ever updates when the admin
// presses Sync, not continuously.
router.get("/full", async (req, res) => {
  const state = await getOrCreateSyncState();
  const contests = await Contest.find().populate("problems").sort({ startTime: 1 });

  const contestsWithResults = await Promise.all(
    contests.map(async (contest) => {
      const submissions = await ContestSubmission.find({ contest: contest._id }).sort({ submittedAt: "asc" });
      const results = computeLeaderboard(contest, submissions);
      return { ...contest.toObject(), results };
    })
  );

  res.json({ version: state.version, contests: contestsWithResults });
});

// @route   POST /api/sync/trigger
// @desc    Admin presses "Sync" -> bump version, push to all connected clients.
router.post("/trigger", async (req, res) => {
  const state = await getOrCreateSyncState();
  state.version += 1;
  state.lastSyncedAt = new Date();
  await state.save();

  broadcastSync(state.version);

  res.json({ version: state.version, lastSyncedAt: state.lastSyncedAt, notifiedClients: getConnectedCount() });
});

module.exports = router;
