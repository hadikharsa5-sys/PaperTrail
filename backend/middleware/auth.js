const jwt = require('jsonwebtoken');
const { logAuthzFailure } = require('./logger');

// Middleware: authenticateToken
// Verifies the access JWT stored in the httpOnly cookie and attaches
// `req.user = { id, role }` on success.
// Security notes:
// - Token comes from httpOnly cookie to reduce XSS theft risk.
// - We do NOT read tokens from localStorage.
function authenticateToken(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Attach minimal user info to the request. Do not attach sensitive fields.
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware factory: requireRole
// Ensures the authenticated user has one of the allowed roles.
// Usage: requireRole(['admin']) or requireRole(['author','admin'])
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      // Log authorization failure (do not include secrets)
      logAuthzFailure({ userId: req.user.id, username: '-', ip: req.ip, action: 'requireRole', resource: allowedRoles.join(',') });
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { authenticateToken, requireRole };
