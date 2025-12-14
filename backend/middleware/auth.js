const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'please-set-a-secret-in-production';

function authenticateToken(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error('Token error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(roles = []) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const userRole = (req.user.role || '').toLowerCase();
    if (Array.isArray(roles) && roles.length > 0) {
      if (!roles.map(r => r.toLowerCase()).includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };
