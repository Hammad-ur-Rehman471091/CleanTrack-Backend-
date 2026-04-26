// models/User.js
// Extracted from server.js (Phase 1 refactor)

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  // role: manager | tester | developer
  role:     { type: String, enum: ['manager', 'tester', 'developer'], required: true },
  createdAt:{ type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
