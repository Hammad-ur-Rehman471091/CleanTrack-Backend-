// routes/teams.js
// Team management:
//   POST   /api/teams              — manager creates a team (generates join code)
//   GET    /api/teams              — get teams the current user belongs to
//   GET    /api/teams/:id          — get single team with members
//   POST   /api/teams/join         — tester/developer joins team with code
//   DELETE /api/teams/:id/members/:userId — manager removes a member

const express  = require('express');
const crypto   = require('crypto');
const Team     = require('../models/Team');
const User     = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Generate a readable 8-char join code e.g. "A3FX9K2M"
function generateJoinCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// POST /api/teams — manager only
router.post('/', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Team name is required' });

    // Ensure join code is unique
    let joinCode;
    let exists = true;
    while (exists) {
      joinCode = generateJoinCode();
      exists   = await Team.findOne({ joinCode });
    }

    const team = new Team({
      name,
      description,
      joinCode,
      createdBy: req.user.id,
      members:   [{ user: req.user.id }],   // manager is auto-member
    });
    await team.save();

    // Add team to manager's teams list
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { teams: team._id } });

    await team.populate([
      { path: 'createdBy', select: 'name email role' },
      { path: 'members.user', select: 'name email role' },
    ]);

    res.status(201).json({ team });
  } catch (err) {
    console.error('Create team error:', err);
    res.status(500).json({ message: 'Server error creating team' });
  }
});

// GET /api/teams — returns teams the current user is a member of
router.get('/', authMiddleware, async (req, res) => {
  try {
    const teams = await Team.find({ 'members.user': req.user.id })
      .populate('createdBy', 'name email role')
      .populate('members.user', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching teams' });
  }
});

// GET /api/teams/:id — single team detail
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('members.user', 'name email role');

    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Only members can view team details
    const isMember = team.members.some(m => m.user._id.toString() === req.user.id);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this team' });

    res.json({ team });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/teams/join — tester or developer joins with a code
router.post('/join', authMiddleware, requireRole('tester', 'developer'), async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) return res.status(400).json({ message: 'Join code is required' });

    const team = await Team.findOne({ joinCode: joinCode.trim().toUpperCase() });
    if (!team) return res.status(404).json({ message: 'Invalid join code — no team found' });

    // Already a member?
    const alreadyMember = team.members.some(m => m.user.toString() === req.user.id);
    if (alreadyMember) return res.status(409).json({ message: 'You are already a member of this team' });

    team.members.push({ user: req.user.id });
    await team.save();

    // Add team to user's teams list
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { teams: team._id } });

    await team.populate([
      { path: 'createdBy', select: 'name email role' },
      { path: 'members.user', select: 'name email role' },
    ]);

    res.json({ team });
  } catch (err) {
    console.error('Join team error:', err);
    res.status(500).json({ message: 'Server error joining team' });
  }
});

// DELETE /api/teams/:id/members/:userId — manager removes a member
router.delete('/:id/members/:userId', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Only the team creator can remove members
    if (team.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the team creator can remove members' });
    }

    // Can't remove yourself
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot remove yourself from the team' });
    }

    team.members = team.members.filter(m => m.user.toString() !== req.params.userId);
    await team.save();
    await User.findByIdAndUpdate(req.params.userId, { $pull: { teams: team._id } });

    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error removing member' });
  }
});

module.exports = router;
