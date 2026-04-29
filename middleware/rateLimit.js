// middleware/rateLimit.js
// Phase 3 refactor: request rate limiting using express-rate-limit.
// Two limiters:
//   generalLimiter  — applied to all API routes
//   authLimiter     — stricter limit on /api/auth/login and /api/auth/signup

const rateLimit = require('express-rate-limit');
const appConfig = require('../config/appConfig');

const generalLimiter = rateLimit({
  windowMs:         appConfig.rateLimit.windowMs,
  max:              appConfig.rateLimit.maxRequests,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs:         appConfig.rateLimit.authWindowMs,
  max:              appConfig.rateLimit.authMaxRequests,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { message: 'Too many auth attempts, please try again in 15 minutes.' },
});

module.exports = { generalLimiter, authLimiter };
