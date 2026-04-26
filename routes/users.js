// routes/users.js
// Extracted from server.js (Phase 1 refactor)
// Handles: GET /api/users/developers

const express = require('express');
const User    = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/developers — manager only
router.get('/developers', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const developers = await User.find({ role: 'developer' }).select('-password');
    res.json({ developers });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
