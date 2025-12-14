// Lightweight security-focused logger helpers.
// We intentionally avoid logging secrets (passwords, tokens).
// These helpers centralize how we record auth/authorization events.

function logAuthFailure({ usernameOrEmail, ip, reason }) {
  // Don't log passwords or tokens. Log only enough to detect patterns.
  console.warn(`[AUTH FAILURE] usernameOrEmail=${usernameOrEmail || '-'} ip=${ip || '-'} reason=${reason}`);
}

function logAuthSuccess({ userId, username, ip }) {
  console.info(`[AUTH SUCCESS] userId=${userId} username=${username || '-'} ip=${ip || '-'} `);
}

function logAuthzFailure({ userId, username, ip, action, resource }) {
  console.warn(`[AUTHZ FAILURE] userId=${userId || '-'} username=${username || '-'} ip=${ip || '-'} action=${action} resource=${resource}`);
}

module.exports = {
  logAuthFailure,
  logAuthSuccess,
  logAuthzFailure
};
