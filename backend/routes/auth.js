const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const db = require("../db");
const rateLimit = require('express-rate-limit');
const { getAuthCookieOptions } = require('../middleware/cookies');
const { authenticateToken } = require('../middleware/auth');
const { logAuthFailure, logAuthSuccess } = require('../middleware/logger');

// Fail fast if JWT secret is missing
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

const JWT_SECRET = process.env.JWT_SECRET;

// Refresh token configuration
const REFRESH_TOKEN_EXP_DAYS = 30;

async function ensureRefreshTable() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  try {
    await db.query(createSql);
  } catch (err) {
    console.error('Error ensuring refresh_tokens table exists:', err);
  }
}

// Flag to track if login_attempts table is available
let loginAttemptsTableAvailable = false;

async function ensureLoginAttemptsTable() {
  // Check if table exists first (non-fatal)
  try {
    await db.query('SELECT 1 FROM login_attempts LIMIT 1');
    loginAttemptsTableAvailable = true;
    console.log('login_attempts table is available');
  } catch (err) {
    // Table doesn't exist - log warning but don't crash
    console.warn('login_attempts table not found. Lockout feature will be disabled until table is created.');
    console.warn('Please run the migration script: backend/migrations/001_create_login_attempts.sql');
    loginAttemptsTableAvailable = false;
  }
}

// Per-account login abuse mitigation
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BACKOFF_MULTIPLIER = 2; // Exponential backoff

async function checkAccountLockout(identifier) {
  // Graceful degradation: if table doesn't exist, skip lockout check
  if (!loginAttemptsTableAvailable) {
    return { locked: false };
  }
  
  try {
    const [rows] = await db.query(
      'SELECT attempt_count, locked_until FROM login_attempts WHERE identifier = ? LIMIT 1',
      [identifier]
    );
    
    if (rows && rows.length > 0) {
      const attempt = rows[0];
      if (attempt.locked_until && new Date(attempt.locked_until) > new Date()) {
        const lockoutRemaining = Math.ceil((new Date(attempt.locked_until) - new Date()) / 1000 / 60);
        return { locked: true, minutesRemaining: lockoutRemaining };
      }
      // Lockout expired, reset
      if (attempt.locked_until && new Date(attempt.locked_until) <= new Date()) {
        await db.query('DELETE FROM login_attempts WHERE identifier = ?', [identifier]);
      }
    }
    return { locked: false };
  } catch (err) {
    // If table operations fail, log but don't block login
    console.error('Error checking account lockout (non-fatal):', err);
    return { locked: false };
  }
}

async function recordFailedLogin(identifier) {
  // Graceful degradation: if table doesn't exist, skip recording
  if (!loginAttemptsTableAvailable) {
    return;
  }
  
  try {
    const [rows] = await db.query(
      'SELECT attempt_count FROM login_attempts WHERE identifier = ? LIMIT 1',
      [identifier]
    );
    
    if (rows && rows.length > 0) {
      const currentAttempts = rows[0].attempt_count + 1;
      let lockedUntil = null;
      
      if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Lock account for LOCKOUT_DURATION_MS
        lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      
      await db.query(
        'UPDATE login_attempts SET attempt_count = ?, locked_until = ?, last_attempt_at = NOW() WHERE identifier = ?',
        [currentAttempts, lockedUntil, identifier]
      );
    } else {
      // First failed attempt
      await db.query(
        'INSERT INTO login_attempts (identifier, attempt_count) VALUES (?, 1)',
        [identifier]
      );
    }
  } catch (err) {
    // If table operations fail, log but don't block login
    console.error('Error recording failed login (non-fatal):', err);
  }
}

async function clearLoginAttempts(identifier) {
  // Graceful degradation: if table doesn't exist, skip clearing
  if (!loginAttemptsTableAvailable) {
    return;
  }
  
  try {
    await db.query('DELETE FROM login_attempts WHERE identifier = ?', [identifier]);
  } catch (err) {
    // If table operations fail, log but don't block login
    console.error('Error clearing login attempts (non-fatal):', err);
  }
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function storeRefreshToken(userId, token) {
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXP_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hash, expiresAt]
  );
}

async function revokeRefreshToken(token) {
  const hash = hashToken(token);
  await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [hash]);
}

async function findValidRefreshToken(token) {
  const hash = hashToken(token);
  const [rows] = await db.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0 AND expires_at > NOW() LIMIT 1',
    [hash]
  );
  return rows && rows.length ? rows[0] : null;
}

// Detect token reuse: if a token is used after being revoked, invalidate all tokens for that user
async function detectTokenReuse(token, userId) {
  const hash = hashToken(token);
  // Check if this token was previously revoked (indicates reuse/compromise)
  const [revokedRows] = await db.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 1 LIMIT 1',
    [hash]
  );
  
  if (revokedRows && revokedRows.length > 0) {
    // Token reuse detected - invalidate all tokens for this user as a security measure
    console.warn(`[SECURITY] Token reuse detected for user ${userId} - invalidating all refresh tokens`);
    await db.query(
      'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0',
      [userId]
    );
    return true;
  }
  return false;
}

// Ensure required tables are present
// Note: ensureRefreshTable() is called for refresh tokens (required for auth)
// ensureLoginAttemptsTable() is called but lockout feature degrades gracefully if table missing
ensureRefreshTable();
// Check for login_attempts table (non-fatal - auth works without it)
ensureLoginAttemptsTable().catch(err => {
  console.warn('Could not verify login_attempts table:', err);
  // Auth continues to work, just without per-account lockout
});

// Rate limiters for auth endpoints. More strict for login to mitigate brute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts, please try again later.' }
});

// POST /api/auth/register
// POST /api/auth/register
// Rate-limited to hinder automated account creation.
router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Username or email already exists" });
    }

    // Hash the password before storing
    const passwordHash = await bcrypt.hash(password, 12);
    let finalRole = role === "author" ? "author" : "reader";
    let authorApproved = 1;
    let authorStatus = "approved";

    if (finalRole === "author") {
      authorApproved = 0;
      authorStatus = "pending";
    }

    const [result] = await db.query(
      `INSERT INTO users (username, email, password_hash, name, role, author_approved, author_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, email, passwordHash, name, finalRole, authorApproved, authorStatus]
    );

    res.status(201).json({
      id: result.insertId,
      username,
      email,
      name,
      role: finalRole,
      author_approved: authorApproved,
      author_status: authorStatus
    });
  } catch (err) {
    console.error("Register error:", err);
    // Forward to centralized error handler
    next(err);
  }
});

// POST /api/auth/login
// POST /api/auth/login
// Apply a strict rate limiter on login endpoint to slow brute-force attacks.
// Includes per-account lockout to prevent credential stuffing.
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    // Check for account lockout before database query (prevents user enumeration)
    const lockoutCheck = await checkAccountLockout(usernameOrEmail);
    if (lockoutCheck.locked) {
      logAuthFailure({ usernameOrEmail, ip: req.ip, reason: 'account-locked' });
      return res.status(429).json({ 
        error: "Too many failed login attempts. Please try again later.",
        retryAfter: lockoutCheck.minutesRemaining
      });
    }

    const [rows] = await db.query(
      `SELECT id, username, email, password_hash, name, role, author_approved, author_status
       FROM users
       WHERE username = ? OR email = ?`,
      [usernameOrEmail, usernameOrEmail]
    );

    if (rows.length === 0) {
      // Record failed attempt even for unknown users (prevents enumeration)
      await recordFailedLogin(usernameOrEmail);
      logAuthFailure({ usernameOrEmail, ip: req.ip, reason: 'unknown-user' });
      return res.status(401).json({ error: "Invalid username / email or password" });
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      // Record failed attempt
      await recordFailedLogin(usernameOrEmail);
      logAuthFailure({ usernameOrEmail, ip: req.ip, reason: 'bad-password' });
      return res.status(401).json({ error: "Invalid username / email or password" });
    }

    // Successful login - clear any failed attempts
    await clearLoginAttempts(usernameOrEmail);

    // Issue a JWT and set it in an httpOnly cookie
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    const cookieOptions = getAuthCookieOptions({ maxAge: 60 * 60 * 1000 });
    // Access token cookie is httpOnly to prevent JS access and reduce XSS impact.
    res.cookie('token', token, cookieOptions);

    // Create and store a refresh token (longer lived) and set cookie
    try {
      const refreshToken = generateRefreshToken();
      await storeRefreshToken(user.id, refreshToken);
      const refreshCookieOptions = getAuthCookieOptions({ maxAge: REFRESH_TOKEN_EXP_DAYS * 24 * 60 * 60 * 1000 });
      res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    } catch (err) {
      console.error('Failed to create refresh token:', err);
    }

    // Return safe user info (no password)
    // Log successful login (without secrets)
    logAuthSuccess({ userId: user.id, username: user.username, ip: req.ip });

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      author_approved: user.author_approved,
      author_status: user.author_status
    });
  } catch (err) {
    console.error("Login error:", err);
    next(err);
  }
});


// GET /api/auth/me — return current user based on cookie
router.get('/me', async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const [rows] = await db.query(
      `SELECT id, username, email, name, role, author_approved, author_status
       FROM users WHERE id = ?`,
      [payload.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    next(err);
  }
});

// POST /api/auth/refresh — rotate refresh token and issue a new access token
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    const row = await findValidRefreshToken(token);
    if (!row) {
      // Check for token reuse before returning error
      // If token exists but is revoked, it might be a reuse attempt
      const hash = hashToken(token);
      const [revokedCheck] = await db.query(
        'SELECT user_id FROM refresh_tokens WHERE token_hash = ? AND revoked = 1 LIMIT 1',
        [hash]
      );
      if (revokedCheck && revokedCheck.length > 0) {
        const userId = revokedCheck[0].user_id;
        // Token reuse detected - invalidate all tokens for this user
        await detectTokenReuse(token, userId);
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const userId = row.user_id;
    
    // Check for token reuse before proceeding
    const isReuse = await detectTokenReuse(token, userId);
    if (isReuse) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // lookup user
    const [users] = await db.query('SELECT id, username, email, name, role, author_approved, author_status FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = users[0];

    // Rotate: revoke old token FIRST, then issue new refresh token (prevents race conditions)
    await revokeRefreshToken(token);
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(userId, newRefreshToken);

    // issue new access token
    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    const cookieOptions = getAuthCookieOptions({ maxAge: 60 * 60 * 1000 });
    res.cookie('token', accessToken, cookieOptions);

    // set new refresh cookie
    const refreshCookieOptions = getAuthCookieOptions({ maxAge: REFRESH_TOKEN_EXP_DAYS * 24 * 60 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

    res.json({ id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, author_approved: user.author_approved, author_status: user.author_status });
  } catch (err) {
    console.error('Refresh error:', err);
    next(err);
  }
});

// POST /api/auth/logout — clear the auth cookie
// Idempotent: safe to call multiple times, even if already logged out
router.post('/logout', async (req, res, next) => {
  try {
    const refresh = req.cookies && req.cookies.refreshToken;

    // Revoke refresh token if present (idempotent - safe if already revoked)
    if (refresh) {
      try {
        await revokeRefreshToken(refresh);
      } catch (revErr) {
        // Log revoke failures but do not fail the logout response
        // This is idempotent - if token is already revoked, that's fine
        console.error('Failed to revoke refresh token during logout:', revErr);
      }
    }

    // Clear cookies (idempotent - safe to clear even if already cleared)
    // Use same options as when setting cookies to ensure proper clearing
    try {
      const cookieOptions = getAuthCookieOptions();
      // Explicitly set expiration in past to ensure clearing
      res.clearCookie('token', { ...cookieOptions, expires: new Date(0) });
      res.clearCookie('refreshToken', { ...cookieOptions, expires: new Date(0) });
    } catch (clearErr) {
      // Log but don't fail - cookies may already be cleared
      console.error('Failed to clear cookies during logout:', clearErr);
    }

    // Always return success (idempotent operation)
    return res.json({ success: true });
  } catch (err) {
    // Unexpected error: forward to centralized error handler
    // It will log full details and return safe response
    console.error('Unexpected logout error:', err);
    next(err);
  }
});

// POST /api/auth/change-password
// Body: { currentPassword, newPassword }
// Requires authentication (access token cookie)
router.post('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing current or new password' });
    if (typeof newPassword !== 'string' || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    // Fetch current hash
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const storedHash = rows[0].password_hash;

    // Verify current password
    const match = await bcrypt.compare(String(currentPassword), storedHash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    // Hash new password with bcrypt (10 rounds)
    const newHash = await bcrypt.hash(String(newPassword), 10);

    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    // Successful change
    return res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    next(err);
  }
});


module.exports = router;

