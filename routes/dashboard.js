// routes/dashboard.js
// Updated: stats are now scoped to the user's teams

const express = require('express');
const Issue   = require('../models/Issue');
const Project = require('../models/Project');
const Team    = require('../models/Team');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    let stats = {};

    if (req.user.role === 'manager') {
      const myTeams      = await Team.find({ createdBy: req.user.id }).select('_id');
      const teamIds      = myTeams.map(t => t._id);
      const totalIssues      = await Issue.countDocuments({ team: { $in: teamIds } });
      const openIssues       = await Issue.countDocuments({ team: { $in: teamIds }, status: 'open' });
      const inProgressIssues = await Issue.countDocuments({ team: { $in: teamIds }, status: 'in_progress' });
      const resolvedIssues   = await Issue.countDocuments({ team: { $in: teamIds }, status: 'resolved' });
      const totalProjects    = await Project.countDocuments({ team: { $in: teamIds } });
      const unassigned       = await Issue.countDocuments({ team: { $in: teamIds }, assignedTo: null });
      const totalTeams       = myTeams.length;
      stats = { totalTeams, totalProjects, totalIssues, openIssues, inProgressIssues, resolvedIssues, unassigned };

    } else if (req.user.role === 'tester') {
      const myIssues   = await Issue.countDocuments({ reportedBy: req.user.id });
      const openIssues = await Issue.countDocuments({ reportedBy: req.user.id, status: 'open' });
      const inProgress = await Issue.countDocuments({ reportedBy: req.user.id, status: 'in_progress' });
      const resolved   = await Issue.countDocuments({ reportedBy: req.user.id, status: 'resolved' });
      const myTeams    = req.user.teams?.length || 0;
      stats = { myTeams, myIssues, openIssues, inProgress, resolved };

    } else if (req.user.role === 'developer') {
      const assigned   = await Issue.countDocuments({ assignedTo: req.user.id });
      const open       = await Issue.countDocuments({ assignedTo: req.user.id, status: 'open' });
      const inProgress = await Issue.countDocuments({ assignedTo: req.user.id, status: 'in_progress' });
      const resolved   = await Issue.countDocuments({ assignedTo: req.user.id, status: 'resolved' });
      const myTeams    = req.user.teams?.length || 0;
      stats = { myTeams, assigned, open, inProgress, resolved };
    }

    res.json({ stats });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
