/**
 * middleware/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Simple HTTP Basic-Auth guard for /admin/* routes.
 * Credentials are read from environment variables:
 *   ADMIN_USER  (default: "admin")
 *   ADMIN_PASS  (default: "admin123")
 *
 * Set these in your .env file before going to production!
 */

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const REALM      = 'AutoVault Admin Panel';

/**
 * Decode and validate an HTTP Basic Auth header.
 * Returns true if credentials match, false otherwise.
 */
function validateBasicAuth(authHeader) {
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;

    const base64  = authHeader.slice('Basic '.length);
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const sep     = decoded.indexOf(':');
    if (sep === -1) return false;

    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);

    // Constant-time compare to resist timing attacks
    const userMatch = user === ADMIN_USER;
    const passMatch = pass === ADMIN_PASS;
    return userMatch && passMatch;
}

/**
 * Express middleware — checks for valid admin session.
 * On success, calls next().
 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }

    // JSON response for API routes so the frontend can handle it cleanly
    if (req.originalUrl.startsWith('/admin/cars') || (req.headers['accept'] && req.headers['accept'].includes('application/json'))) {
        return res.status(401).json({ error: 'Unauthorised — admin credentials required.' });
    }

    return res.redirect('/admin/login');
}

module.exports = { requireAdmin, ADMIN_USER, ADMIN_PASS };
