// middleware/auth.js
// Phase 1 refactor: extracted from server.js
// Phase 3 refactor: reads JWT secret from config/appConfig.js instead of process.env directly

const jwt       = require('jsonwebtoken');
const appConfig = require('../config/appConfig');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token format: Bearer <token>' });

  try {
    const decoded = jwt.verify(token, appConfig.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient role' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
