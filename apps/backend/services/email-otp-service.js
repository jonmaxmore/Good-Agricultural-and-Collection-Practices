'use strict';

/**
 * email-otp-service — issue + verify the 6-digit email OTP for the EMAIL 2FA
 * method (opt-in). The code lives ONLY in Redis (single-use, short TTL) — never
 * in the DB and never in a JWT. Mirrors the single-use Redis pattern in
 * token-revocation-service.js (issueMfaChallenge), but keyed per-user and
 * carrying a hashed code + attempt counter.
 *
 * Flow: the login surface mints the JWT mfa_session (method='EMAIL') AND calls
 * issueEmailOtp() to email the code; POST /api/mfa/verify then calls
 * verifyEmailOtp() with the submitted code before completing the session.
 *
 * NOT used for TOTP (that stays in mfaService.verifyTOTP against twoFactorSecret).
 */

const crypto = require('crypto');
const redisService = require('./redis-service');
const emailService = require('./email-service');
const logger = require('../shared/logger');

const OTP_PREFIX = 'auth:mfa-email-otp:';
const OTP_TTL_SECONDS = 300;        // 5-minute validity (matches the JWT challenge)
const MAX_ATTEMPTS = 5;             // verify attempts before the code is burned
const REISSUE_MIN_INTERVAL_MS = 30000; // anti email-bomb: 1 new code / 30s / user

function hashCode(code) {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function timingSafeEqualHex(a, b) {
    const ba = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    if (ba.length !== bb.length) { return false; }
    return crypto.timingSafeEqual(ba, bb);
}

/**
 * Generate, store (hashed) and email a 6-digit OTP for `userId`.
 * @param {string} userId
 * @param {string} email  the account's on-file address (REQUIRED — an EMAIL-2FA
 *                        account with no email would be a permanent lockout, so
 *                        the enrollment guard ensures one exists)
 * @param {number} [now]  injectable clock (ms) for tests
 * @returns {Promise<{ ok: boolean, reason?: string, retryAfterMs?: number, mocked?: boolean }>}
 */
async function issueEmailOtp(userId, email, now = Date.now()) {
    if (!userId) { throw new Error('userId is required to issue an email OTP'); }
    if (!email) { return { ok: false, reason: 'NO_EMAIL' }; }

    const key = `${OTP_PREFIX}${userId}`;

    // Anti email-bomb: refuse a new code within the re-issue window.
    try {
        const existing = await redisService.get(key);
        if (existing && existing.issuedAt && (now - existing.issuedAt) < REISSUE_MIN_INTERVAL_MS) {
            return { ok: false, reason: 'THROTTLED', retryAfterMs: REISSUE_MIN_INTERVAL_MS - (now - existing.issuedAt) };
        }
    } catch (err) {
        logger.warn('[email-otp] re-issue throttle lookup failed', { error: err.message });
    }

    // 6-digit, uniformly random, zero-padded.
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const stored = await redisService.set(key, { codeHash: hashCode(code), attempts: 0, issuedAt: now }, OTP_TTL_SECONDS);
    if (stored === false) {
        // Redis unavailable → the code was NOT persisted, so the user could never
        // verify it. Do NOT email a dead code; surface the failure so callers
        // (enroll → error; login → logger.error) don't hand out an unusable
        // challenge. (golden rule #3: a swallowed store-failure was a silent lockout.)
        logger.error('[email-otp] failed to store OTP (Redis unavailable) — not sending', { userId });
        return { ok: false, reason: 'STORE_FAILED' };
    }

    const sendResult = await emailService.sendMfaOtp(email, code);
    if (sendResult && sendResult.mocked) {
        // Email delivery is mocked (EMAIL_ENABLED!=='true' / no SMTP) — the user
        // will NOT receive a code. Surface it so the caller / ops know.
        logger.warn('[email-otp] OTP email is MOCKED (EMAIL_ENABLED off / no SMTP) — code not delivered', { userId });
        // STAGING DEBUG (no SMTP needed): echo the plaintext code to the log so a
        // tester can complete the enroll/login flow without an inbox. Double-gated
        // and prod-safe by construction:
        //   1) this branch is reached ONLY when delivery is mocked, i.e.
        //      EMAIL_ENABLED!=='true' — so on prod (EMAIL_ENABLED=true) it is
        //      unreachable and NO code is ever logged, even if the flag is set;
        //   2) MFA_OTP_DEV_ECHO must be explicitly 'true' (off by default);
        //   3) PENTEST H2 — NODE_ENV must NOT be 'production'. Gate (1) alone
        //      collapses if email is ever unconfigured/outaged on prod (mock
        //      branch reached), so make plaintext-OTP logging STRUCTURALLY
        //      impossible in production regardless of the email/flag state.
        // NEVER set MFA_OTP_DEV_ECHO on production.
        if (process.env.NODE_ENV !== 'production' && process.env.MFA_OTP_DEV_ECHO === 'true') {
            logger.warn(`[email-otp] DEV ECHO (mocked delivery — staging only) userId=${userId} code=${code}`);
        }
        return { ok: true, mocked: true };
    }
    logger.info('[email-otp] OTP issued + emailed', { userId });
    return { ok: true };
}

/**
 * Verify a submitted OTP for `userId`. Single-use; attempt-capped.
 *
 * NEVER returns ok:true when the store cannot be read. A missing store makes
 * a code invalid (annoying); it must never make one valid (catastrophic).
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 *   reason: 'EXPIRED' (no/expired code) | 'TOO_MANY' (attempt cap) | 'INVALID'
 *         | 'STORE_UNAVAILABLE' (Redis unreachable — retryable, NOT the
 *           user's fault, and deliberately distinct from 'EXPIRED' so the
 *           route does not tell the user to request a code that also cannot
 *           be stored)
 */
async function verifyEmailOtp(userId, code) {
    if (!userId || !code) { return { ok: false, reason: 'INVALID' }; }
    const key = `${OTP_PREFIX}${userId}`;

    let entry;
    try {
        // getStrict: the OTP store IS the verification. With `get`, a Redis
        // outage returned null and we reported 'EXPIRED' — an honest-sounding
        // answer to a question we never actually asked. The verdict was
        // already fail-closed by accident (no entry => no pass), but the user
        // was told to request a new code that also could not be stored, and
        // operators saw a spike of "expired" instead of an outage.
        entry = await redisService.getStrict(key);
    } catch (err) {
        // The store could not answer. The code is NOT accepted (never a pass),
        // and the reason is distinct from EXPIRED so the route can render an
        // honest, retryable message instead of sending the user in a loop.
        logger.error('[email-otp] verify lookup failed (store unavailable) — treating code as unverifiable', { error: err.message });
        return { ok: false, reason: 'STORE_UNAVAILABLE' };
    }
    if (!entry || !entry.codeHash) { return { ok: false, reason: 'EXPIRED' }; }

    const attempts = (entry.attempts || 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
        await redisService.del(key); // burn the code after too many guesses
        return { ok: false, reason: 'TOO_MANY' };
    }

    if (!timingSafeEqualHex(hashCode(code), entry.codeHash)) {
        // Persist the incremented attempt counter (preserve the remaining TTL).
        const remainingTtl = entry.issuedAt
            ? Math.max(1, Math.ceil((OTP_TTL_SECONDS * 1000 - (Date.now() - entry.issuedAt)) / 1000))
            : OTP_TTL_SECONDS;
        await redisService.set(key, { ...entry, attempts }, remainingTtl);
        return { ok: false, reason: 'INVALID' };
    }

    await redisService.del(key); // single-use
    return { ok: true };
}

module.exports = { issueEmailOtp, verifyEmailOtp, OTP_TTL_SECONDS, MAX_ATTEMPTS };
