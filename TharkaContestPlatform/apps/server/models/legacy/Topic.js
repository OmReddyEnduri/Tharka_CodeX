const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Custom ID (e.g., "vars-datatypes")
  title: { type: String, required: true },
  description: { type: String, default: "" },
  problemIds: [{ type: Number }], // Array of Problem custom IDs (Numbers)
  problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
  courseModule: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseModule' }
});

module.exports = mongoose.model('Topic', topicSchema);