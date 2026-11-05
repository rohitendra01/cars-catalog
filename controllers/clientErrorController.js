const { logClientError, sanitize } = require('../utils/logger');

const allowedEvents = new Set([
    'runtime_error', 'unhandled_rejection', 'resource_error',
    'home.google_reviews.load_failed', 'lead.submit_failed', 'reservation.submit_failed',
    'admin.cars.list_failed', 'admin.stats.load_failed', 'admin.car.load_failed',
    'admin.car.save_network_failed', 'admin.car.delete_failed', 'admin.session.check_failed'
]);
const reportsByIp = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 20;

function allowReport(ip) {
    const now = Date.now();
    let bucket = reportsByIp.get(ip);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + WINDOW_MS };
        reportsByIp.set(ip, bucket);
    }
    if (reportsByIp.size > 5000) {
        for (const [key, value] of reportsByIp) {
            if (value.resetAt <= now) reportsByIp.delete(key);
        }
    }
    bucket.count += 1;
    return bucket.count <= MAX_REPORTS_PER_WINDOW;
}

function cleanSource(value) {
    const source = sanitize(value, 600);
    try {
        return new URL(source, 'http://local.invalid').pathname.slice(0, 400);
    } catch (error) {
        return source.split(/[?#]/, 1)[0].slice(0, 400);
    }
}

exports.postClientError = (req, res) => {
    if (!allowReport(req.ip || 'unknown')) return res.sendStatus(204);

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const event = allowedEvents.has(body.event) ? body.event : 'runtime_error';
    const rawErrorName = sanitize(body.errorName || 'Error', 80);
    const errorName = /^[A-Za-z0-9_.-]+$/.test(rawErrorName) ? rawErrorName : 'Error';

    logClientError(req, {
        event,
        errorName,
        source: cleanSource(body.source),
        line: Number(body.line),
        column: Number(body.column)
    });

    res.sendStatus(204);
};
