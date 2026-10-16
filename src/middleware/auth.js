/**
 * ============================================================================
 * CLOUDCLASS - AUTHENTICATION & RBAC MIDDLEWARE
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../services/dbService');

/**
 * Verifies JWT token from Authorization header
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
}

/**
 * Enforces mandatory authentication
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

/**
 * Enforces role-based permissions (e.g. 'faculty', 'student', 'admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This action requires one of the following roles: [${allowedRoles.join(', ')}]`
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireAuth,
  requireRole
};
