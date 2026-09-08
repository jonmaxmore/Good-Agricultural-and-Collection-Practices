/**
 * Input INSPECTION middleware — it observes, it does not rewrite.
 *
 * This used to STRIP matched patterns out of every string in every request body,
 * query and param. Measured 2026-09-08 by running it against text a Thai user or
 * officer can plausibly write (evidence/api-db-audit-2026-09-08):
 *
 *   "สวนพงษ์ภูวนาท -- แปลงที่ 1"          ->  "สวนพงษ์ภูวนาท แปลงที่ 1"
 *   "onsite=ตรวจแล้ว"                     ->  "ตรวจแล้ว"            <- the word vanished
 * and a fertiliser note wrapped in C-style comment delimiters lost the whole
 * note, keeping only "ปุ๋ยสูตร 15-15-15 ". (The exact third string cannot be
 * written inside this block comment; it is in the test, verbatim.)
 *
 * `/on\w+\s*=/` exists to catch `onclick=` and matches ANY English word starting
 * with "on" followed by "="; the SQL-comment patterns are meaningless against
 * Prisma's parameterised queries and ate ordinary parentheticals. No error was
 * raised and no warning shown — the user was told the save succeeded. That is
 * silent data corruption on a government registry.
 *
 * OPERATOR RULING 2026-09-08: "ปล่อยผ่านแล้ว escape ตอนแสดงผล" — pass the input
 * through, escape where it is rendered. Verified before the change that every
 * render path already escapes:
 *   - React escapes by default. The two `dangerouslySetInnerHTML` call sites that
 *     carry applicant data render HTML produced by
 *     services/pdf/katorlor1-template-service.js, which escapes & < > at :46-48
 *     under the comment "Everything applicant-supplied is escaped."
 *   - services/pdf/pdf-generator.service.js escapes /[&<>"']/g when substituting
 *     {{...}} into every PDF template.
 *   - Prisma parameterises every query, so the SQL patterns guarded nothing.
 *
 * What is KEPT: the detection and the warning log. Knowing that someone posted a
 * script tag is useful; quietly editing their farm name is not. Guarded by
 * __tests__/unit/input-survives-the-round-trip.test.js, which pins both halves —
 * ordinary text survives here, and the escaping that now carries the whole load
 * stays in place there.
 *
 * @module middleware/sanitize-input
 */

const logger = require('../shared/logger');
const { getRequestIp } = require('../utils/client-ip');

// Patterns that indicate XSS or injection attempts
const DANGEROUS_PATTERNS = [
    /<script\b[^>]*>/gi,        // Script tags
    /javascript\s*:/gi,          // javascript: URI
    /on\w+\s*=/gi,               // Event handlers (onclick=, onerror=, etc.)
    /data\s*:\s*text\/html/gi,   // Data URIs with HTML
    /vbscript\s*:/gi,            // VBScript URI
    /expression\s*\(/gi,         // CSS expression()
];

// SQL injection patterns (beyond parameterized queries — defense in depth)
const SQL_PATTERNS = [
    /;\s*(DROP|ALTER|TRUNCATE|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\s/gi,
    /UNION\s+(ALL\s+)?SELECT/gi,
    /\/\*[\s\S]*?\*\//g,         // SQL comments
    /--\s/g,                     // SQL line comments
];

/**
 * Recursively sanitize a value.
 * - Strings: strip dangerous patterns
 * - Objects/Arrays: recurse into children
 * - Primitives: pass through unchanged
 */
function sanitizeValue(value, path = '', detections = []) {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'string') {
        // RECORD, do not rewrite. The string is returned exactly as it arrived; the
        // only effect of a match is a line in the warning log below.
        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(value)) {
                detections.push({ path, pattern: pattern.source, type: 'XSS' });
            }
            pattern.lastIndex = 0;   // global regexes carry state between .test() calls
        }

        for (const pattern of SQL_PATTERNS) {
            if (pattern.test(value)) {
                detections.push({ path, pattern: pattern.source, type: 'SQL_INJECTION' });
            }
            pattern.lastIndex = 0;
        }

        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`, detections));
    }

    if (typeof value === 'object') {
        const sanitized = {};
        for (const [key, val] of Object.entries(value)) {
            sanitized[key] = sanitizeValue(val, path ? `${path}.${key}` : key, detections);
        }
        return sanitized;
    }

    // Numbers, booleans, etc. pass through
    return value;
}

/**
 * Express middleware that INSPECTS req.body, req.query and req.params.
 * Logs a warning for anything that looks like an injection attempt; changes nothing.
 *
 * req.params is walked alongside body and query. It was added when this
 * middleware still rewrote values, on the argument that a path parameter could
 * carry a payload into code that interpolates strings. That argument is now
 * answered where the interpolation happens rather than here — see the module
 * docblock for the list of render boundaries and their tests — but the WALK is
 * still worth keeping: a hostile /:farmId is exactly the thing an operator wants
 * to see in the log.
 */
function sanitizeInput(req, _res, next) {
    const detections = [];

    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body, 'body', detections);
    }

    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeValue(req.query, 'query', detections);
    }

    // Sanitize path parameters. Express populates req.params as a plain object
    // of string values; we sanitize in-place so downstream route handlers see
    // clean values. IDs (UUIDs, numeric sequences) survive intact — the patterns
    // only strip HTML/JS/SQL injection tokens.
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeValue(req.params, 'params', detections);
    }

    if (detections.length > 0) {
        logger.warn('[Sanitize] Suspicious input observed (stored as sent; escaping happens at render)', {
            ip: getRequestIp(req),
            method: req.method,
            url: req.originalUrl,
            detections: detections.slice(0, 10), // Limit logged detections
        });
    }

    next();
}

module.exports = { sanitizeInput, sanitizeValue };
