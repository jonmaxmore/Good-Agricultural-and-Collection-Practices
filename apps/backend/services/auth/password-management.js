/**
 * Password Management Helpers
 *
 * Extracted from prisma-auth-service.js to reduce file size.
 * Handles: changePassword, requestPasswordReset, resetPasswordWithToken
 *
 * @module services/auth/password-management
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('../prisma-database');
const { sessionEpochStamp } = require('../../utils/session-epoch');
const { createLogger } = require('../../shared/logger');
const { validatePasswordStrength } = require('../../utils/password-policy');

const logger = createLogger('auth-password');
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

/**
 * Change password for an authenticated user.
 * @param {string} userId
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise<boolean>}
 */
async function changePassword(userId, oldPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        logger.info('[Password] User not found');
        throw new Error('Invalid credentials');
    }
    if (user.healthId && user.providerId) {
        throw new Error('Identity conflict: account has both healthId and providerId');
    }
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
        throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
    }
    // Strong-password backstop (owner directive 2026-06-11) — mirrors the
    // route-level changePasswordSchema → passwordField for any direct caller.
    const { valid, errors } = validatePasswordStrength(newPassword);
    if (!valid) {
        throw new Error(errors[0] || 'รหัสผ่านไม่ผ่านเกณฑ์ความปลอดภัย');
    }
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
        where: { id: userId },
        // BE-AUTH-03-03 (session epoch): stamp the revocation instant on the SAME
        // update that rotates the hash. Any refresh/access token whose `iat`
        // predates this is rejected at /refresh + auth-middleware — so a stolen
        // token can't outlive the password even if its JTI was never blocklisted.
        // This is the durable backstop for the best-effort revokeAllUserTokens
        // below (which only clears the per-user allowlist key).
        data: { password: hashedPassword, sessionsRevokedAt: sessionEpochStamp() },
    });
    // BE-AUTH-03-02: revoke all existing sessions/refresh-tokens after a password
    // change so a stolen token can't outlive the password. Best-effort (the
    // service itself fails OPEN); never block the password change on revoke.
    try {
        await require('../token-revocation-service').revokeAllUserTokens(userId);
    } catch (revokeErr) {
        logger.error(`[Password] session revoke after change failed for ${userId}: ${revokeErr?.message}`);
    }
    return true;
}

/**
 * Request a password reset (email or phone).
 * Always returns success to prevent user enumeration.
 * @param {string} identifier — email or phone number
 */
async function requestPasswordReset(identifier) {
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: identifier },
                { phoneNumber: identifier },
            ],
        },
    });
    if (!user) {
        return { success: true, message: 'If an account exists, a reset link has been sent.' };
    }
    if (user.healthId && user.providerId) {
        throw new Error('Identity conflict: account has both healthId and providerId');
    }
    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordResetToken: hashedToken,
            passwordResetExpiry: expiresAt,
        },
    });

    logger.info(`[Password] Reset requested for user: ${user.id}`);

    // B-AUTH-03 fix (2026-06-04): actually DELIVER the reset link. Previously the
    // token was only logged in non-prod, so forgot-password was a silent no-op in
    // production (user could never obtain the token). Send via email when the
    // account has a registered email. Delivery failures are swallowed so they
    // never change the anti-enumeration response or block the request — but they
    // ARE logged for ops. (Phone-only accounts without an email still need an SMS
    // reset path — tracked separately.)
    try {
        const emailService = require('../email-service');
        if (user.email) {
            await emailService.sendPasswordReset(user.email, plainToken);
            logger.info(`[Password] Reset email dispatched for user: ${user.id}`);
        } else {
            logger.warn(`[Password] No email on file for user ${user.id}; reset link not delivered (SMS path pending)`);
        }
    } catch (sendErr) {
        logger.error(`[Password] Reset email send FAILED for user ${user.id}: ${sendErr?.message}`);
    }

    if (process.env.NODE_ENV !== 'production') {
        logger.info(`[Password] Reset link: /reset-password?token=${plainToken}`);
    }
    return { success: true, message: 'If an account exists, a reset link has been sent.' };
}

/**
 * Reset password using a valid token.
 * @param {string} token — plain-text token from reset URL
 * @param {string} newPassword
 */
async function resetPasswordWithToken(token, newPassword) {
    if (!token || !newPassword) {
        throw new Error('Token and new password are required');
    }
    // Strong-password backstop (owner directive 2026-06-11). The route already
    // validates newPassword via resetPasswordWithTokenSchema → passwordField, but
    // this service is also callable directly, so enforce the same policy here
    // instead of the old weaker `< 6` length check.
    const { valid, errors } = validatePasswordStrength(newPassword);
    if (!valid) {
        throw new Error(errors[0] || 'รหัสผ่านไม่ผ่านเกณฑ์ความปลอดภัย');
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
        where: {
            passwordResetToken: hashedToken,
            passwordResetExpiry: { gte: new Date() },
        },
    });
    if (!user) {
        throw new Error('Invalid or expired reset token');
    }
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpiry: null,
            loginAttempts: 0,
            isLocked: false,
            lockedUntil: null,
            // BE-AUTH-03-03 (session epoch): a reset implies the old credential is
            // compromised/forgotten — stamp the revocation instant so every
            // pre-reset token (access + refresh) is rejected. See changePassword.
            sessionsRevokedAt: sessionEpochStamp(),
        },
    });
    // BE-AUTH-03-02: revoke existing sessions after a reset (same rationale as
    // changePassword) — a reset implies the old credential is compromised/forgotten.
    try {
        await require('../token-revocation-service').revokeAllUserTokens(user.id);
    } catch (revokeErr) {
        logger.error(`[Password] session revoke after reset failed for ${user.id}: ${revokeErr?.message}`);
    }
    logger.info(`[Password] Reset successful for user: ${user.id}`);
    return { success: true, message: 'Password has been reset successfully' };
}

module.exports = { changePassword, requestPasswordReset, resetPasswordWithToken };
