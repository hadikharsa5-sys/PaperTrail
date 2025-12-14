const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

// Fail fast if JWT secret is missing
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
router.post("/register", async (req, res) => {
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
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const [rows] = await db.query(
      `SELECT id, username, email, password_hash, name, role, author_approved, author_status
       FROM users
       WHERE username = ? OR email = ?`,
      [usernameOrEmail, usernameOrEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid username / email or password" });
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid username / email or password" });
    }

    // Issue a JWT and set it in an httpOnly cookie
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 60 * 60 * 1000 // 1 hour
    };

    res.cookie('token', token, cookieOptions);

    // Return safe user info (no password)
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
    res.status(500).json({ error: "Server error" });
  }
});


// GET /api/auth/me — return current user based on cookie
router.get('/me', async (req, res) => {
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
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout — clear the auth cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
  res.json({ success: true });
});

module.exports = router;
