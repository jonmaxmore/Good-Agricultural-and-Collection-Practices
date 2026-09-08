/**
 * Canonical Roles for Frontend
 * Mirrors backend canonical-rbac.js — single source of truth for web
 *
 * Tier 16 (B16-B, 2026-05-16): the legacy ACCOUNT role is split into
 * ACCOUNT_DTAM (the DTAM finance team, state-fee side) and
 * ACCOUNT_PLATFORM (the platform finance team, platform-fee +
 * subscription side). Legacy ACCOUNT retained for the
 * migration window — see backend `scripts/migrate-account-role.js`.
 */

export const CANONICAL_ROLES = {
    HEALTH: 'health',
    DOCUMENT_REVIEWER: 'document_reviewer',
    SCHEDULER: 'scheduler',
    AUDITOR: 'auditor',
    HEAD_AUDITOR: 'auditor', // Consolidated into AUDITOR
    ACCOUNT_DTAM: 'account_dtam',
    ACCOUNT_PLATFORM: 'account_platform',
    // Legacy — retained during migration window for backward compat.
    ACCOUNT: 'account',
    ADMIN: 'admin',
    // Cross-tenant governance operator (the only role that spans organizations).
    // Its portal is /admin/organizations (backed by /api/platform-admin/*). Without
    // this entry normalizeRole('platform_admin') returned null → the provider
    // middleware wiped its cookie + locked it out (multi-role system test 2026-06-24).
    PLATFORM_ADMIN: 'platform_admin',
} as const;

export type CanonicalRole = typeof CANONICAL_ROLES[keyof typeof CANONICAL_ROLES];

export const ROLE_ALIASES: Record<string, CanonicalRole> = {
    admin: 'admin',
    super_admin: 'admin',
    platform_admin: 'platform_admin',
    super_platform_admin: 'platform_admin',
    scheduler: 'scheduler',
    reviewer: 'document_reviewer',
    reviewer_auditor: 'document_reviewer',
    document_reviewer: 'document_reviewer',
    auditor: 'auditor',
    inspector: 'auditor',
    audit: 'auditor',
    head_auditor: 'auditor', // Consolidated into auditor
    approver: 'auditor',     // Consolidated into auditor
    final_approver: 'auditor', // Consolidated into auditor
    // Tier 16 split — explicit canonical entries + common legacy
    // aliases. The bare `account` alias resolves to the legacy role
    // so old JWTs do not lock out users; the DB migration flips
    // them on next login.
    account_dtam: 'account_dtam',
    accountant_dtam: 'account_dtam',
    dtam_account: 'account_dtam',
    finance_dtam: 'account_dtam',
    account_platform: 'account_platform',
    accountant_platform: 'account_platform',
    platform_account: 'account_platform',
    finance_platform: 'account_platform',
    account: 'account',
    accountant: 'account',
    finance: 'account',
    health: 'health',
    // P0-E: normalizeRole lowercases BEFORE the lookup, so a capitalized
    // 'Applicant' key was dead/unreachable (the backend fixed the identical
    // bug in canonical-rbac.js). Keep the alias, lowercase the key.
    applicant: 'health',
};

export function normalizeRole(role: string | null | undefined): CanonicalRole | null {
    const key = String(role || '').trim().toLowerCase();
    return key ? (ROLE_ALIASES[key] ?? null) : null;
}

export const PROVIDER_ROLES = new Set<CanonicalRole>([
    CANONICAL_ROLES.ADMIN,
    CANONICAL_ROLES.PLATFORM_ADMIN,
    CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR,
    // HEAD_AUDITOR removed — resolves to 'auditor' via alias
    CANONICAL_ROLES.ACCOUNT_DTAM,
    CANONICAL_ROLES.ACCOUNT_PLATFORM,
    CANONICAL_ROLES.ACCOUNT,
]);

// Tier 16: the set of all accounting roles (legacy + split). Pages
// that gate by "is this user finance staff?" should use this rather
// than a bare === ACCOUNT comparison so the split roles are admitted.
export const ACCOUNT_ROLES = new Set<CanonicalRole>([
    CANONICAL_ROLES.ACCOUNT_DTAM,
    CANONICAL_ROLES.ACCOUNT_PLATFORM,
    CANONICAL_ROLES.ACCOUNT,
]);

// Tier 16: helper to tell the UI which fee-side a logged-in
// accountant owns. Used on /provider/accounting to label the header
// "บัญชี DTAM" vs "บัญชี Platform" and to hide the opposite-side
// phase-filter chips.
export function getAccountSide(
    role: string | null | undefined,
): 'DTAM' | 'PLATFORM' | 'BOTH' | null {
    const canonical = normalizeRole(role);
    if (canonical === CANONICAL_ROLES.ACCOUNT_DTAM) return 'DTAM';
    if (canonical === CANONICAL_ROLES.ACCOUNT_PLATFORM) return 'PLATFORM';
    if (
        canonical === CANONICAL_ROLES.ADMIN
        || canonical === CANONICAL_ROLES.AUDITOR
        || canonical === CANONICAL_ROLES.ACCOUNT
    ) return 'BOTH';
    return null;
}

export function isProviderRole(role: string | null | undefined): boolean {
    const canonical = normalizeRole(role);
    return canonical ? PROVIDER_ROLES.has(canonical) : false;
}
