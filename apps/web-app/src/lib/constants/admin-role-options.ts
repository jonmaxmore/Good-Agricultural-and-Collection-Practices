/**
 * Admin role-option helper for the /admin/* UI dropdowns.
 *
 * Loop V Iter 5 (V5-A): the three pages
 *   - /admin/users (filter dropdown)
 *   - /admin/organizations/create-user-dialog (role picker)
 *   - /admin/communication (broadcast target picker)
 * each shipped with their own hardcoded role list. The Tier 16 ACCOUNT
 * split (ACCOUNT → ACCOUNT_DTAM + ACCOUNT_PLATFORM) was missed in all
 * three places, so an admin cannot filter/provision/target the new
 * accounting tiers from the UI. V5-A centralises the list here so a
 * future role addition lands in one place.
 *
 * Why this lives next to canonical-roles.ts but stays separate:
 *   - canonical-roles.ts is the runtime RBAC contract — values used for
 *     permission checks at the route layer (the JWT carries these strings).
 *   - admin-role-options.ts is the PRESENTATION layer — values shown in
 *     dropdowns, paired with Thai labels. Values in this file use the
 *     UPPER-CASE form the admin DB column stores (`ADMIN`, `ACCOUNT_DTAM`,
 *     etc.) because that is what the existing filter+create flows POST
 *     to the backend. canonical-roles.ts stores the lower-case canonical
 *     form (`admin`, `account_dtam`) used by the RBAC matrix.
 *
 * Coverage (9 canonical roles total):
 *   1. HEALTH               — applicant accounts
 *   2. DOCUMENT_REVIEWER    — Tier 1 reviewer
 *   3. SCHEDULER            — schedules audit visits
 *   4. AUDITOR              — performs on-site audits + final approval
 *   5. ACCOUNT_DTAM         — Tier 16 split: state-fee finance
 *   6. ACCOUNT_PLATFORM     — Tier 16 split: platform-fee finance
 *   7. ACCOUNT              — LEGACY (kept during migration window only)
 *   8. ADMIN                — full bypass / break-glass
 *   9. SYSTEM               — non-human actor (webhooks + cron); hidden
 *                             from admin UI by default per `hidden=true`.
 *
 * The legacy ACCOUNT entry carries `isLegacy: true` so consumers can
 * style it differently (greyed out, "(เลิกใช้)" suffix). It stays
 * selectable in the filter dropdown so admins can still find the
 * pre-migration accounts; the create-user dialog should NOT offer it
 * for new provisioning.
 */

export interface AdminRoleOption {
    /** Canonical role string as stored in the DB role column. */
    value: string;
    /** Thai display label. */
    label: string;
    /** Lower-case canonical alias as used by the runtime RBAC matrix. */
    canonical: string;
    /**
     * Marks the legacy ACCOUNT role retained for the migration window.
     * Consumers can use this to render a deprecation hint.
     */
    isLegacy?: boolean;
    /**
     * Marks the SYSTEM role as internal-only. The admin UI dropdowns
     * MUST hide entries with `hidden=true` from human pickers — SYSTEM
     * is only ever assigned by the webhook/cron bootstrapping code and
     * cannot be selected through the create-user flow.
     */
    hidden?: boolean;
}

/**
 * ตำแหน่งทั้งหมดที่ผู้ดูแลเลือกให้บัญชีหนึ่งได้ · เรียงตามที่ใช้บ่อย
 *
 * ทุกตัวเลือกในลิสต์นี้ต้องมีอยู่จริงใน CANONICAL_ROLES — ตัวเลือกที่ normalizeRole()
 * แปลไม่ออกจะสร้างบัญชีที่ล็อกอินไม่ได้ และผู้ดูแลจะไม่รู้ว่าทำไม
 * เทสที่กันเรื่องนี้: __tests__/role-options-must-be-real.test.ts
 */
export const ADMIN_ROLE_OPTIONS: ReadonlyArray<AdminRoleOption> = Object.freeze([
    Object.freeze({
        value: 'ADMIN',
        canonical: 'admin',
        label: 'ผู้ดูแลระบบ',
    }),
    Object.freeze({
        value: 'AUDITOR',
        canonical: 'auditor',
        label: 'ผู้ตรวจแปลง',
    }),
    Object.freeze({
        value: 'DOCUMENT_REVIEWER',
        canonical: 'document_reviewer',
        label: 'ผู้ตรวจเอกสาร',
    }),
    Object.freeze({
        value: 'SCHEDULER',
        canonical: 'scheduler',
        label: 'คนจัดคิว',
    }),
    Object.freeze({
        value: 'ACCOUNT',
        canonical: 'account',
        label: 'บัญชี',
    }),
    Object.freeze({
        value: 'HEALTH',
        canonical: 'health',
        label: 'ผู้ขอรับรอง',
    }),
    Object.freeze({
        value: 'SYSTEM',
        canonical: 'system',
        label: 'ระบบ (อัตโนมัติ ใช้ภายในเท่านั้น)',
        hidden: true,
    }),
] as const);

/**
 * Filter-prefixed variant for the `/admin/users` filter dropdown which
 * needs an "all roles" sentinel as the first entry. The SYSTEM entry is
 * omitted because it is never a meaningful filter target (admins do not
 * inspect cron+webhook actor accounts through the user list).
 */
export const ADMIN_ROLE_OPTIONS_WITH_ALL_PREFIX: ReadonlyArray<AdminRoleOption> = Object.freeze([
    Object.freeze({
        value: 'ALL',
        canonical: 'all',
        label: 'ทุกบทบาท',
    }),
    ...ADMIN_ROLE_OPTIONS.filter((option) => !option.hidden),
] as const);

/**
 * Picker variant for the create-user flow (/admin/organizations dialog).
 * Excludes the LEGACY ACCOUNT entry — new users should be provisioned
 * as ACCOUNT_DTAM or ACCOUNT_PLATFORM directly. Also excludes SYSTEM.
 */
export const ADMIN_ROLE_OPTIONS_FOR_NEW_USER: ReadonlyArray<AdminRoleOption> = Object.freeze(
    ADMIN_ROLE_OPTIONS.filter((option) => !option.isLegacy && !option.hidden),
);
