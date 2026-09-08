/**
 * Application Listing & Tracking Routes
 * Extracted from applications.js for readability.
 *
 * Routes: GET /, GET /my, GET /my/statuses, GET /:id/status, GET /:id/history
 *
 * @module routes/api/applications/application-listing-handlers
 */

const express = require('express');
const router = express.Router();
const applicationService = require('../../../services/application-service');
const { authenticateAny: authenticateHealth } = require('../../../middleware/auth-middleware');
const { prisma } = require('../../../services/prisma-database');
const feeService = require('../../../services/fee-calculation');
const logger = require('../../../shared/logger');
// X1-FIX-A / C-5 — canonical role table for the provider-side branch
// on `GET /api/applications/`. Pre-X1 the provider branch returned the
// first 100 applications system-wide to ANY token with no healthId, with
// zero requireRole gate. A leaked / malformed JWT could quietly walk away
// with the system-wide cross-tenant view (X1-D §4 H-2). The new gate
// uses normalizeRole + isProviderRole + an explicit allow-list, mirroring
// the matrix in canonical-rbac.js ROLE_GROUPS.ALL_PROVIDER.
const { normalizeRole, isProviderRole, CANONICAL_ROLES } = require('../../../shared/canonical-rbac');
const {
    mapHealthApplication,
    getHealthScopeOptions,
} = require('../helpers/applications-helpers');
const {
    _asObject,
    isMissingApplicationCommentsTableError,
} = require('../helpers/application-constants');
const {
    buildApplicationHistoryPayload,
    buildTrackingPayload,
} = require('../helpers/application-payload-builders');
const { respondError } = require('../../../shared/api-response');
const { storedCultivationScopeCount } = require('../../../shared/application-scope');

// LISTING & TRACKING

// X1-FIX-A / C-5 — explicit provider-role allow-list for the system-wide
// branch of `GET /api/applications/`. Pre-X1 any caller without a
// healthId (e.g. provider tokens with a non-canonical role string, or a
// HEALTH token that lost its healthId claim) hit the unconditional
// `findMany` and walked away with the first 100 applications across
// every tenant. We now require the caller's role to canonicalise to a
// known provider role; HEALTH is blocked by definition because HEALTH is
// not in PROVIDER_CANONICAL_ROLES (canonical-rbac.js:219-229).
const PROVIDER_LISTING_ROLES = new Set([
    CANONICAL_ROLES.ADMIN,
    CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR,
    CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.ACCOUNT_DTAM,
    CANONICAL_ROLES.ACCOUNT_PLATFORM,
    CANONICAL_ROLES.ACCOUNT,
]);

router.get('/', authenticateHealth, async (req, res) => {
    try {
        const hasHealthId = String(req.user?.healthId || '').trim();
        if (!hasHealthId) {
            // Provider branch — system-wide listing. Gate on canonical
            // provider role to close X1-D §4 H-2: a non-canonical token
            // with no healthId previously fell through to the unfiltered
            // findMany. HEALTH role MUST never reach this branch (it's
            // blocked by the canonical role check below in addition to
            // the missing-healthId guard above).
            const canonicalRole = normalizeRole(req.user?.canonicalRole || req.user?.role);
            if (
                !canonicalRole
                || !isProviderRole(canonicalRole)
                || !PROVIDER_LISTING_ROLES.has(canonicalRole)
            ) {
                logger.warn('[Applications List] Provider-branch access denied', {
                    userId: req.user?.id,
                    canonicalRole,
                });
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden',
                    code: 'PROVIDER_ROLE_REQUIRED',
                });
            }
            const allApps = await prisma.application.findMany({
                where: { isDeleted: false },
                orderBy: { createdAt: 'desc' },
                take: 100,
                include: { certificates: { select: { id: true } } },
            });
            return res.json({ success: true, data: allApps.map(mapHealthApplication), viewType: 'provider' });
        }
        const applications = await applicationService.getHealthApplications(req.user.id, getHealthScopeOptions(req.user));
        res.json({ success: true, data: applications.map(mapHealthApplication) });
    } catch (error) {
        logger.error('[Applications List] Error:', error);
        return respondError(res, req, error, { message: 'Failed to fetch list' });
    }
});

router.get('/my', authenticateHealth, async (req, res) => {
    try {
        if (!String(req.user?.healthId || '').trim()) { return res.status(403).json({ success: false, error: 'Health healthId is required' }); }
        const limit = Number.parseInt(String(req.query.limit || ''), 10);
        const scopeOptions = getHealthScopeOptions(req.user);
        const applications = await applicationService.getHealthApplications(req.user.id, { take: Number.isFinite(limit) && limit > 0 ? limit : undefined, ...scopeOptions });
        res.json({
            success: true,
            data: applications.map(app => ({
                ...mapHealthApplication(app),
                scheduledDate: app.scheduledDate,
                audit: { mode: app.formData?.auditMode, meetingUrl: app.formData?.meetingUrl, location: app.formData?.auditLocation, auditorId: app.auditorId },
                fees: app.formData?.fees || {
                    // `cultivationScopeCount` on this payload is inert — the fee
                    // service only honours a stored count via `options.scopeCount`.
                    // Renamed with the column; not made live, because that would
                    // change prices (L3). Open finding: reports/sku/design-event.md.
                    phase1: feeService.calculatePhase1Fee({ ...(typeof app.formData === 'object' && app.formData ? app.formData : {}), cultivationScopeCount: storedCultivationScopeCount(app) }),
                    phase2: feeService.calculatePhase2Fee({ ...(typeof app.formData === 'object' && app.formData ? app.formData : {}), cultivationScopeCount: storedCultivationScopeCount(app) }),
                },
            })),
        });
    } catch (error) {
        logger.error('[Applications My] Error:', error);
        return respondError(res, req, error, { message: 'Failed to fetch applications' });
    }
});

router.get('/my/statuses', authenticateHealth, async (req, res) => {
    try {
        if (!String(req.user?.healthId || '').trim()) { return res.status(403).json({ success: false, error: 'Health healthId is required' }); }
        const identity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const limit = Number.parseInt(String(req.query.limit || ''), 10);
        const take = Number.isFinite(limit) && limit > 0 ? limit : undefined;

        const applications = await prisma.application.findMany({
            where: { healthId: identity.healthId, isDeleted: false },
            orderBy: { createdAt: 'desc' },
            ...(take ? { take } : {}),
            select: { id: true, applicationNumber: true, status: true, phase1Status: true, phase2Status: true, formData: true },
        });

        const now = new Date();
        return res.json({ success: true, data: applications.map((app) => buildTrackingPayload(app, { now })) });
    } catch (error) {
        logger.error('[Applications My Statuses] Error:', error);
        return respondError(res, req, error, { message: 'Failed to fetch application statuses' });
    }
});

router.get('/:id/status', authenticateHealth, async (req, res) => {
    try {
        const identity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const idOrNumber = String(req.params.id || '').trim();
        const application = await prisma.application.findFirst({
            where: { OR: [{ id: idOrNumber }, { applicationNumber: idOrNumber }], healthId: identity.healthId, isDeleted: false },
            select: { id: true, applicationNumber: true, status: true, phase1Status: true, phase2Status: true, formData: true },
        });

        if (!application) { return res.status(404).json({ success: false, error: 'Application not found' }); }
        return res.json({ success: true, data: buildTrackingPayload(application, { now: new Date() }) });
    } catch (error) {
        logger.error('[Applications Tracking Status] Error:', error);
        return respondError(res, req, error, { message: 'Failed to load application status' });
    }
});

// ระบบเต็มมีประตู GET /:id/statement คืน "ใบแจ้งยอด" ของคำขอ (ยอดค้าง ใบแจ้งหนี้
// ใบเสร็จ) · GACP Lite ไม่มีเอกสารการเงิน — ยอดที่ต้องชำระสองงวดอ่านได้จาก
// GET /api/fees/:applicationId ซึ่งบอกด้วยว่าเจ้าหน้าที่คนไหนยืนยันรับเงินไปแล้ว


router.get('/:id/history', authenticateHealth, async (req, res) => {
    try {
        const identity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const where = { id: req.params.id, healthId: identity.healthId, isDeleted: false };
        let application;
        try {
            // P1-G leak-guard: applicant history must never include internal
            // staff notes (ApplicationComment.internalOnly) — see the identical
            // guard on GET /:id in application-workflow-handlers.js.
            application = await prisma.application.findFirst({ where, include: { comments: { where: { internalOnly: false }, orderBy: { createdAt: 'asc' } } } });
        } catch (error) {
            if (!isMissingApplicationCommentsTableError(error)) { throw error; }
            logger.warn('[Applications History] application_comments table missing; fallback without comments');
            application = await prisma.application.findFirst({ where });
            if (application) { application.comments = []; }
        }
        if (!application) { return res.status(404).json({ success: false, error: 'Application not found' }); }
        return res.json({ success: true, data: buildApplicationHistoryPayload(application) });
    } catch (error) {
        logger.error('[Applications History] Error:', error);
        return respondError(res, req, error, { message: 'Failed to load application history' });
    }
});

module.exports = router;
