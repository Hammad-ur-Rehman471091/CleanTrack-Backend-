// server.js — CleanTrack Backend

require('dotenv').config();

const express            = require('express');
const cors               = require('cors');
const connectDB          = require('./config/db');
const appConfig          = require('./config/appConfig');
const { generalLimiter } = require('./middleware/rateLimit');

const authRoutes      = require('./routes/auth');
const teamRoutes      = require('./routes/teams');
const projectRoutes   = require('./routes/projects');
const issueRoutes     = require('./routes/issues');
const userRoutes      = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');

connectDB();

const app = express();

app.use(cors({
  origin: '*',
  credentials: false,
}));

app.use(express.json());
app.set('trust proxy', 1);
app.use('/api', generalLimiter);

app.use('/api/auth',      authRoutes);
app.use('/api/teams',     teamRoutes);
app.use('/api/projects',  projectRoutes);
app.use('/api/issues',    issueRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

if (process.env.NODE_ENV !== 'production') {
  app.listen(appConfig.port, () =>
    console.log(`CleanTrack server running on port ${appConfig.port}`)
  );
}

module.exports = app;
