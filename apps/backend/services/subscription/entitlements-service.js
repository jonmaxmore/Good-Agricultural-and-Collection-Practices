/**
 * Subscription / Entitlements Service
 *
 * Single source of truth for "what tier is this user, and what features
 * does that unlock?". All call sites that previously checked
 * `req.user.accountTier === 'PRO'` should ask this service instead, so
 * tier policy can be evolved (free-for-all promotions, billing changes,
 * grandfathering) without touching every endpoint.
 *
 * Tiers:
 *   - FREE     (legacy alias: NORMAL)  — base experience.
 *   - PREMIUM  (legacy alias: PRO)     — full feature set.
 *   - ENTERPRISE                       — reserved for future B2B plans.
 *
 * Feature flags (env):
 *   - BILLING_FREE_TIER_FOR_ALL=true   → treat every user as PREMIUM,
 *     regardless of stored `accountTier`.
 *
 * These tiers are FEATURE GATES, not prices. M3 / operator ruling 2026-08-23
 * ("ไม่มีค่าสมาชิก"): there is no membership fee, and there is no paid
 * subscription page to send anyone to — the pricing page, the plan catalogue
 * endpoint and the order-minting path are all deleted. A tier is granted
 * (by flag or by stored `accountTier`), never sold.
 */

const TIERS = Object.freeze({
    FREE: 'FREE',
    PREMIUM: 'PREMIUM',
    ENTERPRISE: 'ENTERPRISE',
});

const TIER_ALIASES = Object.freeze({
    NORMAL: TIERS.FREE,
    FREE: TIERS.FREE,
    PRO: TIERS.PREMIUM,
    PREMIUM: TIERS.PREMIUM,
    ENTERPRISE: TIERS.ENTERPRISE,
});

const TIER_RANK = Object.freeze({
    [TIERS.FREE]: 0,
    [TIERS.PREMIUM]: 1,
    [TIERS.ENTERPRISE]: 2,
});

// Master feature catalogue. Adding a new gated feature ONLY requires editing
// this map — call sites stay untouched.
const FEATURES = Object.freeze({
    // Trace / packaging
    LOT_CREATION: { minTier: TIERS.PREMIUM },
    BATCH_EXPORT: { minTier: TIERS.PREMIUM },
    CUSTOM_QR_BRANDING: { minTier: TIERS.PREMIUM },

    // Cultivation / planting
    UNLIMITED_FARMS: { minTier: TIERS.PREMIUM },
    UNLIMITED_PLOTS: { minTier: TIERS.PREMIUM },
    // BULK_PLANT_UNIT_GENERATION was removed on 2026-08-25. It gated the bulk
    // per-plant generate press, and R8 of
    // docs/superpowers/specs/2026-08-20-planting-tnt-design.md retires
    // per-plant tracking — there is no feature left behind the gate.

    // Compliance / certification
    DOCUMENT_AUTO_OCR: { minTier: TIERS.PREMIUM },
    PRIORITY_AUDIT_QUEUE: { minTier: TIERS.PREMIUM },

    // Reporting / BI
    ADVANCED_REPORTS: { minTier: TIERS.PREMIUM },
    DATA_EXPORT_API: { minTier: TIERS.PREMIUM },

    // Enterprise-only
    SSO_INTEGRATION: { minTier: TIERS.ENTERPRISE },
    DEDICATED_SUPPORT: { minTier: TIERS.ENTERPRISE },
});

function isFreeForAll() {
    return String(process.env.BILLING_FREE_TIER_FOR_ALL || '').trim().toLowerCase() === 'true';
}

function normalizeTier(rawTier) {
    const key = String(rawTier || '').trim().toUpperCase();
    return TIER_ALIASES[key] || TIERS.FREE;
}

/**
 * Resolve the effective tier for a user payload (typically `req.user`).
 * Honours the `BILLING_FREE_TIER_FOR_ALL` feature flag.
 */
function resolveTier(user) {
    if (isFreeForAll()) {
        return TIERS.PREMIUM;
    }
    return normalizeTier(user?.accountTier);
}

/**
 * Returns true when the user's effective tier meets the feature requirement.
 * Unknown features deny by default (fail-closed).
 */
function hasFeature(user, featureKey) {
    const feature = FEATURES[featureKey];
    if (!feature) { return false; }
    const userRank = TIER_RANK[resolveTier(user)] ?? 0;
    const requiredRank = TIER_RANK[feature.minTier] ?? Number.POSITIVE_INFINITY;
    return userRank >= requiredRank;
}

/**
 * Express middleware factory. Returns 403 with a structured payload when
 * the authenticated user does not have the required feature.
 *
 *     router.post('/', authenticateHealth, requireFeature('LOT_CREATION'), handler);
 */
function requireFeature(featureKey) {
    return (req, res, next) => {
        if (hasFeature(req.user, featureKey)) {
            return next();
        }
        const feature = FEATURES[featureKey];
        return res.status(403).json({
            success: false,
            code: 'FEATURE_LOCKED',
            feature: featureKey,
            requiredTier: feature?.minTier || 'UNKNOWN',
            currentTier: resolveTier(req.user),
            message: 'ฟีเจอร์นี้ต้องการแผนการใช้งานที่สูงกว่า',
            messageEN: 'This feature requires a higher subscription tier',
            // No `upgradeUrl`. M3 / operator ruling 2026-08-23 —
            // "ไม่มีค่าสมาชิก": the pricing page this pointed at is deleted
            // and there is nothing to buy. Tier is granted, never sold.
        });
    };
}

/**
 * Build the entitlements snapshot exposed to the frontend at /api/me
 * or /api/subscription/me. The frontend uses this to decide whether
 * to show upsell prompts, gate UI controls, etc.
 */
function buildEntitlementSnapshot(user) {
    const tier = resolveTier(user);
    const features = {};
    for (const key of Object.keys(FEATURES)) {
        features[key] = hasFeature(user, key);
    }
    return {
        tier,
        rank: TIER_RANK[tier] ?? 0,
        promoUnlock: isFreeForAll(),
        features,
    };
}

module.exports = {
    TIERS,
    FEATURES,
    normalizeTier,
    resolveTier,
    hasFeature,
    requireFeature,
    buildEntitlementSnapshot,
    isFreeForAll,
};
