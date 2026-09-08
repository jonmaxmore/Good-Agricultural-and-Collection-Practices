// Subscription lifecycle — READ + WIND-DOWN ONLY.
//
// M3 / operator ruling 2026-08-23: "ไม่มีค่าสมาชิก" — there is no membership
// fee. The platform charges the state fee + a 10% platform fee + VAT 7% per
// cultivation scope, and nothing else. The 990 / 9,900 THB Premium plan that
// used to live here was never ruled on (it even wrote `vat: 0` with no ruling
// behind it) and never billed a single row: a read-only count against the live
// database on 2026-08-23 returned subscriptions=0, subscription invoices=0,
// subscription slips=0, subscription checkout orders=0.
//
// What was DELETED, not hidden:
//   - DEFAULT_PRICING (990 / 9,900) and resolvePrice()
//   - createSubscriptionOrder()  — the only writer of `subscriptions` rows and
//     of SUBSCRIPTION_* invoices
//   - createRenewalInvoicesForDueSubscriptions() — the cron that re-billed
//   - POST /api/subscription/orders and GET /api/subscription/plans
//
// What SURVIVES, and why: existing rows keep their numbers. Read, cancel and
// the expiry sweep stay so any historical row (there are none today) remains
// visible, cancellable and able to lapse. Nothing here can create a charge.
//
// activateSubscriptionForInvoice() is NEUTRALIZED (2026-09-06, slip removal):
// its only caller was the deleted payment-slip approval path. Nothing reaches
// subscription activation now; the function is kept (exported) as a no-op with
// a TODO for the Stripe-side trigger that would be required if subscriptions
// return. See its own comment below.

'use strict';

const { prisma } = require('../prisma-database');
const logger = require('../../shared/logger');

const TIERS = Object.freeze({
    PREMIUM: 'PREMIUM',
    ENTERPRISE: 'ENTERPRISE',
});

const BILLING_CYCLES = Object.freeze({
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
});

const SUBSCRIPTION_STATUS = Object.freeze({
    PENDING_PAYMENT: 'PENDING_PAYMENT',
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    CANCELLED: 'CANCELLED',
});


// Activate the subscription tied to an invoice.
//
// NEUTRALIZED 2026-09-06 (slip removal): the ONLY trigger for subscription
// activation was the payment-slip approval path (payment-slip-service.js),
// which has been deleted. There is no Stripe-side caller yet, and subscription
// counts are zero (pre-prod read-only audit 2026-08-23: subscriptions=0),
// so no live subscription is left un-activated by turning this off.
//
// It is kept exported (not deleted) so the module contract is stable, but the
// body is a no-op: it must never flip a subscription to ACTIVE on a signal that
// no longer exists. SETTLED/paid state comes from the Stripe webhook only
// (see gacp-payment-invariants), so re-enabling this the slip way would be wrong.
//
// TODO(subscriptions-return): if subscriptions are reintroduced, wire a
// Stripe-side settlement trigger (checkout-settlement-service, driven by the
// Stripe webhook) to perform the PENDING_PAYMENT → ACTIVE transition — do NOT
// restore a caller that activates on anything other than a verified webhook
// settlement. The prior activation logic (idempotent, extends startDate/endDate
// by billingCycle) is in git history at this file's pre-2026-09-06 revision.
async function activateSubscriptionForInvoice(invoiceId) {
    logger.warn(
        `[subscription-order] activateSubscriptionForInvoice(${invoiceId}) is neutralized `
        + '(slip approval path removed); no Stripe-side activation trigger is wired yet — no-op.',
    );
    return null;
}


// User-initiated cancel. Different semantics depending on current status.
async function cancelSubscription(subscriptionId, { reason, actorId }) {
    const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
    });
    if (!subscription) {
        const err = new Error(`Subscription ${subscriptionId} not found`);
        err.code = 'NOT_FOUND';
        throw err;
    }
    if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED
        || subscription.status === SUBSCRIPTION_STATUS.EXPIRED) {
        return subscription; // idempotent
    }

    const now = new Date();
    const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
            status: SUBSCRIPTION_STATUS.CANCELLED,
            cancelledAt: now,
            cancelReason: reason || null,
        },
    });
    logger.info(`[subscription-order] cancelled sub=${updated.id} actor=${actorId || 'unknown'}`);
    return updated;
}


// List subscriptions belonging to the caller's organization, newest first.
//
// STAFF SURFACES ONLY. This is not an ownership query: Organization models the
// CERTIFIER tenant (ADR-014), and every public self-registration is placed in
// the single `slug='default'` org (prisma-auth-service.js:184), so for
// applicants `organizationId` is a constant and this returns the entire
// platform. Applicant-facing routes must use listSubscriptionsForOwner below.
async function listSubscriptionsForOrg(organizationId) {
    if (!organizationId) {return [];}
    return prisma.subscription.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        include: {
            invoices: {
                select: { id: true, invoiceNumber: true, status: true, totalAmount: true },
            },
        },
    });
}


// The applicant boundary is the OWNER of the subscription.
//
// Subscription has no owner FK — `createdBy` is a nullable audit column and the
// only other link is `invoices` — so the owner is resolved two ways and OR'd:
//
//   • createdBy         — the User UUID the (now removed) POST /orders wrote
//   • invoices.healthId — the FK to User.canonicalId written on every
//                         subscription invoice, including the renewals the
//                         (now removed) auto-renewal cron minted under
//                         `createdBy: 'system:auto-renewal'`
//
// Both branches are kept so no historical row becomes invisible to the person
// who paid for it.
//
// Fail-closed: no identity in, nothing out — never everything.
//
// `isDeleted: false` is deliberately absent; Subscription is in
// SOFT_DELETE_MODELS, so the soft-delete extension injects it.
async function listSubscriptionsForOwner({ ownerUserId, ownerHealthId } = {}) {
    const owners = [];
    if (ownerUserId) {owners.push({ createdBy: ownerUserId });}
    if (ownerHealthId) {owners.push({ invoices: { some: { healthId: ownerHealthId } } });}
    if (owners.length === 0) {return [];}

    return prisma.subscription.findMany({
        where: { OR: owners },
        orderBy: { createdAt: 'desc' },
        include: {
            invoices: {
                select: { id: true, invoiceNumber: true, status: true, totalAmount: true },
            },
        },
    });
}


// Resolve one subscription only if the caller owns it. Returns null otherwise,
// so callers answer 404 and never confirm that someone else's id exists.
async function findOwnedSubscription({ subscriptionId, ownerUserId, ownerHealthId } = {}) {
    if (!subscriptionId) {return null;}
    const owned = await listSubscriptionsForOwner({ ownerUserId, ownerHealthId });
    return owned.find((s) => s.id === subscriptionId) || null;
}


// Cron-friendly scan: find subscriptions whose endDate has passed and flip
// them to EXPIRED. Runs daily. Lapsing is the wind-down direction — it costs
// nobody anything, so it survives M3.
async function expireDueSubscriptions(now = new Date()) {
    const result = await prisma.subscription.updateMany({
        where: {
            status: SUBSCRIPTION_STATUS.ACTIVE,
            endDate: { lt: now },
        },
        data: { status: SUBSCRIPTION_STATUS.EXPIRED },
    });
    if (result.count > 0) {
        logger.info(`[subscription-order] expired ${result.count} active subscriptions`);
    }
    return result.count;
}


module.exports = {
    TIERS,
    BILLING_CYCLES,
    SUBSCRIPTION_STATUS,
    activateSubscriptionForInvoice,
    cancelSubscription,
    listSubscriptionsForOrg,
    listSubscriptionsForOwner,
    findOwnedSubscription,
    expireDueSubscriptions,
};
