/**
 * The last word under /api — a JSON one.
 *
 * Measured on the running demo backend 2026-09-08: nothing caught an unmatched
 * /api path, so the request fell through to Express's default finalhandler and
 * came back as an HTML error page (~1.1 KB, and on that host carrying an
 * injected Cloudflare challenge script). Every JSON client — the web app's
 * api-client, an integrating ministry, a generated SDK — received a document it
 * could not parse:
 *
 *   GET    /api/plots            404 "<!DOCTYPE html>…"
 *   DELETE /api/applications/my  404 "<!DOCTYPE html>…"   ← the path exists for GET
 *
 * The second line is the sharper problem. 404 says "no such resource" when the
 * resource is fine and only the verb is wrong, so a client cannot tell a typo in
 * the path from a typo in the method. RFC 9110 §15.5.6 has a status for exactly
 * that — 405, with an `Allow` header naming the methods that do exist — and this
 * handler answers it by asking the router which verbs are registered for the
 * path before concluding the path is unknown.
 *
 * MOUNT ORDER MATTERS: this must come AFTER every /api router and BEFORE the
 * global error handler. Mounted earlier it would swallow real routes.
 *
 * Guarded by __tests__/integration/api-answers-json-not-html.test.js.
 */

const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/**
 * Which methods this Express app has actually registered for `pathname`.
 *
 * Walks the router stack rather than guessing. Returns [] when the path matches
 * no route at all, which is what separates 405 from 404.
 */
function methodsRegisteredFor(app, pathname) {
    const found = new Set();
    const router = app?._router || app?.router;
    const stack = router?.stack;
    if (!Array.isArray(stack)) { return []; }

    const walk = (layers, mountedAt) => {
        for (const layer of layers) {
            if (layer.route) {
                const full = joinPath(mountedAt, layer.route.path);
                if (pathMatches(full, pathname)) {
                    for (const [method, on] of Object.entries(layer.route.methods || {})) {
                        if (on) { found.add(method.toUpperCase()); }
                    }
                }
                continue;
            }
            const nested = layer.handle?.stack;
            if (Array.isArray(nested)) {
                walk(nested, joinPath(mountedAt, mountPathOf(layer)));
            }
        }
    };

    try { walk(stack, ''); } catch { return []; }
    if (found.size > 0) { found.add('OPTIONS'); }
    return HTTP_METHODS.filter((m) => found.has(m));
}

/** Recover a router's mount path from its regexp — Express does not keep the string. */
function mountPathOf(layer) {
    const source = layer?.regexp?.source;
    if (!source || layer?.regexp?.fast_slash) { return ''; }
    const m = /^\^\\\/(?:\?\$|((?:[^\\]|\\.)*?)\\\/)/.exec(source);
    if (!m || !m[1]) { return ''; }
    return '/' + m[1].replace(/\\(.)/g, '$1');
}

function joinPath(a, b) {
    const left = String(a || '').replace(/\/+$/, '');
    const right = String(b || '');
    if (!right || right === '/') { return left || '/'; }
    return left + (right.startsWith('/') ? right : '/' + right);
}

/** Compare a registered route path (which may carry :params) with a concrete pathname. */
function pathMatches(routePath, pathname) {
    if (routePath === pathname) { return true; }
    const routeParts = routePath.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);
    if (routeParts.length !== pathParts.length) { return false; }
    return routeParts.every((part, i) => part.startsWith(':') || part === pathParts[i]);
}

function apiNotFoundHandler(req, res) {
    const pathname = req.originalUrl.split('?')[0];
    const allowed = methodsRegisteredFor(req.app, pathname);

    if (allowed.length > 0 && !allowed.includes(String(req.method).toUpperCase())) {
        res.set('Allow', allowed.join(', '));
        return res.status(405).json({
            success: false,
            code: 'METHOD_NOT_ALLOWED',
            error: 'Method Not Allowed',
            message: `${req.method} is not supported for this endpoint. Allowed: ${allowed.join(', ')}.`,
            messageTh: `ปลายทางนี้ไม่รองรับวิธี ${req.method} · ที่รองรับ: ${allowed.join(', ')}`,
            path: pathname,
            method: req.method,
            allow: allowed,
            requestId: req.id || null,
            timestamp: new Date().toISOString(),
        });
    }

    return res.status(404).json({
        success: false,
        code: 'ROUTE_NOT_FOUND',
        error: 'Not Found',
        message: `No route matches ${req.method} ${pathname}.`,
        messageTh: 'ไม่พบปลายทางนี้ในระบบ',
        path: pathname,
        method: req.method,
        requestId: req.id || null,
        timestamp: new Date().toISOString(),
    });
}

module.exports = { apiNotFoundHandler, methodsRegisteredFor };
