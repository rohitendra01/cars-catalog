(function () {
    var recentReports = new Map();

    function cleanSource(value) {
        if (!value) return '';
        try {
            return new URL(String(value), window.location.href).pathname.slice(0, 400);
        } catch (error) {
            return String(value).split(/[?#]/, 1)[0].slice(0, 400);
        }
    }

    function report(eventName, error, source, line, column) {
        var payload = {
            event: eventName,
            errorName: error && error.name ? String(error.name).slice(0, 80) : 'Error',
            source: cleanSource(source),
            line: Number(line) || 0,
            column: Number(column) || 0
        };
        var signature = [payload.event, payload.errorName, payload.source].join('|');
        var now = Date.now();
        if (recentReports.has(signature) && now - recentReports.get(signature) < 10000) return;
        recentReports.set(signature, now);
        if (recentReports.size > 100) {
            recentReports.forEach(function (time, key) {
                if (now - time >= 10000) recentReports.delete(key);
            });
        }

        var body = JSON.stringify(payload);
        if (navigator.sendBeacon && navigator.sendBeacon('/api/client-errors', new Blob([body], { type: 'application/json' }))) return;
        fetch('/api/client-errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true,
            credentials: 'same-origin'
        }).catch(function () {});
    }

    window.reportClientError = function (eventName, error) {
        var sourceError = error instanceof Error ? error : new Error(String(error || 'Client operation failed.'));
        var wrappedError = new Error('Client operation failed.');
        wrappedError.name = sourceError.name || 'Error';
        report(String(eventName || 'runtime_error').slice(0, 80), wrappedError, window.location.pathname);
    };

    window.addEventListener('error', function (event) {
        var target = event.target;
        if (target && target !== window) {
            var source = target.currentSrc || target.src || target.href || '';
            var tag = target.tagName ? String(target.tagName).toLowerCase() : 'resource';
            report('resource_error', new Error('Failed to load ' + tag + '.'), source);
            return;
        }
        report('runtime_error', event.error || new Error(event.message || 'Browser runtime error.'), event.filename, event.lineno, event.colno);
    }, true);

    window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        var error = reason instanceof Error ? reason : new Error('Unhandled promise rejection.');
        report('unhandled_rejection', error, window.location.pathname);
    });
})();
