/**
 * Health Authentication Routes (GACP Thai Standard)
 * Uses Health ID (13-digit Thai ID) for authentication
 * @version 3.0.0
 */

const express = require('express');
const { safeErrorMessage, respondError } = require('../../../shared/api-response');
const router = express.Router();
const AuthController = require('../../../controllers/auth-controller');
const upload = require('../../../middleware/upload-middleware');
const rejectBadUpload = require('../../../middleware/reject-bad-upload');
const { authenticateHealth } = require('../../../middleware/auth-middleware');
const { validate } = require('../../../middleware/validate');
const {
    healthLoginSchema,
    healthRegisterSchema,
    resetPasswordSchema,
    resetPasswordWithTokenSchema,
    checkIdentifierSchema,
    changePasswordSchema,
} = require('../../../shared/schemas/auth-schemas');

// POST /auth/health/login - Health login with Health ID
/**
 * @swagger
 * /api/auth/health/login:
 *   post:
 *     tags: [Auth]
 *     summary: Health applicant login with 13-digit Thai Health ID
 *     description: Authenticates a HEALTH-role applicant and returns a JWT access token plus refresh cookies. Rate-limited at the server boundary.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: 13-digit Thai national ID (or email). This is the field the healthLoginSchema actually requires.
 *                 example: '1101900000005'
 *               healthId:
 *                 type: string
 *                 description: Optional alias for identifier (legacy clients). Prefer `identifier`.
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Authenticated — returns access token + user payload
 *       400:
 *         description: VALIDATION_ERROR — schema check failed
 *       401:
 *         description: INVALID_CREDENTIALS — Health ID / password mismatch
 *       429:
 *         description: Rate limit exceeded (authLimiter)
 */
router.post('/login', validate(healthLoginSchema), (req, res) => AuthController.login(req, res));

// A Firebase Authentication exchange (custom-token + ID-token exchange) was
// mounted here behind a feature flag. It was removed under the
// data-sovereignty requirement — it made Google the identity provider for
// Thai citizens. /login above, verified against our own Postgres, is the
// only login path. Do not reintroduce a foreign IdP.

// POST /auth/health/register - Health registration with Health ID
/**
 * @swagger
 * /api/auth/health/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new HEALTH-role applicant with Thai national ID
 *     description: Creates a new applicant account. Optional ID-card image upload (multipart/form-data) is hashed and retained per PDPA. Rate-limited.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [healthId, password, firstName, lastName]
 *             properties:
 *               healthId:
 *                 type: string
 *                 description: 13-digit Thai national ID
 *               password:
 *                 type: string
 *                 format: password
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               idCardImage:
 *                 type: string
 *                 format: binary
 *                 description: Optional ID-card image (JPG/PNG/PDF, <= 5 MB)
 *     responses:
 *       201:
 *         description: Created — applicant registered; returns user + token payload
 *       400:
 *         description: VALIDATION_ERROR — schema check failed
 *       409:
 *         description: CONFLICT_ERROR — Health ID already registered
 *       429:
 *         description: Rate limit exceeded (registerLimiter)
 */
router.post('/register', upload.single('idCardImage'), rejectBadUpload, validate(healthRegisterSchema), (req, res) => AuthController.register(req, res));

// POST /auth/health/reset-password - Request password reset
router.post('/reset-password', validate(resetPasswordSchema), (req, res) => AuthController.requestPasswordReset(req, res));

// POST /auth/health/reset-password/:token - Complete password reset with token
router.post('/reset-password/:token', validate(resetPasswordWithTokenSchema), async (req, res) => {
    try {
        const authService = require('../../../services/prisma-auth-service');
        const result = await authService.resetPasswordWithToken(req.params.token, req.body.newPassword);
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, error: safeErrorMessage(error) });
    }
});

// POST /auth/health/check-identifier - Check if Health ID exists
router.post('/check-identifier', validate(checkIdentifierSchema), (req, res) => AuthController.checkIdentifier(req, res));


// Token Management
router.post('/refresh', (req, res) => AuthController.refreshToken(req, res));

/**
 * @swagger
 * /api/auth/health/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Sign out the current applicant session
 *     description: Clears the access/refresh/CSRF cookies and invalidates the refresh token server-side. Safe to call when no session is present (always returns 200).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session cleared
 */
router.post('/logout', (req, res) => AuthController.logout(req, res));

// Protected Routes
/**
 * @swagger
 * /api/auth/health/me:
 *   get:
 *     tags: [Auth]
 *     summary: Return the authenticated applicant's profile
 *     description: Returns the current HEALTH user's profile, role, status, and tenant context derived from the JWT.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: AUTH_ERROR — missing or invalid token
 */
router.get('/me', authenticateHealth, (req, res) => AuthController.getMe(req, res));
router.patch('/me', authenticateHealth, (req, res) => AuthController.updateProfile(req, res));
router.post('/change-password', authenticateHealth, validate(changePasswordSchema), (req, res) => AuthController.changePassword(req, res));
router.post('/me/avatar', authenticateHealth, upload.single('avatar'), (req, res) => AuthController.uploadAvatar(req, res));
router.get('/verify', authenticateHealth, (req, res) => AuthController.verifyToken(req, res));

// PDPA Section 30 (data export) + Section 33 (right to erasure).
// These two endpoints are statutory requirements for any Thai service
// that holds personal data — without them, DTAM is liable on the
// regulator side and the user has no in-app way to exercise their
// rights. See pdpa-service.js for the retention / legal-hold logic.
const pdpaService = require('../../../services/pdpa-service');
const { auditLogger, AuditCategory } = require('../../../middleware/audit-logger');
const { getRequestIp } = require('../../../utils/client-ip');

router.get('/me/export', authenticateHealth, async (req, res) => {
    try {
        const exportPayload = await pdpaService.assembleUserDataExport(req.user.id);
        try {
            await auditLogger.log({
                category: AuditCategory.SECURITY,
                action: 'PDPA_EXPORT',
                actorId: req.user.id,
                actorRole: req.user.role || 'health',
                resourceType: 'USER',
                resourceId: req.user.id,
                ipAddress: getRequestIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { regulation: 'PDPA-S30' },
            });
        } catch (_auditErr) {
            // non-fatal — export still succeeds.
        }
        // Mark as a JSON download so browsers offer a save dialog. The
        // filename embeds the user id + ISO date for easy filing.
        const filename = `gacp-data-export-${req.user.id}-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(JSON.stringify(exportPayload, null, 2));
    } catch (error) {
        return respondError(res, req, error);
    }
});

router.delete('/me/delete', authenticateHealth, async (req, res) => {
    try {
        const { password, reason } = req.body || {};
        const result = await pdpaService.softDeleteUser({
            userId: req.user.id,
            password,
            reason,
        });
        try {
            await auditLogger.log({
                category: AuditCategory.SECURITY,
                action: 'PDPA_DELETE_REQUESTED',
                actorId: req.user.id,
                actorRole: req.user.role || 'health',
                resourceType: 'USER',
                resourceId: req.user.id,
                ipAddress: getRequestIp(req),
                userAgent: req.headers['user-agent'],
                metadata: {
                    regulation: 'PDPA-S33',
                    reason: reason || null,
                    retainUntil: result.retainUntil,
                },
            });
        } catch (_auditErr) {
            // non-fatal — delete still succeeds.
        }
        // Force logout so the now-deleted account can't keep working
        // off cached cookies. The frontend redirects to login.
        res.clearCookie('auth_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        res.clearCookie('csrf_token', { path: '/' });
        return res.json({ success: true, data: result });
    } catch (error) {
        // Map known error codes to HTTP status. Everything else is 500.
        const statusMap = {
            INVALID_CREDENTIALS: 401,
            PDPA_PASSWORD_REQUIRED: 400,
            PDPA_LEGAL_HOLD: 403,
            PDPA_ALREADY_DELETED: 409,
            USER_NOT_FOUND: 404,
        };
        const status = statusMap[error.code] || 500;
        return res.status(status).json({
            success: false,
            error: safeErrorMessage(error),
            code: error.code || 'PDPA_DELETE_FAILED',
        });
    }
});

// Phase 7: per-user notification preferences (per-type x channel toggles).
const prefsService = require('../../../services/notification-preferences-service');
router.get('/me/notification-prefs', authenticateHealth, async (req, res) => {
    try {
        const data = await prefsService.getPrefs(req.user.id);
        return res.json({ success: true, data });
    } catch (error) {
        return respondError(res, req, error);
    }
});
router.put('/me/notification-prefs', authenticateHealth, async (req, res) => {
    try {
        const data = await prefsService.updatePrefs(req.user.id, req.body || {});
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, error: safeErrorMessage(error) });
    }
});

module.exports = router;

