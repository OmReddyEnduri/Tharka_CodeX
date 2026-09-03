const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: false, default: "" },
  output: { type: String, required: true }
});

const problemSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true }, // Custom ID (e.g., 201) - Number for LeetCode style IDs
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: "General" },
  difficulty: { type: String, required: true },
  constraints: { type: String, required: false },
  inputFormat: { type: String, default: "Standard Input" },
  outputFormat: { type: String, default: "Standard Output" },
  timeLimit: { type: Number, required: true, default: 1000 },
  memoryLimit: { type: Number, required: true, default: 256 },
  sampleTestCases: [testCaseSchema],
  hiddenTestCases: [testCaseSchema],
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }
});

module.exports = mongoose.model('Problem', problemSchema);
