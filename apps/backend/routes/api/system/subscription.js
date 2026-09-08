/**
 * Subscription API
 *
 * Surfaces:
 *   GET  /api/subscription/me       — current user's entitlement snapshot
 *
 * M3 / operator ruling 2026-08-23 ("ไม่มีค่าสมาชิก"): there is no membership
 * fee. GET /plans — the public, unauthenticated endpoint that published a
 * 990 THB/month Premium plan and a 9,900 THB/year one — is deleted along with
 * the catalogue constant behind it, and so is POST /orders (see
 * ./subscription-orders.js). There is no price left to publish.
 *
 * What remains is the entitlement snapshot: FREE / PREMIUM / ENTERPRISE are
 * feature-gating tiers (services/subscription/entitlements-service.js), not
 * prices, and `BILLING_FREE_TIER_FOR_ALL` still hands every authenticated user
 * the PREMIUM feature set. Nothing on this router quotes or charges money.
 */

const express = require('express');
const router = express.Router();
const { authenticateAny } = require('../../../middleware/auth-middleware');
const {
    buildEntitlementSnapshot,
} = require('../../../services/subscription/entitlements-service');

router.get('/me', authenticateAny, (req, res) => {
    return res.json({
        success: true,
        data: buildEntitlementSnapshot(req.user || {}),
    });
});

// Subscription read/wind-down surface (GET /orders/my, POST /orders/:id/cancel).
// No order-minting route lives there any more — see the header above.
router.use('/', require('./subscription-orders'));

module.exports = router;
