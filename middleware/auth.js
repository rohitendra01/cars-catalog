/**
 * middleware/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin auth helpers for /admin/* routes.
 * Credentials are read from ADMIN_USERNAME and ADMIN_PASSWORD. The server
 * refuses to start when either value is missing; there are no default logins.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

const ADMIN_USER = process.env.ADMIN_USERNAME || '';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '';
const ACTIVE_ADMIN_SESSION_ID = 'primary-admin';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 8;
const failedLoginAttempts = new Map();

function getAdminSessions() {
    return mongoose.connection.collection('admin_sessions');
}

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function createAdminSessionToken() {
    return crypto.randomBytes(32).toString('base64url');
}

async function activateAdminSession(token) {
    await getAdminSessions().updateOne(
        { _id: ACTIVE_ADMIN_SESSION_ID },
        { $set: { tokenHash: hashSessionToken(token), activatedAt: new Date() } },
        { upsert: true }
    );
}

async function isCurrentAdminSession(req) {
    if (!req.session || !req.session.isAdmin || !req.session.adminSessionToken) return false;
    const record = await getAdminSessions().findOne({
        _id: ACTIVE_ADMIN_SESSION_ID,
        tokenHash: hashSessionToken(req.session.adminSessionToken)
    }, { projection: { _id: 1 } });
    return Boolean(record);
}

async function revokeAdminSession(token) {
    if (!token) return;
    await getAdminSessions().deleteOne({
        _id: ACTIVE_ADMIN_SESSION_ID,
        tokenHash: hashSessionToken(token)
    });
}

/**
 * Constant-time string comparison to prevent timing-based enumeration attacks.
 * We always run the comparison regardless of length mismatch to avoid leaking
 * length information through early exits.
 */
function safeEqual(a, b) {
    try {
        const aBuf = Buffer.from(String(a));
        const bBuf = Buffer.from(String(b));
        if (aBuf.length !== bBuf.length) {
            // Execute a dummy compare so execution time stays constant
            crypto.timingSafeEqual(aBuf, aBuf);
            return false;
        }
        return crypto.timingSafeEqual(aBuf, bBuf);
    } catch {
        return false;
    }
}

/**
 * Validate admin credentials using constant-time comparison.
 * Returns true only when BOTH username AND password match.
 */
function validateCredentials(username, password) {
    const userMatch = safeEqual(username, ADMIN_USER);
    const passMatch = safeEqual(password, ADMIN_PASS);
    return userMatch && passMatch;
}

function getLoginAttemptKey(req) {
    return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function pruneFailedLoginAttempts(now) {
    for (const [key, attempt] of failedLoginAttempts) {
        if (attempt.expiresAt <= now) failedLoginAttempts.delete(key);
    }

    // Bound memory use if many distinct addresses hit the login endpoint.
    while (failedLoginAttempts.size > 10000) {
        failedLoginAttempts.delete(failedLoginAttempts.keys().next().value);
    }
}

function getLoginRateLimit(req) {
    const now = Date.now();
    pruneFailedLoginAttempts(now);
    const attempt = failedLoginAttempts.get(getLoginAttemptKey(req));
    if (!attempt || attempt.expiresAt <= now) return { limited: false, retryAfterSeconds: 0 };

    const limited = attempt.count >= MAX_FAILED_LOGIN_ATTEMPTS;
    return {
        limited,
        retryAfterSeconds: limited ? Math.max(1, Math.ceil((attempt.expiresAt - now) / 1000)) : 0
    };
}

function recordFailedLogin(req) {
    const now = Date.now();
    const key = getLoginAttemptKey(req);
    const attempt = failedLoginAttempts.get(key);
    if (!attempt || attempt.expiresAt <= now) {
        failedLoginAttempts.set(key, { count: 1, expiresAt: now + LOGIN_WINDOW_MS });
    } else {
        attempt.count += 1;
    }
    pruneFailedLoginAttempts(now);
}

function clearFailedLoginAttempts(req) {
    failedLoginAttempts.delete(getLoginAttemptKey(req));
}

function sendLoginRequired(req, res) {
    const wantsJson = req.originalUrl.startsWith('/admin/cars') ||
        req.originalUrl === '/admin/session' ||
        (req.headers.accept && req.headers.accept.includes('application/json'));

    if (wantsJson) {
        return res.status(401).json({ error: 'Unauthorised — admin session required.' });
    }
    return res.redirect('/admin/login');
}

function destroyStaleSession(req, res, response) {
    const complete = () => {
        res.clearCookie('av.sid', {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production'
        });
        response();
    };

    if (!req.session) return complete();
    req.session.destroy(err => {
        if (err) console.error('Failed to destroy stale admin session:', err.message);
        complete();
    });
}

/**
 * Express middleware — requires an active admin session.
 * Unauthenticated JSON consumers receive a 401 JSON response;
 * browser requests are redirected to the login page.
 */
async function requireAdmin(req, res, next) {
    const wantsJson = req.originalUrl.startsWith('/admin/cars') ||
        req.originalUrl === '/admin/session' ||
        (req.headers.accept && req.headers.accept.includes('application/json'));
    res.set('Cache-Control', 'no-store');

    try {
        if (await isCurrentAdminSession(req)) {
            return next();
        }
    } catch (err) {
        console.error('Admin session verification failed:', err.message);
        return res.status(503).send('Admin authentication is temporarily unavailable.');
    }

    return destroyStaleSession(req, res, () => sendLoginRequired(req, res));
}

module.exports = {
    requireAdmin,
    validateCredentials,
    createAdminSessionToken,
    activateAdminSession,
    isCurrentAdminSession,
    revokeAdminSession,
    getLoginRateLimit,
    recordFailedLogin,
    clearFailedLoginAttempts,
    destroyStaleSession,
    ADMIN_USER,
    ADMIN_PASS
};
