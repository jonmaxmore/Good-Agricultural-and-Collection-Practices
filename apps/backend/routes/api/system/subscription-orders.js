// Subscription surface — READ + CANCEL ONLY.
//
//   GET  /orders/my       — list the subscriptions I own, newest first
//   POST /orders/:id/cancel
//
// M3 / operator ruling 2026-08-23 ("ไม่มีค่าสมาชิก"): there is no membership
// fee, so POST /orders — the route that minted a subscription row plus a
// priced SUBSCRIPTION_* invoice — is deleted, not disabled. Nothing on this
// router can create a charge. What remains lets a historical row be read and
// wound down; the live database holds none (read-only count, 2026-08-23).

'use strict';

const express = require('express');
const router = express.Router();
const { authenticateAny } = require('../../../middleware/auth-middleware');
const { safeErrorMessage, isValidUUID } = require('../../../shared/api-response');
const { auditLogger, AuditCategory, AuditSeverity, ResourceType } = require('../../../middleware/audit-logger');
const { getRequestIp } = require('../../../utils/client-ip');
const logger = require('../../../shared/logger');
const subscriptionService = require('../../../services/subscription/subscription-order-service');


async function logSubscriptionEvent(req, action, severity, payload) {
    try {
        await auditLogger.log({
            category: AuditCategory.PAYMENT,
            action,
            severity,
            actorId: req.user?.id || 'ANONYMOUS',
            actorRole: req.user?.canonicalRole || req.user?.role || 'UNKNOWN',
            actorType: req.user?.providerId ? 'PROVIDER' : 'USER',
            resourceType: ResourceType.PAYMENT,
            resourceId: payload?.subscriptionId || payload?.invoiceId || 'unknown',
            ipAddress: getRequestIp(req),
            userAgent: req.get('user-agent'),
            metadata: payload || {},
        });
    } catch (err) {
        logger.warn('[subscription-orders] audit log failed (non-fatal):', err?.message);
    }
}


// The applicant boundary is the OWNER, never the organization. Every public
// self-registration lands in the one `default` org, so scoping these routes on
// organizationId selected the entire applicant population — one applicant could
// read every other applicant's subscriptions and cancel any of them by id.
// Derived once here, from the same identity fields the removed POST /orders
// used to write onto every subscription row.
function ownerScope(req) {
    return {
        ownerUserId: req.user?.id || null,
        ownerHealthId: req.user?.canonicalId || req.user?.healthId || null,
    };
}


router.get('/orders/my', authenticateAny, async (req, res) => {
    try {
        const scope = ownerScope(req);
        if (!scope.ownerUserId && !scope.ownerHealthId) {
            return res.status(401).json({ success: false, error: 'Unauthorized', code: 'NO_IDENTITY' });
        }
        const subscriptions = await subscriptionService.listSubscriptionsForOwner(scope);
        return res.json({ success: true, data: subscriptions });
    } catch (error) {
        logger.error('[subscription-orders] list-my failed:', error);
        return res.status(500).json({ success: false, error: safeErrorMessage(error) });
    }
});


router.post('/orders/:id/cancel', authenticateAny, async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) {
            return res.status(400).json({ success: false, error: 'INVALID_ID' });
        }

        // Owner gate. NOT an org gate — see ownerScope above: the previous
        // check read as a tenant guard but every applicant shares one org, so
        // it authorised cancelling anyone's subscription. 404 rather than 403
        // so a foreign id is indistinguishable from one that does not exist.
        const scope = ownerScope(req);
        if (!scope.ownerUserId && !scope.ownerHealthId) {
            return res.status(401).json({ success: false, error: 'Unauthorized', code: 'NO_IDENTITY' });
        }
        const owned = await subscriptionService.findOwnedSubscription({
            subscriptionId: req.params.id,
            ...scope,
        });
        if (!owned) {
            return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        }

        const updated = await subscriptionService.cancelSubscription(req.params.id, {
            reason: req.body?.reason,
            actorId: req.user.id,
        });

        await logSubscriptionEvent(req, 'SUBSCRIPTION_CANCELLED', AuditSeverity.WARNING, {
            subscriptionId: updated.id,
            reason: req.body?.reason,
        });

        return res.json({ success: true, data: updated });
    } catch (error) {
        const code = error.code || 'UNKNOWN';
        const status = code === 'NOT_FOUND' ? 404 : 500;
        if (status >= 500) {
            logger.error('[subscription-orders] cancel failed:', error);
        }
        return res.status(status).json({
            success: false,
            error: code,
            message: safeErrorMessage(error),
        });
    }
});


module.exports = router;
