// routes/dashboard.js
// Extracted from server.js (Phase 1 refactor)
// Handles: GET /api/dashboard/stats

const express = require('express');
const Issue   = require('../models/Issue');
const Project = require('../models/Project');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats — role-based summary counts
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    let stats = {};

    if (req.user.role === 'manager') {
      const totalIssues      = await Issue.countDocuments();
      const openIssues       = await Issue.countDocuments({ status: 'open' });
      const inProgressIssues = await Issue.countDocuments({ status: 'in_progress' });
      const resolvedIssues   = await Issue.countDocuments({ status: 'resolved' });
      const totalProjects    = await Project.countDocuments();
      const unassigned       = await Issue.countDocuments({ assignedTo: null });
      stats = { totalIssues, openIssues, inProgressIssues, resolvedIssues, totalProjects, unassigned };

    } else if (req.user.role === 'tester') {
      const myIssues   = await Issue.countDocuments({ reportedBy: req.user.id });
      const openIssues = await Issue.countDocuments({ reportedBy: req.user.id, status: 'open' });
      const inProgress = await Issue.countDocuments({ reportedBy: req.user.id, status: 'in_progress' });
      const resolved   = await Issue.countDocuments({ reportedBy: req.user.id, status: 'resolved' });
      stats = { myIssues, openIssues, inProgress, resolved };

    } else if (req.user.role === 'developer') {
      const assigned   = await Issue.countDocuments({ assignedTo: req.user.id });
      const open       = await Issue.countDocuments({ assignedTo: req.user.id, status: 'open' });
      const inProgress = await Issue.countDocuments({ assignedTo: req.user.id, status: 'in_progress' });
      const resolved   = await Issue.countDocuments({ assignedTo: req.user.id, status: 'resolved' });
      stats = { assigned, open, inProgress, resolved };
    }

    res.json({ stats });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
