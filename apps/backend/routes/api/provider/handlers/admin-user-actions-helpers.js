/**
 * Helpers for admin-only user lifecycle actions (Wave B Phase 55 / G6).
 *
 * Pure functions extracted from the route handlers so unit tests can
 * exercise them without dragging in Prisma or the audit logger.
 */

const crypto = require('crypto');

/**
 * Hash a plain reset token the same way password-management.js does, so
 * the existing /auth/reset-password flow can validate the token we
 * issue from the admin force-reset endpoint.
 */
function hashResetToken(plainToken) {
    return crypto.createHash('sha256').update(String(plainToken || '')).digest('hex');
}

/**
 * Generate a 32-byte hex token suitable for a one-shot password reset.
 */
function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Build the Prisma update payload for "unlock account": clears the
 * lock flag, reset attempt counter, and lock-until timestamp. Mirrors
 * the auto-unlock that happens in prisma-auth-service on next login.
 */
function buildUnlockPayload(actorId) {
    return {
        isLocked: false,
        lockedUntil: null,
        loginAttempts: 0,
        updatedBy: actorId || null,
        updatedAt: new Date(),
    };
}

/**
 * Build the Prisma update payload for "disable 2FA": kills the
 * enabled flag and wipes the secret + backup codes so the user has
 * to re-enroll from scratch.
 */
function buildDisableTwoFactorPayload(actorId) {
    return {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        updatedBy: actorId || null,
        updatedAt: new Date(),
    };
}

/**
 * Build the Prisma update payload for "force password reset". The
 * plain token returned alongside is what the admin hands to the user;
 * the hashed copy is what we store. 1-hour expiry mirrors the regular
 * /auth/password-reset flow.
 */
function buildForceResetPayload(actorId, plainToken) {
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    return {
        data: {
            passwordResetToken: hashResetToken(plainToken),
            passwordResetExpiry: expiry,
            updatedBy: actorId || null,
            updatedAt: new Date(),
        },
        plainToken,
        expiresAt: expiry,
    };
}

/**
 * Decide whether the caller is allowed to perform admin user actions.
 * Mirrors the role check in PATCH/PUT/DELETE /:id elsewhere in this
 * file: only admin/super_admin roles.
 */
function isAdminCaller(role) {
    const normalized = String(role || '').toLowerCase();
    return normalized === 'admin' || normalized === 'super_admin';
}

module.exports = {
    hashResetToken,
    generateResetToken,
    buildUnlockPayload,
    buildDisableTwoFactorPayload,
    buildForceResetPayload,
    isAdminCaller,
};
