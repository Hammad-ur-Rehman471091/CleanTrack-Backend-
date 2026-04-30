// models/Team.js
// A Team is created by a manager and has a unique join code.
// Testers and developers join a team using that code.
// Projects are scoped to a team — only team members can see/report on them.

const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  joinCode:    { type: String, required: true, unique: true, trim: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', teamSchema);
