// server.js — CleanTrack Backend entry point
// Phase 1 refactor: wires together config, middleware, and routes
// Phase 3 refactor:
//   - general rate limiter applied to all /api routes
//   - PORT read from config/appConfig.js

require('dotenv').config();

const express          = require('express');
const cors             = require('cors');
const connectDB        = require('./config/db');
const appConfig        = require('./config/appConfig');
const { generalLimiter } = require('./middleware/rateLimit');

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

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.set('trust proxy', 1);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// General limiter on all /api routes (auth routes get a stricter limiter in routes/auth.js)
app.use('/api', generalLimiter);

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
app.listen(appConfig.port, () => console.log(`CleanTrack server running on port ${appConfig.port}`));
