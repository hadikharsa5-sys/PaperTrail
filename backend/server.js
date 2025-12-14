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
// If the environment variable isn't set, default to the Netlify site used for the frontend.
// NOTE: it's best to set FRONTEND_ORIGIN in Render's environment; the default is a helpful fallback.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://papertrai1.netlify.app';
if (!process.env.FRONTEND_ORIGIN) {
  console.warn(`FRONTEND_ORIGIN environment variable not found — using fallback ${FRONTEND_ORIGIN}`);
}
console.log(`Starting server with FRONTEND_ORIGIN=${FRONTEND_ORIGIN} NODE_ENV=${process.env.NODE_ENV || 'development'}`);

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']

}));

// Content Security Policy (start in report-only mode to discover violations)
// Enforced Content Security Policy for production use.
// This restricts the sources of scripts/styles/images/connect targets to
// reduce XSS and data exfiltration risks. Keep in sync with the Netlify frontend origin.
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      // Allow scripts served from this API or the frontend host. Avoid 'unsafe-inline' for scripts.
      scriptSrc: ["'self'", FRONTEND_ORIGIN],
      // Styles may still require 'unsafe-inline' for some static sites — consider removing after refactor.
      styleSrc: ["'self'", FRONTEND_ORIGIN, "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', FRONTEND_ORIGIN],
      connectSrc: ["'self'", FRONTEND_ORIGIN],
      fontSrc: ["'self'", FRONTEND_ORIGIN, 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
    // Enforce policy in production — during development you can toggle via FRONTEND_ORIGIN or NODE_ENV checks.
    reportOnly: false,
  })
);

// Parse cookies (for session/JWT cookie handling)
app.use(cookieParser());

// Limit JSON body size to mitigate large payload attacks
app.use(express.json({ limit: '10kb' }));

// CSRF protection: create middleware but do not apply globally.
const csrfProtection = csurf({ cookie: { httpOnly: false, sameSite: 'none', secure: process.env.NODE_ENV === 'production' } });

// Always allow preflight requests
app.options('*', cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));



app.use((req, res, next) => {
  // Always allow preflight
  if (req.method === 'OPTIONS') return next();

  // ❌ Do NOT CSRF-protect auth endpoints
  if (req.path.startsWith('/api/auth')) {
    return next();
  }

  // ✅ Protect other state-changing routes
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }

  next();
});


// Global API rate limiter: reasonable default for general API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // allow bursty traffic but limit abusive clients
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' }
});

// Apply general API limiter to all /api routes. Specific routes (e.g., login) have their own stricter limiters.
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);

// Endpoint to fetch a fresh CSRF token (frontend should call this and send token with POSTs)
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (err) {
    console.error('CSRF token error:', err);
    // Centralized error handler will log details; return a generic message.
    res.status(500).json({ error: 'Could not generate CSRF token' });
  }
});

// Basic health check
app.get("/", (req, res) => {
  res.json({ status: "PaperTrail API running" });
});

// Centralized error handler
// Avoid leaking stack traces in production; log full errors server-side.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Internal server error' });
  }
  // In development return the message (but be cautious about stack traces)
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
