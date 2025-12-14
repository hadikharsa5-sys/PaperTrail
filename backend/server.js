require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");
const cartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");

const app = express();

// Trust first proxy (required when running behind a reverse proxy/load balancer)
app.set('trust proxy', 1);

// Middlewares - Enhanced security headers via Helmet
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  // Strict-Transport-Security (HSTS) - only in production
  // Start with short max-age, increase after confidence in deployment
  hsts: isProduction ? {
    maxAge: 300, // 5 minutes initially - increase to 31536000 (1 year) after testing
    includeSubDomains: true,
    preload: false // Set to true if you plan to submit to HSTS preload list
  } : false,
  
  // Prevent MIME type sniffing
  contentSecurityPolicy: false, // We configure CSP separately below
  noSniff: true, // X-Content-Type-Options: nosniff
  
  // Referrer policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Permissions Policy (formerly Feature-Policy) - disable unnecessary APIs
  // Empty array [] disables the feature entirely
  permissionsPolicy: {
    features: {
      geolocation: [],
      microphone: [],
      camera: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: []
    }
  },
  
  // X-Frame-Options (prevent clickjacking)
  frameguard: {
    action: 'deny'
  },
  
  // X-XSS-Protection (legacy, but still useful)
  xssFilter: true
}));

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

// Content Security Policy - Explicit and restrictive
// This restricts the sources of scripts/styles/images/connect targets to
// reduce XSS and data exfiltration risks. Keep in sync with the Netlify frontend origin.
// Note: 'unsafe-inline' for styles is required by the frontend; consider refactoring to remove.
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      // Scripts: only from self and frontend (no unsafe-inline or unsafe-eval)
      scriptSrc: ["'self'", FRONTEND_ORIGIN],
      // Styles: Font Awesome CDN (unsafe-inline removed - all styles use CSS classes)
      styleSrc: ["'self'", FRONTEND_ORIGIN, "https://cdnjs.cloudflare.com"],
      // Images: self, data URIs, frontend, and placeholder service (for book covers)
      imgSrc: ["'self'", 'data:', FRONTEND_ORIGIN, "https://via.placeholder.com"],
      // Connect: API backend + frontend (explicit, no wildcards)
      connectSrc: ["'self'", FRONTEND_ORIGIN, "https://papertrail-jdcp.onrender.com"],
      // Fonts: self, frontend, data URIs, and Font Awesome CDN
      fontSrc: ["'self'", FRONTEND_ORIGIN, 'data:', "https://cdnjs.cloudflare.com"],
      // No object/embed elements
      objectSrc: ["'none'"],
      // Block base URI manipulation
      baseUri: ["'self'"],
      // Upgrade insecure requests in production
      upgradeInsecureRequests: isProduction ? [] : null,
      // Form actions limited to self
      formAction: ["'self'"],
      // Frame ancestors: none (prevent embedding)
      frameAncestors: ["'none'"]
    },
    // Enforce policy (not report-only)
    reportOnly: false,
  })
);

// Parse cookies (for session/JWT cookie handling)
app.use(cookieParser());

// Limit JSON body size to mitigate large payload attacks
app.use(express.json({ limit: '10kb' }));

// CSRF protection: Double-submit cookie pattern (replaces csurf)
// Token stored in cookie (readable by JS) and validated against X-CSRF-Token header
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getCSRFTokenCookieOptions() {
  return {
    httpOnly: false, // Required: frontend JS must read CSRF token
    sameSite: isProduction ? 'none' : 'lax', // Match auth cookie behavior
    secure: isProduction, // HTTPS only in production
    path: '/', // Minimal path scope
    maxAge: 60 * 60 * 1000 // 1 hour
  };
}

// Middleware: Generate and set CSRF token cookie
function setCSRFToken(req, res, next) {
  let token = req.cookies && req.cookies['_csrf'];
  
  // Generate new token if missing or invalid format
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = generateCSRFToken();
    res.cookie('_csrf', token, getCSRFTokenCookieOptions());
  }
  
  // Attach token to request for validation
  req.csrfToken = token;
  next();
}

// Middleware: Validate CSRF token (double-submit cookie pattern)
function validateCSRFToken(req, res, next) {
  // Skip CSRF for auth endpoints (login/register/logout/refresh)
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  
  // Only validate state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }
  
  const cookieToken = req.cookies && req.cookies['_csrf'];
  const headerToken = req.headers['x-csrf-token'];
  
  // Both must be present and match
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  if (cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  
  next();
}

// Always allow preflight requests
app.options('*', cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Set CSRF token cookie on all requests (for frontend to read)
app.use(setCSRFToken);

// Validate CSRF token on state-changing requests
app.use(validateCSRFToken);


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
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);

// Endpoint to fetch CSRF token (for frontend compatibility)
// Token is already set in cookie via setCSRFToken middleware
app.get('/api/csrf-token', (req, res) => {
  try {
    const token = req.csrfToken || req.cookies['_csrf'];
    if (!token) {
      // Generate if somehow missing
      const newToken = generateCSRFToken();
      res.cookie('_csrf', newToken, getCSRFTokenCookieOptions());
      return res.json({ csrfToken: newToken });
    }
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

// Centralized error handler
// Never expose stack traces in production; log full errors server-side only.
app.use((err, req, res, next) => {
  // Log full error details server-side (including stack trace)
  console.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  // In production, never expose error details to client
  if (process.env.NODE_ENV === 'production') {
    // Determine appropriate status code
    const statusCode = err.statusCode || err.status || 500;
    // Generic error message for all production errors
    return res.status(statusCode).json({ error: 'Internal server error' });
  }
  
  // In development, return error message but NOT full stack trace
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({ 
    error: err.message || 'Internal server error',
    // Only include status code in dev, never stack traces
    status: statusCode
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
