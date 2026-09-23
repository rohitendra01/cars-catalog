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
 * Express middleware — challenge the browser if no valid credentials are
 * present. On success, calls next().
 */
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (validateBasicAuth(authHeader)) {
        return next();
    }

    // Respond with 401 and WWW-Authenticate to trigger browser dialog
    res.set('WWW-Authenticate', `Basic realm="${REALM}"`);

    // JSON response for API routes so the frontend can handle it cleanly
    if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
        return res.status(401).json({ error: 'Unauthorised — admin credentials required.' });
    }

    return res.status(401).send(
        `<!DOCTYPE html><html><head><title>401 Unauthorised</title>
        <style>body{font-family:monospace;background:#09090b;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:12px;}
        h1{color:#ea580c;letter-spacing:-.05em;}p{color:#71717a;font-size:.875rem;}</style></head>
        <body><h1>401 — Unauthorised</h1><p>Valid admin credentials required.</p>
        <a href="/admin" style="color:#ea580c;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;">Try Again</a></body></html>`
    );
}

module.exports = { requireAdmin };
