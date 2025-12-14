require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");

const app = express();

// Trust first proxy (required when running behind a reverse proxy/load balancer)
app.set('trust proxy', 1);

// Middlewares
app.use(helmet());

// Restrict CORS to configured frontend origin and allow credentials for cookies
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
if (!FRONTEND_ORIGIN) {
  console.error('FRONTEND_ORIGIN is not set. CORS origin must be explicitly configured.');
}
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));

// Parse cookies (for session/JWT cookie handling)
app.use(cookieParser());

// Limit JSON body size to mitigate large payload attacks
app.use(express.json({ limit: '10kb' }));

// CSRF protection: create middleware but do not apply globally.
const csrfProtection = csurf({ cookie: { httpOnly: false, sameSite: 'none', secure: process.env.NODE_ENV === 'production' } });

// Apply CSRF protection only to state-changing methods (POST, PUT, DELETE)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  next();
});

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Routes (apply rate limiter to auth routes)
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/books", bookRoutes);

// Endpoint to fetch a fresh CSRF token (frontend should call this and send token with POSTs)
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (err) {
    console.error('CSRF token error:', err);
    res.status(500).json({ error: 'Could not generate CSRF token' });
  }
});

// Basic health check
app.get("/", (req, res) => {
  res.json({ status: "PaperTrail API running" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
