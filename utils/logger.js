const { randomUUID } = require('crypto');

function sanitize(value, maximumLength = 1000) {
    return String(value == null ? '' : value)
        .replace(/(mongodb(?:\+srv)?:\/\/)[^\s]+/gi, '$1[redacted]')
        .replace(/\b(password|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
        .replace(/[\r\n\t]+/g, ' ')
        .slice(0, maximumLength);
}

function routeName(req) {
    if (!req) return undefined;
    const path = req.route && req.route.path;
    if (path) return `${req.baseUrl || ''}${Array.isArray(path) ? path.join('|') : path}`;
    return sanitize(req.path || '/', 200);
}

function errorDetails(error) {
    if (error == null) return { name: 'Error', message: 'Unknown error' };
    const name = error.name || (error.constructor && error.constructor.name) || 'Error';
    const details = {
        name: sanitize(name, 100),
        message: sanitize(error.message == null ? error : error.message)
    };
    if (typeof error.code === 'string' || typeof error.code === 'number') {
        details.code = error.code;
    }
    if ((process.env.LOG_STACKS === 'true' || process.env.NODE_ENV !== 'production') && error.stack) {
        details.stack = sanitize(error.stack, 4000);
    }
    return details;
}

function write(level, event, fields = {}) {
    const record = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...fields
    };
    const output = JSON.stringify(record);
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
}

function requestContext(req, res, next) {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
}

function logError(event, error, req, details = {}) {
    write('error', event, {
        requestId: req && req.requestId,
        method: req && req.method,
        route: routeName(req),
        error: errorDetails(error),
        ...details
    });
}

function logWarning(event, message, req, details = {}) {
    write('warn', event, {
        requestId: req && req.requestId,
        method: req && req.method,
        route: routeName(req),
        message: sanitize(message),
        ...details
    });
}

function logRequestFailures(req, res, next) {
    const startedAt = Date.now();
    let finished = false;
    res.once('finish', () => {
        finished = true;
        if (res.statusCode < 400) return;
        write(res.statusCode >= 500 ? 'error' : 'warn', 'http.request_failed', {
            requestId: req.requestId,
            method: req.method,
            route: routeName(req),
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt
        });
    });
    res.once('close', () => {
        if (finished) return;
        write('warn', 'http.request_aborted', {
            requestId: req.requestId,
            method: req.method,
            route: routeName(req),
            durationMs: Date.now() - startedAt
        });
    });
    next();
}

function logClientError(req, report) {
    write('error', 'browser.client_error', {
        requestId: req && req.requestId,
        method: req && req.method,
        route: routeName(req),
        clientEvent: sanitize(report.event, 80),
        errorName: sanitize(report.errorName || 'Error', 80),
        message: 'Client-side failure reported; detailed browser messages remain in the browser console.',
        source: sanitize(report.source || '', 400),
        line: Number.isInteger(report.line) && report.line > 0 ? report.line : undefined,
        column: Number.isInteger(report.column) && report.column > 0 ? report.column : undefined
    });
}

module.exports = {
    errorDetails,
    logClientError,
    logError,
    logRequestFailures,
    logWarning,
    requestContext,
    sanitize
};
