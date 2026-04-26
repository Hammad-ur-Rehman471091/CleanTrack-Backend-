// server.js — CleanTrack Backend entry point
// Phase 1 refactor: this file now only wires together config, middleware and routes.
// All logic lives in config/, middleware/, models/, and routes/.

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const connectDB  = require('./config/db');

// Route modules
const authRoutes      = require('./routes/auth');
const projectRoutes   = require('./routes/projects');
const issueRoutes     = require('./routes/issues');
const userRoutes      = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');

// ─── Connect to database ─────────────────────────────────────────────────────
connectDB();

// ─── App setup ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ─── Mount routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/projects',  projectRoutes);
app.use('/api/issues',    issueRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CleanTrack server running on port ${PORT}`));
