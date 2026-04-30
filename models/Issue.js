// models/Issue.js
// Updated: issues are scoped to a team

const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  title:            { type: String, required: true, trim: true },
  description:      { type: String, required: true, trim: true },
  stepsToReproduce: { type: String, trim: true },
  status: {
    type:    String,
    enum:    ['open', 'in_progress', 'resolved'],
    default: 'open'
  },
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team',    required: true },
  project:    { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    default: null },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

issueSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Issue', issueSchema);
