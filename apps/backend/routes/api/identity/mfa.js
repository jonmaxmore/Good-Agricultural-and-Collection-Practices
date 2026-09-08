/**
 * MFA API Routes (V2)
 * For provider accounts (User model with providerId identity)
 * Prisma Implementation
 */

const express = require('express');
const router = express.Router();
const { mfaService } = require('../../../middleware/mfa-service');
// ยามของด่านลงทะเบียน: รับตั๋ว purpose='mfa_setup' ที่ประตูล็อกอินยื่นให้ หรือ session ปกติ
// ถ้าใช้ยามของ session อย่างเดียว คนที่ยังไม่ได้ลงทะเบียนจะไม่มีทางลงทะเบียนได้เลย
const { authenticateForMfaSetup } = require('../../../middleware/mfa-setup-guard');
const { auditLogger, AuditCategory } = require('../../../middleware/audit-logger');
const identityService = require('../../../services/identity-service');
const { getRequestIp } = require('../../../utils/client-ip');
const { isSecureCookie } = require('../../../utils/cookie-security');
const { computeMfaChallengeBinding, isMfaChallengeBindingEnforced } = require('../../../shared/mfa-challenge-binding');
const logger = require('../../../shared/logger');

// Middleware to ensure user is provider
const { authenticateProvider, authenticateAny } = require('../../../middleware/auth-middleware');
const redisService = require('../../../services/redis-service');
const { createRateLimiter } = require('../../../middleware/rate-limiter');

// Rate limiters — defined here so they are in scope for every route below.
// 5/15min per IP on the verification + state-change surfaces (mirrors /verify).
const mfaVerifyLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many MFA verification attempts. Please try again in 15 minutes.',
});
// Anti-email-bomb: /email/setup emails a real OTP to the on-file address and is
// reachable by both portals via authenticateAny. Cap per IP so a held session
// cannot spray a victim's inbox — the 30s service-level throttle fails OPEN on a
// Redis outage, whereas this route limiter degrades to in-memory, not off.
const mfaEmailSendLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many verification-code requests. Please wait a few minutes and try again.',
});

/**
 * Map an email-OTP verification failure onto its HTTP response.
 *
 * Extracted from the /verify handler (W1-5, 2026-08-22) so the mapping —
 * in particular the STORE_UNAVAILABLE branch, which is only reachable during
 * a Redis outage and therefore impossible to hit in a route test — has a
 * direct regression guard. Exported as `_mapOtpFailure`.
 *
 * The failure is ALWAYS a failure: no branch here can produce a success.
 * A store that cannot answer makes the code unverifiable, and unverifiable
 * means not accepted.
 *
 * Thai copy follows DESIGN.md: address the user as คุณ, no em dash, and an
 * error names its cause and the next action. STORE_UNAVAILABLE deliberately
 * does NOT say the code is wrong — we do not know that — and does not tell
 * the user to request a new code, because during an outage a new code cannot
 * be stored either.
 *
 * @param {string|null} reason  'EXPIRED' | 'TOO_MANY' | 'STORE_UNAVAILABLE' |
 *                              'INVALID' | null (non-OTP methods)
 * @returns {{ status: number, body: object }}
 */
function mapOtpFailure(reason) {
    if (reason === 'EXPIRED') {
        return {
            status: 401,
            body: {
                success: false,
                error: 'Code expired',
                code: 'OTP_EXPIRED',
                errorTh: 'รหัส OTP หมดอายุ กรุณาขอรหัสใหม่',
            },
        };
    }
    if (reason === 'TOO_MANY') {
        return {
            status: 429,
            body: {
                success: false,
                error: 'Too many attempts',
                code: 'OTP_TOO_MANY',
                errorTh: 'กรอกรหัสผิดเกินกำหนด กรุณาขอรหัสใหม่',
            },
        };
    }
    if (reason === 'STORE_UNAVAILABLE') {
        // 503, not 401: the credential was not rejected, it could not be
        // checked. Retryable, and the client should not burn an attempt or
        // push the user into a re-issue loop.
        return {
            status: 503,
            body: {
                success: false,
                error: 'Verification store unavailable, please try again shortly',
                code: 'MFA_STORE_UNAVAILABLE',
                errorTh: 'ระบบยืนยันรหัสไม่พร้อมใช้งานชั่วคราว จึงยังตรวจสอบรหัสของคุณไม่ได้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
            },
        };
    }
    return {
        status: 401,
        body: {
            success: false,
            error: 'Invalid code',
            errorTh: 'รหัส MFA ไม่ถูกต้อง',
        },
    };
}

/**
 * GET /status
 * Read-only check: does the current provider have MFA enabled?
 * Used by the security settings page so it can render either the
 * "enable" CTA or the "disable" form without first calling /setup
 * (which would overwrite an in-progress secret).
 */
// authenticateAny: both portals (health + provider) can read/manage their 2FA.
router.get('/status', authenticateAny, async (req, res) => {
    try {
        const user = await identityService.getMfaStatus(req.user.id);
        res.json({
            success: true,
            data: { enabled: Boolean(user?.twoFactorEnabled), hasEmail: Boolean(user?.email) },
        });
    } catch (error) {
        logger.error('[MFA] Status error:', error);
        res.status(500).json({ success: false, error: 'Status read failed' });
    }
});

/**
 * POST /setup
 * Initialize MFA setup for provider user
 */
router.post('/setup', authenticateForMfaSetup, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;

        // Generate new secret
        const secret = mfaService.generateSecret();
        const qrCodeUri = mfaService.generateQRCodeUri(secret, email);

        // Store secret temporarily (not yet verified)
        await identityService.storePendingTotpSecret(userId, secret);

        // Log MFA setup initiation
        await auditLogger.log({
            category: AuditCategory.SECURITY,
            action: 'MFA_SETUP_INITIATED',
            actorId: userId,
            actorRole: req.user.role,
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: getRequestIp(req),
            userAgent: req.headers['user-agent'],
        });

        res.json({
            success: true,
            data: {
                secret,
                qrCodeUri,
                message: 'Scan QR code with authenticator app, then verify with a code',
            },
        });
    } catch (error) {
        logger.error('[MFA] Setup error:', error);
        res.status(500).json({ success: false, error: 'Setup failed' });
    }
});

/**
 * POST /verify-setup
 * Verify MFA setup with first code
 */
router.post('/verify-setup', authenticateForMfaSetup, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;

        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid code format',
            });
        }

        // Get stored secret
        const user = await identityService.findPendingTotpSecret(userId);

        if (!user?.twoFactorSecret) {
            return res.status(400).json({
                success: false,
                error: 'MFA not initialized. Please start setup first.',
            });
        }

        // Verify code
        const isValid = mfaService.verifyTOTP(user.twoFactorSecret, code);

        if (!isValid) {
            await auditLogger.log({
                category: AuditCategory.SECURITY,
                action: 'MFA_SETUP_FAILED',
                actorId: userId,
                actorRole: req.user.role,
                resourceType: 'USER',
                resourceId: userId,
                ipAddress: getRequestIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { reason: 'Invalid verification code' },
            });

            return res.status(400).json({
                success: false,
                error: 'Invalid code. Please try again.',
            });
        }

        // Generate backup codes
        const backupCodes = mfaService.generateBackupCodes();
        const hashedCodes = backupCodes.map(code => mfaService.hashBackupCode(code));

        // Enable MFA. The Prisma `twoFactorBackupCodes` column is `Json`,
        // so write the native array directly (Tier 2 HIGH-1 fix). The
        // legacy `JSON.stringify(hashedCodes)` double-serialized — Postgres
        // would store a JSON-encoded string of a JSON array, breaking the
        // `JSON.parse(...).indexOf(hashedInput)` lookup in /verify.
        await identityService.enableMfaWithBackupCodes(userId, hashedCodes);

        // Log success
        await auditLogger.log({
            category: AuditCategory.SECURITY,
            action: 'MFA_ENABLED',
            actorId: userId,
            actorRole: req.user.role,
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: getRequestIp(req),
            userAgent: req.headers['user-agent'],
        });

        res.json({
            success: true,
            data: {
                message: 'MFA enabled successfully',
                backupCodes, // Show once only!
                warning: 'Save these backup codes securely. They will not be shown again.',
            },
        });
    } catch (error) {
        logger.error('[MFA] Verify setup error:', error);
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

/**
 * POST /email/setup
 * Start EMAIL-OTP 2FA enrollment (opt-in): email a 6-digit code to the account's
 * on-file address. REQUIRES an email — an EMAIL-2FA account with no email would be
 * a permanent lockout (mirrors the password-reset 'no email on file' guard).
 */
router.post('/email/setup', mfaEmailSendLimiter, authenticateAny, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'No email on file. Please add a verified email before enabling email 2FA.',
            });
        }
        const emailOtpService = require('../../../services/email-otp-service');
        const r = await emailOtpService.issueEmailOtp(userId, email);
        if (!r.ok) {
            return res.status(429).json({
                success: false,
                error: r.reason === 'THROTTLED' ? 'Please wait a moment before requesting another code.' : 'Could not send the code.',
            });
        }
        return res.json({ success: true, data: { message: 'A verification code has been emailed.', mocked: r.mocked === true } });
    } catch (error) {
        logger.error('[MFA] email setup error:', error);
        return res.status(500).json({ success: false, error: 'Setup failed' });
    }
});

/**
 * POST /email/verify-setup
 * Confirm the emailed code and ENABLE EMAIL-OTP 2FA (issues backup codes, once).
 */
router.post('/email/verify-setup', authenticateAny, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;
        if (!code) {
            return res.status(400).json({ success: false, error: 'Verification code required' });
        }
        const emailOtpService = require('../../../services/email-otp-service');
        const r = await emailOtpService.verifyEmailOtp(userId, code);
        if (!r.ok) {
            await auditLogger.log({
                category: AuditCategory.SECURITY,
                action: 'MFA_SETUP_FAILED',
                actorId: userId,
                actorRole: req.user.role,
                resourceType: 'USER',
                resourceId: userId,
                ipAddress: getRequestIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { method: 'EMAIL', reason: r.reason },
            });
            return res.status(400).json({ success: false, error: 'Invalid or expired code. Please try again.' });
        }
        const backupCodes = mfaService.generateBackupCodes();
        const hashedCodes = backupCodes.map(c => mfaService.hashBackupCode(c));
        await identityService.enableEmailMfa(userId, hashedCodes);
        await auditLogger.log({
            category: AuditCategory.SECURITY,
            action: 'MFA_ENABLED',
            actorId: userId,
            actorRole: req.user.role,
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: getRequestIp(req),
            userAgent: req.headers['user-agent'],
            metadata: { method: 'EMAIL' },
        });
        return res.json({
            success: true,
            data: {
                message: 'Email 2FA enabled successfully',
                backupCodes, // Show once only!
                warning: 'Save these backup codes securely. They will not be shown again.',
            },
        });
    } catch (error) {
        logger.error('[MFA] email verify-setup error:', error);
        return res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

/**
 * POST /verify
 * Verify MFA code during login and complete authentication.
 * Accepts a signed mfa_session token (not raw userId) for security.
 * On success, issues full auth JWT tokens + sets cookies.
 * Rate limited: 5 attempts per 15 minutes per IP
 */
const jwtConfig = require('../../../config/jwt-security');
const { normalizeRole, isProviderRole } = require('../../../shared/canonical-rbac');

router.post('/verify', mfaVerifyLimiter, async (req, res) => {
    try {
        const { mfa_session, code, isBackupCode } = req.body;

        // Phase 2 #2.13: the legacy `userId` body field is no longer
        // accepted. Before this commit, callers could bypass the signed
        // mfa_session token by sending a plaintext userId — an MFA bypass
        // for any client that knew the target user's ID. The signed
        // session token (purpose='mfa_challenge', short TTL, audience-
        // bound to provider/public) is now the only path.
        let userId;
        let challengeBind = null;
        let challengeMethod = null; // 'TOTP' | 'EMAIL' from the JWT challenge (decoded.method)
        let challengeJti = null;    // single-use key (M-2 replay guard)
        let challengeExp = null;    // unix seconds — bounds the jti's Redis TTL

        if (!mfa_session || typeof mfa_session !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'MFA session token is required. Please log in again.',
                errorTh: 'ต้องการ MFA session token กรุณาเข้าสู่ระบบใหม่',
            });
        }
        // Type-guard the code up front: a non-string (e.g. {} or number) would
        // otherwise reach hashBackupCode(code).replace()/verifyTOTP and throw a
        // 500 instead of a clean 400 (no bypass — no token is issued on bad input).
        if (code !== undefined && code !== null && typeof code !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Verification code must be a string',
                errorTh: 'รหัสยืนยันไม่ถูกต้อง',
            });
        }

        // Verify the signed MFA session token. Provider audience first,
        // then public. Mismatched purpose / expired / wrong audience all
        // surface as 401 — never a soft fallback.
        try {
            let decoded;
            try {
                decoded = jwtConfig.verifyToken(mfa_session, 'provider');
            } catch {
                decoded = jwtConfig.verifyToken(mfa_session, 'public');
            }

            if (decoded.purpose !== 'mfa_challenge') {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid MFA session token',
                });
            }

            // Enforce JTI on the MFA challenge token. This verifies the token
            // directly rather than through the central middleware, so it needs
            // its own jti check to keep the revocation gate consistent. Honour
            // the LEGACY_NO_JTI_GRACE_UNTIL rollout window.
            const jti = decoded && typeof decoded.jti === 'string' ? decoded.jti.trim() : '';
            if (!jti) {
                const graceRaw = process.env.LEGACY_NO_JTI_GRACE_UNTIL;
                const graceUntil = graceRaw ? Date.parse(String(graceRaw).trim()) : NaN;
                const inGrace = Number.isFinite(graceUntil) && Date.now() < graceUntil;
                if (!inGrace) {
                    return res.status(401).json({
                        success: false,
                        code: 'TOKEN_NO_JTI',
                        error: 'MFA session token missing JTI claim',
                        errorTh: 'โทเค็น MFA ไม่มี JTI claim กรุณาเข้าสู่ระบบใหม่',
                    });
                }
                console.warn(
                    `[AUTH] /mfa/verify accepting legacy mfa_session without jti during grace window ` +
                    `(until=${new Date(graceUntil).toISOString()}). Revocation cannot be enforced.`,
                );
            }

            userId = decoded.id;
            challengeBind = typeof decoded.bind === 'string' ? decoded.bind : null;
            challengeMethod = typeof decoded.method === 'string' ? decoded.method : null;
            challengeJti = jti || null;
            challengeExp = typeof decoded.exp === 'number' ? decoded.exp : null;
        } catch (_tokenError) {
            return res.status(401).json({
                success: false,
                error: 'MFA session expired. Please login again.',
                errorTh: 'เซสชัน MFA หมดอายุ กรุณาเข้าสู่ระบบใหม่',
            });
        }

        // AUTH-5: enforce the IP/User-Agent binding the challenge was issued
        // with. A mismatch means the mfa_session is being completed from a
        // different network/agent than the one that passed the password step —
        // the classic challenge-hijack signal. Legacy tokens minted before this
        // rollout carry no `bind` claim and pass through (they expire in 5 min);
        // enforcement can be relaxed via MFA_CHALLENGE_BIND_ENFORCE=false.
        if (challengeBind) {
            const expectedBind = computeMfaChallengeBinding(getRequestIp(req), req.headers['user-agent']);
            if (challengeBind !== expectedBind) {
                await auditLogger.log({
                    category: AuditCategory.SECURITY,
                    action: 'MFA_CHALLENGE_BINDING_MISMATCH',
                    actorId: userId,
                    actorRole: 'UNKNOWN',
                    resourceType: 'USER',
                    resourceId: userId,
                    ipAddress: getRequestIp(req),
                    userAgent: req.headers['user-agent'],
                    result: 'FAILURE',
                }).catch(() => {});
                if (isMfaChallengeBindingEnforced()) {
                    return res.status(401).json({
                        success: false,
                        code: 'MFA_CHALLENGE_BINDING_MISMATCH',
                        error: 'MFA session does not match this device or network. Please log in again.',
                        errorTh: 'เซสชัน MFA ไม่ตรงกับอุปกรณ์หรือเครือข่ายนี้ กรุณาเข้าสู่ระบบใหม่',
                    });
                }
                logger.warn('[AUTH] /mfa/verify binding mismatch (monitor mode — allowed)', { userId });
            }
        }

        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Verification code required',
            });
        }

        const user = await identityService.findUserForMfaVerify(userId);

        if (!user?.twoFactorEnabled) {
            return res.status(400).json({
                success: false,
                error: 'MFA not enabled for this user',
            });
        }

        let isValid = false;
        let otpFailReason = null;

        // Which factor to verify: the JWT challenge carries `method` (minted by
        // mintMfaChallengeToken); fall back to the user row, then TOTP for legacy.
        const method = challengeMethod || user.twoFactorMethod || 'TOTP';

        if (isBackupCode) {
            // Verify backup code. The column is Prisma `Json`, so Postgres
            // returns a native array. Defensive: if a legacy row still has
            // a JSON-encoded string from the pre-HIGH-1 writer, parse it.
            // Backup codes are shared across BOTH the TOTP and EMAIL methods.
            const hashedInput = mfaService.hashBackupCode(code);
            let backupCodes = user.twoFactorBackupCodes;
            if (typeof backupCodes === 'string') {
                try { backupCodes = JSON.parse(backupCodes); } catch { backupCodes = []; }
            }
            if (!Array.isArray(backupCodes)) {backupCodes = [];}
            const codeIndex = backupCodes.indexOf(hashedInput);

            if (codeIndex !== -1) {
                isValid = true;
                // Remove used backup code; write back as native array.
                backupCodes.splice(codeIndex, 1);
                await identityService.updateBackupCodes(userId, backupCodes);
            }
        } else if (method === 'EMAIL') {
            // Verify the emailed 6-digit OTP (single-use, attempt-capped, Redis).
            const emailOtpService = require('../../../services/email-otp-service');
            const r = await emailOtpService.verifyEmailOtp(userId, code);
            isValid = r.ok;
            // EXPIRED | TOO_MANY | INVALID | STORE_UNAVAILABLE.
            // STORE_UNAVAILABLE means Redis could not be read, so the code is
            // unverifiable — never accepted, and answered with a 503 rather
            // than "wrong code". See mapOtpFailure().
            if (!isValid) { otpFailReason = r.reason; }
        } else {
            // Verify TOTP (authenticator app). Guard the null-secret case: an
            // EMAIL-method user (twoFactorSecret=null) whose challenge somehow
            // routes here would otherwise hit verifyTOTP(null,…) → base32 decode
            // throws → 500. Return a clean 400 (still no bypass — isValid stays false).
            if (!user.twoFactorSecret) {
                return res.status(400).json({
                    success: false,
                    code: 'MFA_METHOD_MISMATCH',
                    error: 'MFA method mismatch. Please log in again.',
                    errorTh: 'วิธียืนยันตัวตนไม่ตรงกัน กรุณาเข้าสู่ระบบใหม่',
                });
            }
            isValid = mfaService.verifyTOTP(user.twoFactorSecret, code);
        }

        // Log attempt
        await auditLogger.log({
            category: AuditCategory.AUTHENTICATION,
            action: isValid ? 'MFA_VERIFY_SUCCESS' : 'MFA_VERIFY_FAILED',
            actorId: userId,
            actorRole: user.role,
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: getRequestIp(req),
            userAgent: req.headers['user-agent'],
            result: isValid ? 'SUCCESS' : 'FAILURE',
        });

        if (!isValid) {
            const failure = mapOtpFailure(otpFailReason);
            return res.status(failure.status).json(failure.body);
        }

        // M-2 (replay guard): single-use the challenge jti now that the code
        // verified. The mfa_session JWT is otherwise valid for its full ~5-min
        // TTL, and TOTP stays valid across its time window — so a captured
        // SUCCESSFUL /verify could be replayed to mint extra 8h sessions. EMAIL
        // OTP + backup codes are already single-use (Redis del / splice); this
        // closes the TOTP gap. Fail OPEN if Redis is unreachable (the IP/UA bind
        // + 5/15min limiter still constrain replay; 2FA is opt-in) but REJECT a
        // confirmed reuse.
        //
        // W1-5 (2026-08-22): setNX returns false on BOTH "exists" and
        // "redis-down". This used to be disambiguated by a follow-up `get`
        // whose null could ALSO mean either — it happened to land on "allow"
        // because both unknowns collapse to null, which is right by luck, not
        // by construction. `getStrict` makes it explicit: a rejection is the
        // outage (documented fail-open, now logged as such), a null is a
        // genuinely absent key, and a value is a confirmed replay.
        //
        // OPERATOR NOTE: this fail-open is inherited from the original design
        // and is the one MFA-adjacent path still allowed to pass during an
        // outage. It guards replay of an ALREADY-verified challenge, not the
        // code check itself (that now 503s). Worth revisiting alongside the
        // access-token blocklist policy.
        if (challengeJti) {
            try {
                const jtiKey = `mfa-jti:${challengeJti}`;
                const nowSec = Math.floor(Date.now() / 1000);
                const ttl = challengeExp && challengeExp > nowSec ? (challengeExp - nowSec) : 300;
                const claimed = await redisService.setNX(jtiKey, '1', ttl);
                if (!claimed && (await redisService.getStrict(jtiKey))) {
                    await auditLogger.log({
                        category: AuditCategory.SECURITY,
                        action: 'MFA_CHALLENGE_REPLAY_BLOCKED',
                        actorId: userId,
                        actorRole: user.role,
                        resourceType: 'USER',
                        resourceId: userId,
                        ipAddress: getRequestIp(req),
                        userAgent: req.headers['user-agent'],
                        result: 'FAILURE',
                    }).catch(() => {});
                    return res.status(401).json({
                        success: false,
                        code: 'MFA_CHALLENGE_REUSED',
                        error: 'This verification was already used. Please log in again.',
                        errorTh: 'การยืนยันนี้ถูกใช้ไปแล้ว กรุณาเข้าสู่ระบบใหม่',
                    });
                }
            } catch (jtiErr) {
                logger.warn('[MFA] jti single-use check failed (allowing — Redis issue):', jtiErr?.message || jtiErr);
            }
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // MFA verified — complete login by issuing full auth tokens
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const canonicalRole = normalizeRole(user.role);
        const isProvider = isProviderRole(canonicalRole);
        const jwtTokenType = isProvider ? 'provider' : 'public';

        // PDPA Sprint 6 (final sweep): JWTs no longer carry raw 13-digit
        // identifiers — see prisma-auth-service.js for the canonical login
        // payload shape. Embedding `healthId`/`providerId` in the JWT here
        // meant every downstream service that decoded the token saw the
        // bare national ID, undoing the Batch 1 fix on the MFA path.
        // Identity is now resolved server-side from `id` (UUID).
        const tokenPayload = {
            id: user.id,
            uuid: user.uuid,
            email: user.email,
            role: user.role,
            canonicalRole,
            authType: isProvider ? 'PROVIDER_ID' : 'HEALTH_ID',
            userType: isProvider ? 'PROVIDER_ID' : 'HEALTH_ID',
            // ADR-014: tenant claim — see tenant-context-middleware.
            organizationId: user.organizationId || null,
        };

        const fullToken = jwtConfig.generateToken(tokenPayload, jwtTokenType);

        // Set auth cookie
        const isSecure = isSecureCookie();
        const cookieName = isProvider ? 'provider_token' : 'auth_token';
        res.cookie(cookieName, fullToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000,
            path: '/',
        });

        // Update last login
        await identityService.touchLastLogin(userId);

        logger.info(`[MFA] Login completed after MFA verification for: ${user.role} ${userId}`);

        // PDPA Sprint 6 (final sweep): never echo raw 13-digit identifier
        // in the response. Clients that need a display value should call
        // the profile endpoint, which returns a masked form.
        res.json({
            success: true,
            message: 'MFA verification successful',
            data: {
                token: fullToken,
                user: {
                    id: user.id,
                    uuid: user.uuid,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    canonicalRole,
                    authType: tokenPayload.authType,
                    userType: tokenPayload.userType,
                },
            },
        });
    } catch (error) {
        logger.error('[MFA] Verify error:', error);
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

/**
 * DELETE /disable
 * Disable MFA (requires current code)
 */
router.delete('/disable', mfaVerifyLimiter, authenticateAny, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;

        const user = await identityService.findMfaSecretForDisable(userId);

        if (!user?.twoFactorEnabled) {
            return res.status(400).json({
                success: false,
                error: 'MFA is not enabled',
            });
        }

        // Verify code before disabling — by the user's current method. For EMAIL,
        // the user requests a code via POST /email/setup first, then disables with it.
        let isValid;
        if ((user.twoFactorMethod || 'TOTP') === 'EMAIL') {
            const emailOtpService = require('../../../services/email-otp-service');
            const r = await emailOtpService.verifyEmailOtp(userId, code);
            isValid = r.ok;
        } else {
            isValid = mfaService.verifyTOTP(user.twoFactorSecret, code);
        }

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid code',
            });
        }

        // Disable MFA
        await identityService.disableMfa(userId);

        // Log
        await auditLogger.log({
            category: AuditCategory.SECURITY,
            action: 'MFA_DISABLED',
            actorId: userId,
            actorRole: req.user.role,
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: getRequestIp(req),
            userAgent: req.headers['user-agent'],
        });

        res.json({
            success: true,
            message: 'MFA disabled successfully',
        });
    } catch (error) {
        logger.error('[MFA] Disable error:', error);
        res.status(500).json({ success: false, error: 'Failed to disable MFA' });
    }
});

module.exports = router;
// Test helper — DO NOT call from production code. The STORE_UNAVAILABLE branch
// is only reachable during a Redis outage, so it needs a direct unit guard.
module.exports._mapOtpFailure = mapOtpFailure;
