// routes/projects.js
// Updated: projects are scoped to a team
//   POST /api/projects         — manager creates project inside a team
//   GET  /api/projects?team=id — get projects for a specific team (members only)

const express  = require('express');
const Project  = require('../models/Project');
const Team     = require('../models/Team');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/projects — manager only, requires teamId in body
router.post('/', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const { name, description, teamId } = req.body;
    if (!name)   return res.status(400).json({ message: 'Project name is required' });
    if (!teamId) return res.status(400).json({ message: 'Team ID is required' });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Only the team creator (manager) can add projects
    if (team.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the team creator can add projects' });
    }

    const project = new Project({ name, description, team: teamId, createdBy: req.user.id });
    await project.save();
    await project.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'team',      select: 'name' },
    ]);
    res.status(201).json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ message: 'Server error creating project' });
  }
});

// GET /api/projects?teamId=xxx — returns projects for a team the user belongs to
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { teamId } = req.query;

    if (teamId) {
      // Verify user is a member of this team
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ message: 'Team not found' });

      const isMember = team.members.some(m => m.user.toString() === req.user.id);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this team' });

      const projects = await Project.find({ team: teamId })
        .populate('createdBy', 'name email')
        .populate('team',      'name')
        .sort({ createdAt: -1 });
      return res.json({ projects });
    }

    // No teamId — return all projects across all teams the user belongs to
    const projects = await Project.find({ team: { $in: req.user.teams || [] } })
      .populate('createdBy', 'name email')
      .populate('team',      'name')
      .sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching projects' });
  }
});

module.exports = router;
