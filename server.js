// server.js - CleanTrack Backend
// NOTE: Intentionally unstructured for incremental refactoring
// All route handlers, middleware, and DB connection are loosely organized
// Future refactoring targets: split into routers, controllers, services, middleware folders

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── DB Connection ───────────────────────────────────────────────────────────
// TODO (refactor): move to a separate db.js config file
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cleantrack')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ─── Mongoose Models ─────────────────────────────────────────────────────────
// TODO (refactor): move each model to models/ folder

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  // role: manager | tester | developer
  role: { type: String, enum: ['manager', 'tester', 'developer'], required: true },
  createdAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  stepsToReproduce: { type: String, trim: true },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open'
  },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update updatedAt on save
issueSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Issue = mongoose.model('Issue', issueSchema);

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// TODO (refactor): move to middleware/auth.js
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token format: Bearer <token>' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Role guard helper
// TODO (refactor): convert to a proper middleware factory
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient role' });
    }
    next();
  };
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const validRoles = ['manager', 'tester', 'developer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// GET /api/auth/me - verify token & return user info
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PROJECT ROUTES ───────────────────────────────────────────────────────────
// POST /api/projects - manager only
app.post('/api/projects', authMiddleware, requireRole('manager'), async (req, res) => {
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

// GET /api/projects - all authenticated users can see projects
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching projects' });
  }
});

// ─── ISSUE ROUTES ─────────────────────────────────────────────────────────────

// POST /api/issues - tester only
app.post('/api/issues', authMiddleware, requireRole('tester'), async (req, res) => {
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
      { path: 'project', select: 'name' }
    ]);

    res.status(201).json({ issue });
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ message: 'Server error creating issue' });
  }
});

// GET /api/issues - role-based filtering
app.get('/api/issues', authMiddleware, async (req, res) => {
  try {
    let query = {};

    // Tester sees only their reported issues
    if (req.user.role === 'tester') {
      query.reportedBy = req.user.id;
    }
    // Developer sees only issues assigned to them
    else if (req.user.role === 'developer') {
      query.assignedTo = req.user.id;
    }
    // Manager sees everything

    const issues = await Issue.find(query)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.json({ issues });
  } catch (err) {
    console.error('Get issues error:', err);
    res.status(500).json({ message: 'Server error fetching issues' });
  }
});

// GET /api/issues/:id - single issue
app.get('/api/issues/:id', authMiddleware, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project', 'name description');

    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    // Access control: tester can only see their own issues
    if (req.user.role === 'tester' && issue.reportedBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    // Developer can only see assigned issues
    if (req.user.role === 'developer' && (!issue.assignedTo || issue.assignedTo._id.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ issue });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/issues/:id/assign - manager only
app.patch('/api/issues/:id/assign', authMiddleware, requireRole('manager'), async (req, res) => {
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
      .populate('project', 'name');

    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    res.json({ issue });
  } catch (err) {
    console.error('Assign issue error:', err);
    res.status(500).json({ message: 'Server error assigning issue' });
  }
});

// PATCH /api/issues/:id/status - developer only
app.patch('/api/issues/:id/status', authMiddleware, requireRole('developer'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    // Developer can only update their assigned issues
    if (!issue.assignedTo || issue.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update issues assigned to you' });
    }

    issue.status = status;
    await issue.save();
    await issue.populate([
      { path: 'reportedBy', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
      { path: 'project', select: 'name' }
    ]);

    res.json({ issue });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error updating status' });
  }
});

// GET /api/users/developers - manager uses this to see who to assign
app.get('/api/users/developers', authMiddleware, requireRole('manager'), async (req, res) => {
  try {
    const developers = await User.find({ role: 'developer' }).select('-password');
    res.json({ developers });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/dashboard/stats - summary numbers per role
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    let stats = {};

    if (req.user.role === 'manager') {
      const totalIssues = await Issue.countDocuments();
      const openIssues = await Issue.countDocuments({ status: 'open' });
      const inProgressIssues = await Issue.countDocuments({ status: 'in_progress' });
      const resolvedIssues = await Issue.countDocuments({ status: 'resolved' });
      const totalProjects = await Project.countDocuments();
      const unassigned = await Issue.countDocuments({ assignedTo: null });
      stats = { totalIssues, openIssues, inProgressIssues, resolvedIssues, totalProjects, unassigned };
    } else if (req.user.role === 'tester') {
      const myIssues = await Issue.countDocuments({ reportedBy: req.user.id });
      const openIssues = await Issue.countDocuments({ reportedBy: req.user.id, status: 'open' });
      const inProgress = await Issue.countDocuments({ reportedBy: req.user.id, status: 'in_progress' });
      const resolved = await Issue.countDocuments({ reportedBy: req.user.id, status: 'resolved' });
      stats = { myIssues, openIssues, inProgress, resolved };
    } else if (req.user.role === 'developer') {
      const assigned = await Issue.countDocuments({ assignedTo: req.user.id });
      const inProgress = await Issue.countDocuments({ assignedTo: req.user.id, status: 'in_progress' });
      const resolved = await Issue.countDocuments({ assignedTo: req.user.id, status: 'resolved' });
      const open = await Issue.countDocuments({ assignedTo: req.user.id, status: 'open' });
      stats = { assigned, inProgress, resolved, open };
    }

    res.json({ stats });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CleanTrack server running on port ${PORT}`));
