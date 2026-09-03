const mongoose = require('mongoose');

const courseModuleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Custom ID (e.g., "basic-syntax")
  title: { type: String, required: true },
  description: { type: String },
  topicIds: [{ type: String }], // Array of Topic custom IDs
  topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
});

module.exports = mongoose.model('CourseModule', courseModuleSchema);
