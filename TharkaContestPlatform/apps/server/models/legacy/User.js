const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String }, // User's email from Clerk
  name: { type: String },  // User's full name from Clerk
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;
