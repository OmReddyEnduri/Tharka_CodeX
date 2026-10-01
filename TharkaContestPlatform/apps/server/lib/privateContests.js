const Contest = require("../models/Contest");
const SyncState = require("../models/SyncState");
const { isAdminRequest } = require("./adminAuth");
const { broadcastSync } = require("../sockets/syncSocket");

// A "private" contest (contest.isPrivate) exists only for the admin site. To
// every other device - student browsers and the Electron lab clients - it
// must not exist at all: not in the list, not fetchable by id, no
// leaderboard, no problems/testcases, no joining or submitting, and not in
// the sync snapshot the Electron clients mirror locally. Leaderboards and
// answer keys for these contests stay on the server machine.
//
// Non-admin requests get the same 404 an unknown id gets, so the response
// never even confirms that a private contest exists.

// True when this request may see/use the contest.
function canAccessContest(contest, req) {
  return !contest.isPrivate || isAdminRequest(req);
}

// Mongo filter for list queries: admins see everything, everyone else only
// non-private contests. ($ne: true also matches old contests that have no
// isPrivate field at all.)
function visibleContestFilter(req) {
  return isAdminRequest(req) ? {} : { isPrivate: { $ne: true } };
}

// A problem id belongs to exactly one contest, but the problem routes look a
// problem up by id alone. Without this, a student could request a private
// contest's problem (or submit to it) through a PUBLIC contest's URL. True if
// the problem is part of some private contest other than `exceptContestId`.
async function isProblemInOtherPrivateContest(problemId, exceptContestId) {
  const n = Number(problemId);
  if (!Number.isFinite(n)) return false;
  return !!(await Contest.exists({ isPrivate: true, problemIds: n, _id: { $ne: exceptContestId } }));
}

// Making a contest private (or public again) changes what the lab laptops
// should hold, so bump the sync version and push it: every connected client
// re-pulls right away and a newly-private contest vanishes from them instead
// of lingering until the admin remembers to press Sync.
async function bumpSyncVersion() {
  const state = await SyncState.findOneAndUpdate(
    { _id: "global" },
    { $inc: { version: 1 }, $set: { lastSyncedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  broadcastSync(state.version);
}

module.exports = { canAccessContest, visibleContestFilter, isProblemInOtherPrivateContest, bumpSyncVersion };
