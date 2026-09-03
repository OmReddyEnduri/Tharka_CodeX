const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  problem: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Problem', 
    required: true 
  },
  
  // Contextual information: Where was this problem solved?
  course: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Course',
    required: false // Optional because a problem might be solved outside a course
  },
  courseModule: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CourseModule',
    required: false
  },
  topic: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Topic',
    required: false
  },

  // The actual submission content
  language: { 
    type: String, 
    required: true, 
    default: 'cpp' 
  },
  code: { 
    type: String, 
    required: true 
  },
  
  // Performance and Result
  verdict: { 
    type: String, 
    enum: ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Compilation Error', 'Runtime Error', 'Memory Limit Exceeded', 'Pending'],
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
});

// Indexing for faster lookups (e.g., finding all submissions by a user for a specific problem)
submissionSchema.index({ user: 1, problem: 1 });
submissionSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);
