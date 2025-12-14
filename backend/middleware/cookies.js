// Centralize cookie options used for auth cookies.
// This ensures we consistently apply secure defaults in production
// and have a single place to audit cookie settings.
// Security requirements:
// - HttpOnly: true (prevents XSS access to tokens)
// - Secure: true in production (HTTPS only)
// - SameSite: None in production (required for cross-site cookies with Secure)
// - Minimal path scope (default '/' is appropriate)
// - Explicit expiration via maxAge (set by caller)

function getAuthCookieOptions(overrides = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  // In production we require HTTPS (secure: true) and cross-site cookies (SameSite=None)
  const base = {
    httpOnly: true, // Not accessible to JavaScript (prevents XSS token theft)
    secure: isProd, // Only sent over HTTPS in production
    // Browsers require `SameSite=None` to be paired with `Secure`. Use `none` only in production
    // (when `secure` is true). Use `lax` locally to avoid dropped cookies during development.
    sameSite: isProd ? 'none' : 'lax', // Cross-site cookies in prod; safer default in dev
    path: '/', // Minimal path scope (default is appropriate)
    // Note: Domain should NOT be set unless necessary (allows subdomain access)
    // Note: maxAge should be set by caller via overrides
  };
  return Object.assign(base, overrides);
}

module.exports = { getAuthCookieOptions };
