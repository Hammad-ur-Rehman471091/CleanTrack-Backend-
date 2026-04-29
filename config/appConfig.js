// config/appConfig.js
// Phase 3 refactor: single source of truth for all environment variables.
// Atlas update: MONGO_URI must be set in .env — no localhost fallback in production.

const appConfig = {
  port:      parseInt(process.env.PORT, 10) || 5000,

  // Set in .env as your MongoDB Atlas connection string
  // Format: mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
  mongoUri:  process.env.MONGO_URI || 'mongodb://localhost:27017/cleantrack',

  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_change_in_production',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',

  // Rate limiting
  rateLimit: {
    windowMs:        parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests:     parseInt(process.env.RATE_LIMIT_MAX,       10) || 100,
    authWindowMs:    parseInt(process.env.AUTH_RATE_WINDOW_MS,  10) || 15 * 60 * 1000,
    authMaxRequests: parseInt(process.env.AUTH_RATE_MAX,        10) || 20,
  },

  // Pagination defaults
  pagination: {
    defaultPage:  1,
    defaultLimit: 10,
    maxLimit:     50,
  },
};

module.exports = appConfig;
