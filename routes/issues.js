// routes/issues.js
// Updated: issues are scoped to a team
// Assign only allows developers who are members of the same team

const express   = require('express');
const Issue     = require('../models/Issue');
const Project   = require('../models/Project');
const Team      = require('../models/Team');
const User      = require('../models/User');
const appConfig = require('../config/appConfig');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: check if user is member of a team
async function isTeamMember(teamId, userId) {
  const team = await Team.findById(teamId);
  if (!team) return false;
  return team.members.some(m => m.user.toString() === userId);
}

// POST /api/issues — tester only
router.post('/', authMiddleware, requireRole('tester'), async (req, res) => {
  try {
    const { title, description, stepsToReproduce, project: projectId } = req.body;
    if (!title || !description || !projectId) {
      return res.status(400).json({ message: 'Title, description, and project are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Tester must be a member of the project's team
    const member = await isTeamMember(project.team, req.user.id);
    if (!member) return res.status(403).json({ message: 'You are not a member of this project\'s team' });

    const issue = new Issue({
      title, description, stepsToReproduce,
      project: projectId,
      team:    project.team,
      reportedBy: req.user.id,
    });
    await issue.save();
    await issue.populate([
      { path: 'reportedBy', select: 'name email role' },
      { path: 'project',    select: 'name' },
      { path: 'team',       select: 'name' },
    ]);
    res.status(201).json({ issue });
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ message: 'Server error creating issue' });
  }
});

// GET /api/issues — role-based + team-scoped + pagination + search
router.get('/', authMiddleware, async (req, res) => {
  try {
    const baseQuery = {};

    if (req.user.role === 'tester') {
      baseQuery.reportedBy = req.user.id;
    } else if (req.user.role === 'developer') {
      baseQuery.assignedTo = req.user.id;
    } else if (req.user.role === 'manager') {
      // Manager sees issues only in teams they manage
      const managedTeams = await Team.find({ createdBy: req.user.id }).select('_id');
      baseQuery.team = { $in: managedTeams.map(t => t._id) };
    }

    const { search, page, limit: limitParam, teamId } = req.query;

    // Optional team filter
    if (teamId) baseQuery.team = teamId;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      baseQuery.$or = [{ title: regex }, { description: regex }];
    }

    const { defaultPage, defaultLimit, maxLimit } = appConfig.pagination;
    const currentPage  = Math.max(1, parseInt(page, 10) || defaultPage);
    const currentLimit = Math.min(maxLimit, Math.max(1, parseInt(limitParam, 10) || defaultLimit));
    const skip         = (currentPage - 1) * currentLimit;

    const [issues, total] = await Promise.all([
      Issue.find(baseQuery)
        .populate('reportedBy', 'name email role')
        .populate('assignedTo', 'name email role')
        .populate('project',    'name')
        .populate('team',       'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit),
      Issue.countDocuments(baseQuery),
    ]);

    res.json({
      issues,
      pagination: {
        total,
        page:       currentPage,
        limit:      currentLimit,
        totalPages: Math.ceil(total / currentLimit),
      },
    });
  } catch (err) {
    console.error('Get issues error:', err);
    res.status(500).json({ message: 'Server error fetching issues' });
  }
});

// GET /api/issues/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project',    'name description')
      .populate('team',       'name');

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

// PATCH /api/issues/:id/assign — manager only, developer must be in same team
router.patch('/:id/assign', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (assignedTo) {
      const dev = await User.findById(assignedTo);
      if (!dev || dev.role !== 'developer') {
        return res.status(400).json({ message: 'Assigned user must be a developer' });
      }
      // Developer must be in the same team as the issue
      const inTeam = await isTeamMember(issue.team, assignedTo);
      if (!inTeam) {
        return res.status(400).json({ message: 'Developer must be a member of this issue\'s team' });
      }
    }

    const updated = await Issue.findByIdAndUpdate(
      req.params.id,
      { assignedTo: assignedTo || null, updatedAt: Date.now() },
      { new: true }
    )
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project',    'name')
      .populate('team',       'name');

    res.json({ issue: updated });
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
      { path: 'project',    select: 'name' },
      { path: 'team',       select: 'name' },
    ]);

    res.json({ issue });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error updating status' });
  }
});

module.exports = router;
