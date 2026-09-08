/**
 * Security Rate Limiting Middleware
 * Prevents brute force attacks on authentication endpoints
 *
 * Uses Redis for distributed rate limiting across server instances.
 * Falls back to in-memory Map when Redis is unavailable.
 */

const { getRequestIp } = require('../utils/client-ip');
const logger = require('../shared/logger');

// Try to load Redis client (graceful fallback)
let redis = null;
try {
    redis = require('../config/redis');
} catch {
    logger.warn('[RateLimit] Redis not available — using in-memory fallback');
}

// In-memory fallback store (used when Redis is down)
const memoryStore = new Map();

// Clean up expired in-memory entries every 5 minutes.
// Skipped in test mode — a module-level setInterval keeps Jest workers from
// exiting gracefully and triggers "worker failed to exit gracefully" warnings
// in combined unit+integration runs. Tests that exercise the cleanup path
// directly can call cleanupMemoryStore() explicitly.
let _cleanupInterval = null;
function cleanupMemoryStore() {
    const now = Date.now();
    for (const [key, data] of memoryStore.entries()) {
        if (now > data.resetTime) {
            memoryStore.delete(key);
        }
    }
}
if (process.env.NODE_ENV !== 'test') {
    _cleanupInterval = setInterval(cleanupMemoryStore, 5 * 60 * 1000);
    // Don't keep the event loop alive on a clean shutdown.
    if (_cleanupInterval && typeof _cleanupInterval.unref === 'function') {
        _cleanupInterval.unref();
    }
}

function stopCleanupInterval() {
    if (_cleanupInterval) {
        clearInterval(_cleanupInterval);
        _cleanupInterval = null;
    }
}

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {string} options.message - Error message
 */
function createRateLimiter(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes default
        max = 5, // 5 attempts default
        message = 'Too many attempts, please try again later',
        // Optional custom bucket key (DTAM Next partner integration): return a
        // string to bucket by (e.g. partner id) or a falsy value to fall back
        // to the default ip+path key. Lets an authenticated partner get its
        // own quota instead of sharing a NAT/proxy IP budget.
        keyGenerator = null,
    } = options;

    // TTL in seconds for Redis
    const _ttlSeconds = Math.ceil(windowMs / 1000);

    return async (req, res, next) => {
        const ip = getRequestIp(req);
        const customKey = typeof keyGenerator === 'function' ? keyGenerator(req) : null;
        const key = customKey ? `ratelimit:${customKey}` : `ratelimit:${ip}:${req.path}`;
        const now = Date.now();

        let count = 0;
        let resetTime = now + windowMs;

        // Try Redis first, fallback to memory
        if (redis && redis.status === 'ready') {
            try {
                const pipeline = redis.pipeline();
                pipeline.incr(key);
                pipeline.pttl(key);
                const results = await pipeline.exec();

                count = results[0][1]; // INCR result
                const pttl = results[1][1]; // PTTL result

                // Set expiry on first request
                if (pttl < 0) {
                    await redis.pexpire(key, windowMs);
                    resetTime = now + windowMs;
                } else {
                    resetTime = now + pttl;
                }
            } catch {
                // Redis failed — fall through to memory
                count = 0;
            }
        }

        // Memory fallback
        if (count === 0) {
            let record = memoryStore.get(key);
            if (!record || now > record.resetTime) {
                record = { count: 1, resetTime: now + windowMs };
                memoryStore.set(key, record);
            } else {
                record.count++;
            }
            count = record.count;
            resetTime = record.resetTime;
        }

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

        // Check if exceeded
        if (count > max) {
            logger.warn(`[SECURITY] Rate limit exceeded for ${ip} on ${req.path}`);
            return res.status(429).json({
                success: false,
                error: 'Too Many Requests',
                message,
                retryAfterSeconds: Math.ceil((resetTime - now) / 1000),
            });
        }

        next();
    };
}

// Pre-configured limiters
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts
    message: 'Too many login attempts, please try again in 15 minutes',
});

const registrationLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour
    message: 'Too many registration attempts, please try again later',
});

const apiLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'API rate limit exceeded',
});

const paymentLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 payment attempts per 5 min
    message: 'Too many payment attempts, please try again later',
});

module.exports = {
    createRateLimiter,
    authLimiter,
    registrationLimiter,
    apiLimiter,
    paymentLimiter,
    // Cleanup hooks for tests / graceful shutdown.
    cleanupMemoryStore,
    stopCleanupInterval,
};
