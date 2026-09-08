'use strict';

/**
 * Single source of truth for the users.role canonicalisation migration.
 *
 * Every row of USER_ROLE_MIGRATION_MAP is (raw DB value seen in the wild)
 * -> (CANONICAL_ROLES value). The SQL migration, the pre/post verification
 * script and the jest mapping test all read THIS table, so the three can
 * never drift.
 */

const { CANONICAL_ROLES, normalizeRole } = require('./canonical-rbac');

/**
 * Historical raw values that predate ROLE_ALIASES and are therefore NOT
 * resolvable by normalizeRole(). Each entry needs a code-cited justification
 * because a wrong guess silently changes a user's authority.
 */
const HISTORICAL_EXTRA_ALIASES = Object.freeze({
  // Original users.role DEFAULT (migration 20260110020726 line 24), re-cased to
  // 'FARMER' by 20260207143000 line 17. Migration 20260206080000 line 26 treats
  // role='FARMER' as the healthId owner. normalizeRole('FARMER') is null TODAY,
  // and both call sites that consume it fall back to HEALTH
  // (prisma-auth-service.js:336 and :473), so mapping FARMER -> health is
  // behaviour-preserving, not a privilege change.
  farmer: CANONICAL_ROLES.HEALTH,
});

/** Raw values that must NEVER be auto-mapped — the migration aborts on them. */
const QUARANTINE_VALUES = Object.freeze([
  // Seeded by prisma/seed-gacp.js until 2026-07-09. normalizeRole -> null, so
  // these accounts are ALREADY dead (403 INVALID_PROVIDER_ROLE). Mapping them
  // to anything would resurrect a dead account = a privilege GRANT.
  'COORDINATOR',
  // Only ever appears in a read filter (services/notification/domain-helpers.js:286)
  // next to ADMIN/SUPER_ADMIN. Never written. If a row exists, guessing 'admin'
  // would be a privilege escalation.
  'EXECUTIVE',
  // shared/constants.js ROLES + shared/types.ts:18 vocabulary. Not written by
  // any User.role writer; if present the intent is genuinely ambiguous.
  'PROVIDER',
  'OFFICER',
  '',
]);

function buildMap() {
  const out = {};
  // 1. Everything normalizeRole() already understands. We enumerate the raw
  //    spellings the codebase actually writes plus every alias key, uppercased
  //    and lowercased, because Postgres comparison is case-sensitive.
  const aliasKeys = [
    'admin', 'super_admin', 'platform_admin', 'platform_owner', 'scheduler',
    'reviewer', 'reviewer_auditor', 'document_reviewer', 'auditor', 'inspector',
    'audit', 'head_auditor', 'approver', 'final_approver',
    'account_dtam', 'accountant_dtam', 'dtam_account', 'finance_dtam',
    'account_platform', 'accountant_platform', 'platform_account', 'finance_platform',
    'account', 'accountant', 'finance', 'health', 'applicant',
    'system', 'webhook', 'cron',
  ];
  for (const key of aliasKeys) {
    const target = normalizeRole(key);
    if (!target) {
      throw new Error(`role-migration-map: '${key}' is no longer a ROLE_ALIASES key`);
    }
    out[key] = target;
  }
  for (const [key, target] of Object.entries(HISTORICAL_EXTRA_ALIASES)) {
    out[key] = target;
  }
  return Object.freeze(out);
}

/** lowercase raw value -> canonical target */
const USER_ROLE_MIGRATION_MAP = buildMap();

/** The exact set of values users.role is allowed to hold AFTER the migration. */
const TARGET_ROLE_VALUES = Object.freeze(
  Array.from(new Set(Object.values(CANONICAL_ROLES))).sort(),
);

/**
 * Resolve a raw DB value. Returns null when the value must be quarantined
 * (the migration aborts rather than guessing).
 */
function mapRawRole(raw) {
  const key = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!key) { return null; }
  return USER_ROLE_MIGRATION_MAP[key] || null;
}

/**
 * Inverse of the map: canonical role -> EVERY spelling users.role may hold.
 *
 * This is what `prisma.user.findMany({ where: { role: … } })` needs. Postgres
 * string comparison is case-sensitive, so a filter written as `role: 'HEALTH'`
 * matches nothing once the migration has rewritten the column to 'health' — and
 * it fails SILENTLY, as an empty result rather than an error. That is how a
 * notification fan-out or an accountant lookup goes quiet without anyone
 * noticing.
 *
 * Matching the whole set makes every such query correct on BOTH sides of the
 * migration, so the migration and the deploy can happen in either order and a
 * stale read-replica cannot break routing. This is the "expand" half of
 * expand-migrate-contract: safe to ship BEFORE the migration, because no row
 * holds a canonical value yet, so the widened filter matches exactly what the
 * narrow one did.
 *
 * @param {string} canonicalRole a CANONICAL_ROLES value (or any alias of one)
 * @returns {string[]} every raw spelling, lower- and upper-cased, plus the
 *                     canonical value itself. Empty when the role is unknown.
 */
function dbRoleValuesFor(canonicalRole) {
  const target = normalizeRole(canonicalRole);
  if (!target) { return []; }
  const values = new Set([target]);
  for (const [raw, mapped] of Object.entries(USER_ROLE_MIGRATION_MAP)) {
    if (mapped !== target) { continue; }
    values.add(raw);
    values.add(raw.toUpperCase());
  }
  return Array.from(values).sort();
}

/**
 * Same, for several canonical roles at once — the shape a `role: { in: [...] }`
 * filter wants.
 *
 * @param {...string} canonicalRoles
 * @returns {string[]} de-duplicated union
 */
function dbRoleValuesForAny(...canonicalRoles) {
  const flat = canonicalRoles.flat();
  const values = new Set();
  for (const role of flat) {
    for (const value of dbRoleValuesFor(role)) { values.add(value); }
  }
  return Array.from(values).sort();
}

module.exports = {
  USER_ROLE_MIGRATION_MAP,
  HISTORICAL_EXTRA_ALIASES,
  QUARANTINE_VALUES,
  TARGET_ROLE_VALUES,
  mapRawRole,
  dbRoleValuesFor,
  dbRoleValuesForAny,
};
