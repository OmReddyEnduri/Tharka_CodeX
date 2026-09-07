const mongoose = require("mongoose");
const { DEFAULT_BLOCKED_KEYWORDS } = require("judge-cpp/staticCheck");

// Global judge-engine configuration - platform-wide, not per-contest, since
// these govern the judge engine itself (what code gets rejected, how long
// compilation/output/interactive sessions are allowed to run), not contest
// content. A singleton document (_id: "global"), same pattern as SyncState.
// Read by the server's own submit/compile routes and (via GET /api/sync/full
// -> db.js -> main.js) by the Electron client's local judge, so an admin
// change here reaches every lab PC on the next sync with no code change.
const judgeSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: "global" },
  blockedKeywords: { type: [String], default: DEFAULT_BLOCKED_KEYWORDS },
  compileTimeoutMs: { type: Number, default: 10000 },
  maxOutputBytes: { type: Number, default: 1 * 1024 * 1024 },
  interactiveSessionMaxMs: { type: Number, default: 5 * 60 * 1000 },
}, { timestamps: true });

module.exports = mongoose.model("JudgeSettings", judgeSettingsSchema);
