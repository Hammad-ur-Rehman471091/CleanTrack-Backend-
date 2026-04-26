// routes/issues.js
// Extracted from server.js (Phase 1 refactor)
// Handles: POST, GET /api/issues, GET /api/issues/:id,
//          PATCH /api/issues/:id/assign, PATCH /api/issues/:id/status

const express = require('express');
const Issue   = require('../models/Issue');
const Project = require('../models/Project');
const User    = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/issues — tester only
router.post('/', authMiddleware, requireRole('tester'), async (req, res) => {
  try {
    const { title, description, stepsToReproduce, project } = req.body;

    if (!title || !description || !project) {
      return res.status(400).json({ message: 'Title, description, and project are required' });
    }

    const projectExists = await Project.findById(project);
    if (!projectExists) return res.status(404).json({ message: 'Project not found' });

    const issue = new Issue({
      title,
      description,
      stepsToReproduce,
      project,
      reportedBy: req.user.id
    });
    await issue.save();
    await issue.populate([
      { path: 'reportedBy', select: 'name email role' },
      { path: 'project',    select: 'name' }
    ]);

    res.status(201).json({ issue });
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ message: 'Server error creating issue' });
  }
});

// GET /api/issues — role-based filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'tester')    query.reportedBy = req.user.id;
    if (req.user.role === 'developer') query.assignedTo = req.user.id;
    // manager: no filter — sees everything

    const issues = await Issue.find(query)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project',    'name')
      .sort({ createdAt: -1 });

    res.json({ issues });
  } catch (err) {
    console.error('Get issues error:', err);
    res.status(500).json({ message: 'Server error fetching issues' });
  }
});

// GET /api/issues/:id — single issue with role access check
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project',    'name description');

    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (req.user.role === 'tester' && issue.reportedBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'developer' && (!issue.assignedTo || issue.assignedTo._id.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ issue });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/issues/:id/assign — manager only
router.patch('/:id/assign', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const { assignedTo } = req.body;

    if (assignedTo) {
      const dev = await User.findById(assignedTo);
      if (!dev || dev.role !== 'developer') {
        return res.status(400).json({ message: 'Assigned user must be a developer' });
      }
    }

    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { assignedTo: assignedTo || null, updatedAt: Date.now() },
      { new: true }
    )
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project',    'name');

    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    res.json({ issue });
  } catch (err) {
    console.error('Assign issue error:', err);
    res.status(500).json({ message: 'Server error assigning issue' });
  }
});

// PATCH /api/issues/:id/status — developer only
router.patch('/:id/status', authMiddleware, requireRole('developer'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (!issue.assignedTo || issue.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update issues assigned to you' });
    }

    issue.status = status;
    await issue.save();
    await issue.populate([
      { path: 'reportedBy', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
      { path: 'project',    select: 'name' }
    ]);

    res.json({ issue });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error updating status' });
  }
});

module.exports = router;
