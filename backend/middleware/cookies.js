// Centralize cookie options used for auth cookies.
// This ensures we consistently apply secure defaults in production
// and have a single place to audit cookie settings.

function getAuthCookieOptions(overrides = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  // In production we require HTTPS (secure: true) and cross-site cookies (SameSite=None)
  const base = {
    httpOnly: true, // not accessible to JS
    secure: isProd, // only sent over HTTPS in production
    // Browsers require `SameSite=None` to be paired with `Secure`. Use `none` only in production
    // (when `secure` is true). Use `lax` locally to avoid dropped cookies during development.
    sameSite: isProd ? 'none' : 'lax', // cross-site cookies in prod; safer default in dev
  };
  return Object.assign(base, overrides);
}

module.exports = { getAuthCookieOptions };
