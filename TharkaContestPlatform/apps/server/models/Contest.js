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
  }],
}, { timestamps: true });

module.exports = mongoose.model('Contest', contestSchema);
