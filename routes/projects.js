// routes/projects.js
// Extracted from server.js (Phase 1 refactor)
// Handles: POST /api/projects, GET /api/projects

const express  = require('express');
const Project  = require('../models/Project');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/projects — manager only
router.post('/', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Project name is required' });

    const project = new Project({ name, description, createdBy: req.user.id });
    await project.save();
    await project.populate('createdBy', 'name email');
    res.status(201).json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ message: 'Server error creating project' });
  }
});

// GET /api/projects — all authenticated users
router.get('/', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching projects' });
  }
});

module.exports = router;
