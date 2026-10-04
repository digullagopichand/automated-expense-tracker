const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/database');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        message: 'Authentication token required. Please sign in.',
        code: 'AUTH_REQUIRED'
      }
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.queryOne('SELECT id, email, name, currency, monthly_income, timezone, date_format FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'User associated with token no longer exists.',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Session expired. Please sign in again.',
          code: 'TOKEN_EXPIRED'
        }
      });
    }
    return res.status(401).json({
      error: {
        message: 'Invalid authorization token.',
        code: 'INVALID_TOKEN'
      }
    });
  }
}

module.exports = authenticate;
