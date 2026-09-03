const mongoose = require('mongoose');

const courseAccessSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    firstAccessedAt: {
        type: Date,
    },
});

// Ensure a user can only have one access record per course
courseAccessSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('CourseAccess', courseAccessSchema);
