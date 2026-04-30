// routes/users.js
// GET /api/users/developers?teamId=xxx — team developers only (manager)

const express = require('express');
const Team    = require('../models/Team');
const User    = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/developers?teamId=xxx — returns developers in a specific team
router.get('/developers', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const { teamId } = req.query;

    if (teamId) {
      const team = await Team.findById(teamId).populate('members.user', 'name email role');
      if (!team) return res.status(404).json({ message: 'Team not found' });

      const developers = team.members
        .map(m => m.user)
        .filter(u => u && u.role === 'developer');
      return res.json({ developers });
    }

    // Fallback: all developers across managed teams
    const managedTeams = await Team.find({ createdBy: req.user.id })
      .populate('members.user', 'name email role');

    const devMap = {};
    for (const team of managedTeams) {
      for (const m of team.members) {
        if (m.user && m.user.role === 'developer') {
          devMap[m.user._id.toString()] = m.user;
        }
      }
    }
    res.json({ developers: Object.values(devMap) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
