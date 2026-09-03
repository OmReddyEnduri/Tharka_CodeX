const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: { type: String, required: true },
  courseId: { type: String, required: true, ref: 'Course' },
  problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ContestProblem' }],
  problemIds: [{ type: Number }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  description: { type: String },
});

module.exports = mongoose.model('Contest', contestSchema);
