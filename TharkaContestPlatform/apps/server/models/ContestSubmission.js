const mongoose = require('mongoose');

const contestSubmissionSchema = new mongoose.Schema({
  contest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true
  },
  contestProblemId: { // Refers to the 'id' field (Number) in ContestProblem model
    type: Number,
    required: true
  },

  // Identification (no auth) - captured at contest join, attached to every submission
  studentName: { type: String, required: true },
  studentRollNumber: { type: String, required: true },

  // Client-generated UUID. Makes the client->server results push idempotent on retry.
  localId: { type: String, required: true, unique: true },

  language: {
    type: String,
    required: true,
    default: 'cpp'
  },
  code: {
    type: String,
    required: true
  },

  verdict: {
    type: String,
    enum: ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Compilation Error', 'Runtime Error', 'Memory Limit Exceeded', 'Output Limit Exceeded', 'Pending'],
    default: 'Pending'
  },
  testCasesPassed: {
    type: Number,
    default: 0
  },
  totalTestCases: {
    type: Number,
    default: 0
  },
  timeTaken: {
    type: Number, // Execution time in milliseconds
    default: 0
  },
  memoryUsed: {
    type: Number, // Memory usage in KB
    default: 0
  },

  errorLog: {
    type: String // To store compiler errors or runtime stack traces
  },

  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

contestSubmissionSchema.index({ contest: 1, studentRollNumber: 1 });
contestSubmissionSchema.index({ contest: 1, contestProblemId: 1, studentRollNumber: 1 });
contestSubmissionSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('ContestSubmission', contestSubmissionSchema);
