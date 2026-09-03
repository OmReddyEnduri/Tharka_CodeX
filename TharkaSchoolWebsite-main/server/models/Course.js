const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Custom ID (e.g., "1")
  name: { type: String, required: true },
  provider: { type: String, required: true },
  description: [{ type: String }],
  moduleIds: [{ type: String }], // Array of CourseModule custom IDs
  modules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CourseModule' }]
});

module.exports = mongoose.model('Course', courseSchema);
