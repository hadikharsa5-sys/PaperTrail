// Centralize cookie options used for auth cookies.
// This ensures we consistently apply secure defaults in production
// and have a single place to audit cookie settings.

function getAuthCookieOptions(overrides = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  // In production we require HTTPS (secure: true) and cross-site cookies (SameSite=None)
  const base = {
    httpOnly: true, // not accessible to JS
    secure: isProd, // only sent over HTTPS in production
    sameSite: 'none', // required for cross-site cookies (Netlify frontend + Render backend)
  };
  return Object.assign(base, overrides);
}

module.exports = { getAuthCookieOptions };
