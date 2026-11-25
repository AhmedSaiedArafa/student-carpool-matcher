const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { query } = require('../db');
const AppError = require('../utils/AppError');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      return next(new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token'));
    }
    const { rows } = await query('SELECT id FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) {
      return next(new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  };
}

function requireVerified(req, res, next) {
  if (!req.user.emailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your university email first');
  }
  next();
}

module.exports = { authenticate, requireRole, requireVerified };
