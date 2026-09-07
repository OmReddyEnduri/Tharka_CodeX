const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: { type: String, required: true },
  problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ContestProblem' }],
  problemIds: [{ type: Number }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  description: { type: String },
  // Disqualified-but-not-deleted: their submissions stay in the DB (for
  // audit) but the leaderboard route sorts them to the bottom and flags
  // them, rather than counting their score. Keyed by roll number since
  // that's the per-contest identity (see the no-auth decision in CLAUDE.md).
  disqualifiedStudents: [{
    studentRollNumber: { type: String, required: true },
    studentName: { type: String },
    disqualifiedAt: { type: Date, default: Date.now },
    reason: { type: String },
  }],
  // Recorded the moment a student types name+roll on the Join screen (still
  // no password - see the no-auth decision in CLAUDE.md), independent of
  // whether they ever submit anything. Lets the admin see who's actually in
  // a contest, live, instead of only finding out once a submission lands.
  // computeLeaderboard() seeds a zero-score row per participant so they show
  // up on the leaderboard immediately after joining.
  participants: [{
    studentRollNumber: { type: String, required: true },
    studentName: { type: String },
    joinedAt: { type: Date, default: Date.now },
  }],
  // Admin-controlled, per-contest toggles read by both the server's own
  // judging/fetch routes and (once synced down via /api/sync/full) by the
  // Electron client's local judge - so a behavior change here reaches every
  // lab PC on the next sync, with no client code changes required. See
  // CLAUDE.md and stripHiddenTestCaseIO()/submit route in contestRoutes.js.
  settings: {
    hideHiddenTestCasesWhileLive: { type: Boolean, default: true },
  },
}, { timestamps: true });

module.exports = mongoose.model('Contest', contestSchema);
