'use strict';

/**
 * Single source of truth for "who are the DTAM-side accountants of an org"
 * (carpet-bomb debug 2026-07-08: the byte-identical org-scoped ACTIVE query
 * was duplicated between routes/api/provider/waiver-reopen.js
 * notifyDtamAccountants and jobs/waiver-sla-escalation-job.js).
 *
 * RAW DB role values on purpose — legacy accountants carry 'ACCOUNTANT'
 * (seed-gacp.js), which normalizeRole maps to `account` and MUST receive the
 * waiver queue signals too.
 */

const { prisma } = require('./prisma-database');
const { withoutTenantScope } = require('./tenant-context');
const { CANONICAL_ROLES } = require('../shared/canonical-rbac');

// Every spelling users.role may hold for a DTAM-side accountant, in BOTH the
// legacy casing and the canonical one. The list used to be uppercase-only, so
// migration 20260801000000_canonicalize_user_role would have made this query
// return zero rows — and it fails silently, as an empty list rather than an
// error, so slip routing would simply stop reaching anyone.
const DTAM_ACCOUNTANT_DB_ROLES = Object.freeze([CANONICAL_ROLES.ACCOUNT, CANONICAL_ROLES.ACCOUNT_DTAM]);

/** ACTIVE, non-deleted DTAM-side accountant user ids for one organization. */
async function listDtamAccountantIds(organizationId) {
    const rows = await withoutTenantScope(() => prisma.user.findMany({
        where: {
            role: { in: [...DTAM_ACCOUNTANT_DB_ROLES] },
            organizationId,
            status: 'ACTIVE',
            isDeleted: false,
        },
        select: { id: true },
    }));
    return rows.map((r) => r.id);
}

/**
 * Live-row verification that `userId` really is an ACTIVE, non-deleted
 * DTAM-side accountant of `organizationId` (hardening batch 2026-07-09).
 * The JWT asserts a role, but the User row is the record of truth — an
 * accountant suspended/demoted via any path that does not stamp
 * sessionsRevokedAt keeps a valid 12h token. Fail-closed: missing args → false.
 */
async function isActiveDtamAccountant(userId, organizationId) {
    if (!userId || !organizationId) { return false; }
    const row = await withoutTenantScope(() => prisma.user.findFirst({
        where: {
            id: userId,
            organizationId,
            role: { in: [...DTAM_ACCOUNTANT_DB_ROLES] },
            status: 'ACTIVE',
            isDeleted: false,
        },
        select: { id: true },
    }));
    return Boolean(row);
}

module.exports = { listDtamAccountantIds, isActiveDtamAccountant, DTAM_ACCOUNTANT_DB_ROLES };
