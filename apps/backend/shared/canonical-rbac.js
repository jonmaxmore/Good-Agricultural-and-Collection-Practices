/**
 * Canonical RBAC model for provider/health workflow.
 * Keeps compatibility with existing legacy role values.
 *
 * NOTE: HEAD_AUDITOR has been consolidated into AUDITOR.
 * The enum key is retained for backward compatibility but resolves to 'auditor'.
 *
 * Tier 16 (B16-B handoff, 2026-05-16): ACCOUNT split. The single
 * `ACCOUNT` role is split into:
 *   - `ACCOUNT_DTAM`     → reviews STATE-side payment slips
 *                          (PHASE_1_STATE_FEE / PHASE_2_STATE_FEE)
 *   - `ACCOUNT_PLATFORM` → reviews PLATFORM-side payment slips
 *                          (PHASE_1_PLATFORM_FEE / PHASE_2_PLATFORM_FEE
 *                          + subscription invoices)
 *
 * Rationale: the DTAM accounting team (กรมการแพทย์แผนไทยฯ) and the
 * platform accounting team (เอกชน/บริษัท) work on strictly disjoint
 * slip queues — DTAM books revenue under government-revenue ledger
 * (Wallet A), platform books under commercial books with output VAT
 * (Wallet B). A single approver must not be able to mix the queues
 * because the receipt template / numbering / signing key differ.
 *
 * Backward compat:
 *   - The legacy `ACCOUNT` role / `account` value is kept in
 *     ROLE_ALIASES and PERMISSIONS so existing JWTs do not 401.
 *     A migration script (`scripts/migrate-account-role.js`) moves
 *     existing users to one of the new roles. Until the migration
 *     runs, ACCOUNT users keep the union permission set, but the
 *     payment-slip service additionally filters by issuer side per
 *     role — see resolveAllowedIssuerSides() in payment-slip-service.js.
 */

const CANONICAL_ROLES = Object.freeze({
  ADMIN: 'admin',
  // PLATFORM_ADMIN — cross-tenant platform operator (ADR-014). A superset of
  // ADMIN; the ONLY role permitted on the platform-admin org-management surface
  // (withoutTenantScope). Tenant ADMINs are scoped to their own org (SEC-PROV-001).
  PLATFORM_ADMIN: 'platform_admin',
  SCHEDULER: 'scheduler',
  DOCUMENT_REVIEWER: 'document_reviewer',
  AUDITOR: 'auditor',
  HEAD_AUDITOR: 'auditor', // Consolidated: HEAD_AUDITOR → AUDITOR
  AUDIT: 'auditor',        // Legacy alias
  // Tier 16 split: ACCOUNT → ACCOUNT_DTAM | ACCOUNT_PLATFORM
  ACCOUNT_DTAM: 'account_dtam',
  ACCOUNT_PLATFORM: 'account_platform',
  // Legacy ACCOUNT retained for backward compat. New users should be
  // provisioned as ACCOUNT_DTAM or ACCOUNT_PLATFORM. The migration
  // script flips existing ACCOUNT users to ACCOUNT_PLATFORM by default
  // (the platform-side is the larger of the two teams at launch).
  ACCOUNT: 'account',
  HEALTH: 'health',
  // SYSTEM is a non-human actor used by webhooks (lab, payment) and cron jobs.
  // It has NO permissions in ROLE_PERMISSIONS — system actors can only execute
  // workflow transitions explicitly granted in ROLE_TRANSITIONS (see
  // workflow-transition-service.js). Audit-log entries from system actors
  // already use the literal 'SYSTEM'/'system' value; this canonical role
  // makes that explicit so role normalisation does not fail for it.
  SYSTEM: 'system',
});

const ROLE_ALIASES = Object.freeze({
  admin: CANONICAL_ROLES.ADMIN,
  super_admin: CANONICAL_ROLES.ADMIN,
  platform_admin: CANONICAL_ROLES.PLATFORM_ADMIN,
  platform_owner: CANONICAL_ROLES.PLATFORM_ADMIN,
  scheduler: CANONICAL_ROLES.SCHEDULER,
  reviewer: CANONICAL_ROLES.DOCUMENT_REVIEWER,
  reviewer_auditor: CANONICAL_ROLES.DOCUMENT_REVIEWER,
  document_reviewer: CANONICAL_ROLES.DOCUMENT_REVIEWER,
  auditor: CANONICAL_ROLES.AUDITOR,
  inspector: CANONICAL_ROLES.AUDITOR,
  audit: CANONICAL_ROLES.AUDITOR,
  head_auditor: CANONICAL_ROLES.AUDITOR, // Consolidated into auditor
  approver: CANONICAL_ROLES.AUDITOR,     // Consolidated into auditor
  final_approver: CANONICAL_ROLES.AUDITOR, // Consolidated into auditor
  // Tier 16 ACCOUNT split — explicit canonical values + common
  // legacy aliases. The bare `account` alias intentionally resolves
  // to the legacy ACCOUNT role so existing JWTs keep working;
  // the migration script flips DB rows so subsequent logins get the
  // split role from the JWT generator.
  account_dtam: CANONICAL_ROLES.ACCOUNT_DTAM,
  accountant_dtam: CANONICAL_ROLES.ACCOUNT_DTAM,
  dtam_account: CANONICAL_ROLES.ACCOUNT_DTAM,
  finance_dtam: CANONICAL_ROLES.ACCOUNT_DTAM,
  account_platform: CANONICAL_ROLES.ACCOUNT_PLATFORM,
  accountant_platform: CANONICAL_ROLES.ACCOUNT_PLATFORM,
  platform_account: CANONICAL_ROLES.ACCOUNT_PLATFORM,
  finance_platform: CANONICAL_ROLES.ACCOUNT_PLATFORM,
  account: CANONICAL_ROLES.ACCOUNT,
  accountant: CANONICAL_ROLES.ACCOUNT,
  finance: CANONICAL_ROLES.ACCOUNT,
  health: CANONICAL_ROLES.HEALTH,
  // `applicant` is a legacy role-string alias for HEALTH. normalizeRole()
  // lowercases its input before lookup, so the alias is keyed lowercase to
  // match (a proper-case `Applicant` key would never be hit). Canonical
  // contract §4.3 (canonical-auth-session-rbac-contract.md) pins this
  // normalization for legacy role strings; that document's ThaID route shape
  // itself is superseded (see the banner at its top) but this alias table is
  // unaffected. (External IdPs ARE wired — the registry SSOT is
  // config/auth-providers.js: local/healthid/providerid/thaid. thaid is live
  // (services/auth/thaid-identity-service.js + services/auth/idp/thaid-
  // adapter.js); healthid/providerid stay coming_soon pending MOPH
  // credentials/docs. Password (national-ID) login is TRANSITIONAL per the
  // operator's 2026-08-19 directive — target state is ThaID + หมอพร้อม only.
  // This is purely a string normalizer; it does not decide which providers
  // are wired.)
  applicant: CANONICAL_ROLES.HEALTH,
  system: CANONICAL_ROLES.SYSTEM,
  webhook: CANONICAL_ROLES.SYSTEM,
  cron: CANONICAL_ROLES.SYSTEM,
});

const PERMISSIONS = Object.freeze({
  APPLICATION_SUBMIT: 'application.submit',
  APPLICATION_VIEW_SELF: 'application.view.self',
  APPLICATION_VIEW_ALL: 'application.view.all',
  // ประตูตามสอบย้อนกลับทั่วประเทศ (รอบปลูก แปลง กิจกรรม ของทุกฟาร์ม) — แยกจาก
  // APPLICATION_VIEW_ALL เพราะสองอย่างนี้คือข้อมูลคนละชุด "ดูใบสมัครทั้งหมด" เป็นสิ่งที่ฝ่าย
  // การเงินต้องมีเพื่อออกใบแจ้งหนี้ ส่วน "ดูไทม์ไลน์การเพาะปลูกและตำแหน่งแปลงของทุกฟาร์ม"
  // ไม่ใช่งานของเขา — มติ operator 2026-09-07: ฝ่ายการเงิน "เห็นแค่ billing หรือ transaction
  // และข้อมูลที่เอาไปทำบัญชีเท่านั้น" (F-SCOPE-01)
  TRACKING_VIEW_ALL: 'tracking.view.all',
  APPLICATION_DOC_REVIEW: 'application.document.review',
  APPLICATION_SCHEDULE: 'application.schedule',
  APPLICATION_AUDIT_RECORD: 'application.audit.record',
  APPLICATION_WORKFLOW_TRANSITION: 'application.workflow.transition',
  USERS_MANAGE: 'users.manage',
  MASTER_DATA_MANAGE: 'master_data.manage',
  ACCOUNTING_DASHBOARD_READ: 'accounting.dashboard.read',
  INVOICE_VIEW_ALL: 'invoice.view.all',
  RECEIPT_ISSUE: 'receipt.issue',
  REPORT_EXPORT: 'report.export',
  AUDIT_TIMELINE_READ: 'audit.timeline.read',
  AUDIT_SUBMIT: 'audit.submit',
  APPLICATION_OVERRIDE: 'application.override',
  // Slip-flow (2026-04-29): manual bank-transfer + slip-upload + ACCOUNT review
  // replaces the prior gateway/webhook integration. See:
  //   docs/architecture/2026-04-29-rfc-payment-slip-flow.md
  BANK_ACCOUNT_READ_ALL: 'bank_account.read.all',
  BANK_ACCOUNT_MANAGE: 'bank_account.manage',
  PAYMENT_SLIP_READ_ALL: 'payment_slip.read.all',
  // Generic review permission retained for legacy ACCOUNT users until
  // migration completes. New routes should check the side-specific
  // keys below.
  PAYMENT_SLIP_REVIEW: 'payment_slip.review',
  // Tier 16 ACCOUNT split — side-specific review permissions. The
  // payment-slip-service consults reviewer.role at runtime to decide
  // which side (DTAM / PLATFORM) the slip belongs to, and rejects with
  // 403 INVALID_REVIEWER_SIDE if the slip's invoice serviceType does
  // not match. The audit trail records actorRole = ACCOUNT_DTAM /
  // ACCOUNT_PLATFORM so auditors can prove segregation of duties.
  PAYMENT_SLIP_REVIEW_DTAM: 'payment_slip.review.dtam',
  PAYMENT_SLIP_REVIEW_PLATFORM: 'payment_slip.review.platform',
  // Admin-only — for support / break-glass scenarios. Routes log
  // [admin-override] when ADMIN reviews a slip so post-incident
  // review can flag the bypass. AUDITOR carries the read-only
  // variant of this via PAYMENT_SLIP_READ_ALL.
  PAYMENT_SLIP_REVIEW_ANY: 'payment_slip.review.any',
  PAYMENT_SLIP_READ_OWN: 'payment_slip.read.own',
});

// Permission sets shared by both new ACCOUNT_* roles — extracted so the
// declarations below stay compact and the side-specific permission is
// the only meaningful difference.
const ACCOUNT_BASE_PERMISSIONS = [
  PERMISSIONS.APPLICATION_VIEW_ALL,
  PERMISSIONS.ACCOUNTING_DASHBOARD_READ,
  PERMISSIONS.INVOICE_VIEW_ALL,
  PERMISSIONS.RECEIPT_ISSUE,
  PERMISSIONS.REPORT_EXPORT,
  PERMISSIONS.AUDIT_TIMELINE_READ,
  PERMISSIONS.BANK_ACCOUNT_READ_ALL,
  PERMISSIONS.BANK_ACCOUNT_MANAGE,
  PERMISSIONS.PAYMENT_SLIP_READ_ALL,
  // Generic review kept so legacy middleware checks pass; the
  // payment-slip-service still enforces the per-side gate.
  PERMISSIONS.PAYMENT_SLIP_REVIEW,
];

const ROLE_PERMISSIONS = Object.freeze({
  [CANONICAL_ROLES.HEALTH]: new Set([
    PERMISSIONS.APPLICATION_SUBMIT,
    PERMISSIONS.APPLICATION_VIEW_SELF,
    // Slip-flow: applicants see only their own slips
    PERMISSIONS.PAYMENT_SLIP_READ_OWN,
  ]),
  [CANONICAL_ROLES.DOCUMENT_REVIEWER]: new Set([
    PERMISSIONS.TRACKING_VIEW_ALL,
    PERMISSIONS.APPLICATION_VIEW_ALL,
    PERMISSIONS.APPLICATION_DOC_REVIEW,
    PERMISSIONS.APPLICATION_WORKFLOW_TRANSITION,
    PERMISSIONS.AUDIT_TIMELINE_READ,
  ]),
  [CANONICAL_ROLES.SCHEDULER]: new Set([
    PERMISSIONS.TRACKING_VIEW_ALL,
    PERMISSIONS.APPLICATION_VIEW_ALL,
    PERMISSIONS.APPLICATION_SCHEDULE,
    PERMISSIONS.APPLICATION_WORKFLOW_TRANSITION,
    PERMISSIONS.AUDIT_TIMELINE_READ,
    PERMISSIONS.REPORT_EXPORT,
  ]),
  [CANONICAL_ROLES.AUDITOR]: new Set([
    PERMISSIONS.TRACKING_VIEW_ALL,
    PERMISSIONS.APPLICATION_VIEW_ALL,
    PERMISSIONS.APPLICATION_DOC_REVIEW,
    PERMISSIONS.APPLICATION_AUDIT_RECORD,
    PERMISSIONS.APPLICATION_WORKFLOW_TRANSITION,
    PERMISSIONS.AUDIT_TIMELINE_READ,
    PERMISSIONS.AUDIT_SUBMIT,
    PERMISSIONS.REPORT_EXPORT,
    // Tier 16: AUDITOR gets read-only visibility across BOTH sides so
    // segregation-of-duties audits can be performed. No write/approve.
    PERMISSIONS.PAYMENT_SLIP_READ_ALL,
  ]),
  // HEAD_AUDITOR permissions removed — consolidated into AUDITOR above
  [CANONICAL_ROLES.ACCOUNT_DTAM]: new Set([
    ...ACCOUNT_BASE_PERMISSIONS,
    // STATE-side only: PHASE_1_STATE_FEE / PHASE_2_STATE_FEE invoices.
    // The service-layer side-check rejects PLATFORM slips with 403.
    PERMISSIONS.PAYMENT_SLIP_REVIEW_DTAM,
  ]),
  [CANONICAL_ROLES.ACCOUNT_PLATFORM]: new Set([
    ...ACCOUNT_BASE_PERMISSIONS,
    // PLATFORM-side only: PHASE_1_PLATFORM_FEE / PHASE_2_PLATFORM_FEE
    // + subscription invoices. State-side slips return 403.
    PERMISSIONS.PAYMENT_SLIP_REVIEW_PLATFORM,
  ]),
  // Legacy ACCOUNT: union of both review permissions so existing
  // pre-migration users keep working. The service still enforces a
  // per-call side filter — see resolveAllowedIssuerSides(). After the
  // migration script runs this role should have no live users.
  [CANONICAL_ROLES.ACCOUNT]: new Set([
    ...ACCOUNT_BASE_PERMISSIONS,
    PERMISSIONS.PAYMENT_SLIP_REVIEW_DTAM,
    PERMISSIONS.PAYMENT_SLIP_REVIEW_PLATFORM,
  ]),
  [CANONICAL_ROLES.ADMIN]: new Set(Object.values(PERMISSIONS)),
  // PLATFORM_ADMIN is a superset of ADMIN (all permissions) plus the
  // cross-tenant org-management surface gated by ROLE_GROUPS.PLATFORM_ADMIN_ONLY.
  [CANONICAL_ROLES.PLATFORM_ADMIN]: new Set(Object.values(PERMISSIONS)),
});

const PROVIDER_CANONICAL_ROLES = new Set([
  CANONICAL_ROLES.ADMIN,
  CANONICAL_ROLES.PLATFORM_ADMIN,
  CANONICAL_ROLES.SCHEDULER,
  CANONICAL_ROLES.DOCUMENT_REVIEWER,
  CANONICAL_ROLES.AUDITOR,
  // HEAD_AUDITOR removed — resolves to 'auditor' via alias
  CANONICAL_ROLES.ACCOUNT_DTAM,
  CANONICAL_ROLES.ACCOUNT_PLATFORM,
  // Legacy role retained until migration completes.
  CANONICAL_ROLES.ACCOUNT,
]);

// Named role groups — use these instead of hardcoded role arrays in routes.
// Each group includes both canonical (lowercase) and legacy (uppercase) values
// so that requireRole() works regardless of how the JWT encodes the role.
const ROLE_GROUPS = Object.freeze({
  ALL_PROVIDER: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR, CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.ACCOUNT_DTAM, CANONICAL_ROLES.ACCOUNT_PLATFORM,
    CANONICAL_ROLES.ACCOUNT,
    'ADMIN', 'SUPER_ADMIN', 'REVIEWER_AUDITOR', 'AUDITOR', 'SCHEDULER',
    'ACCOUNTANT', 'ACCOUNT_DTAM', 'ACCOUNT_PLATFORM',
  ],
  ADMIN_ONLY: [
    CANONICAL_ROLES.ADMIN, 'ADMIN', 'SUPER_ADMIN',
  ],
  // Cross-tenant platform operator only (ADR-014 / SEC-PROV-001). Tenant ADMIN
  // is intentionally NOT included — that is the cross-tenant separation.
  PLATFORM_ADMIN_ONLY: [
    CANONICAL_ROLES.PLATFORM_ADMIN, 'PLATFORM_ADMIN',
  ],
  REVIEWERS: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER, CANONICAL_ROLES.AUDITOR,
    'ADMIN', 'SUPER_ADMIN', 'REVIEWER_AUDITOR', 'AUDITOR',
  ],
  AUDIT_STAFF: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR, CANONICAL_ROLES.SCHEDULER,
    'ADMIN', 'SUPER_ADMIN', 'REVIEWER_AUDITOR', 'AUDITOR', 'SCHEDULER',
  ],
  // Tier 16: FINANCE now spans both split roles + legacy ACCOUNT so
  // existing callers (finance reports, bank-account routes) keep
  // working for all three role values. Side-specific authorisation
  // happens deeper in the call stack — at the slip-service layer.
  FINANCE: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.ACCOUNT_DTAM,
    CANONICAL_ROLES.ACCOUNT_PLATFORM, CANONICAL_ROLES.ACCOUNT,
    'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT',
    'ACCOUNT_DTAM', 'ACCOUNT_PLATFORM',
  ],
  // Tier 16: ACCOUNT_STAFF — explicit group for routes that need any
  // accounting role regardless of side. Includes the legacy bare
  // ACCOUNT so pre-migration users still satisfy requireRole().
  ACCOUNT_STAFF: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.ACCOUNT_DTAM,
    CANONICAL_ROLES.ACCOUNT_PLATFORM, CANONICAL_ROLES.ACCOUNT,
    'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT',
    'ACCOUNT_DTAM', 'ACCOUNT_PLATFORM',
  ],
  SCHEDULERS: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.SCHEDULER,
    'ADMIN', 'SUPER_ADMIN', 'SCHEDULER',
  ],
  // Records audit decisions (AUDIT_CONFIRMED → AUDIT_PASSED|CAR_PENDING|
  // REJECTED) per canonical workflow contract §1.3. Narrower than
  // REVIEWERS — document_reviewer cannot record audit results, only
  // doc-review transitions.
  // AUDIT-001 (2026-06-24): ADMIN/SUPER_ADMIN REMOVED — admin is not in the audit
  // decision path (SoD; cf. workflow-transition-service "admin is not in the workflow").
  // The per-route AUDITORS gate now admits only the AUDITOR role. Admin recovery is via
  // the workflow `force` path, or ADMIN_AUDIT_OVERRIDE below on explicit force/recovery
  // routes — never the normal audit-decision routes.
  AUDITORS: [
    CANONICAL_ROLES.AUDITOR,
    'AUDITOR',
  ],
  // Admin/super-admin audit override — reserved for explicit force/recovery routes
  // ONLY. Do NOT use on the normal audit-decision/onsite routes (those use AUDITORS).
  ADMIN_AUDIT_OVERRIDE: [
    CANONICAL_ROLES.ADMIN, 'ADMIN', 'SUPER_ADMIN',
  ],
  FULL_STAFF: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR, CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.ACCOUNT_DTAM, CANONICAL_ROLES.ACCOUNT_PLATFORM,
    CANONICAL_ROLES.ACCOUNT,
    'ADMIN', 'SUPER_ADMIN', 'REVIEWER_AUDITOR', 'AUDITOR', 'SCHEDULER',
    'ACCOUNTANT', 'ACCOUNT_DTAM', 'ACCOUNT_PLATFORM',
  ],
});

function normalizeRole(role) {
  const key = String(role || '').trim().toLowerCase();
  if (!key) {
    return null;
  }
  return ROLE_ALIASES[key] || null;
}

function hasPermission(role, permission) {
  const canonicalRole = normalizeRole(role);
  if (!canonicalRole) {
    return false;
  }
  const granted = ROLE_PERMISSIONS[canonicalRole];
  return granted ? granted.has(permission) : false;
}

function isProviderRole(role) {
  const canonicalRole = normalizeRole(role);
  return canonicalRole ? PROVIDER_CANONICAL_ROLES.has(canonicalRole) : false;
}

function canonicalToLegacyRole(canonicalRole) {
  switch (normalizeRole(canonicalRole)) {
    case CANONICAL_ROLES.ADMIN:
      return 'ADMIN';
    case CANONICAL_ROLES.PLATFORM_ADMIN:
      return 'PLATFORM_ADMIN';
    case CANONICAL_ROLES.SCHEDULER:
      return 'SCHEDULER';
    case CANONICAL_ROLES.DOCUMENT_REVIEWER:
      return 'REVIEWER_AUDITOR';
    case CANONICAL_ROLES.AUDITOR:
      return 'AUDITOR';
    // HEAD_AUDITOR case removed — resolves to AUDITOR via alias
    case CANONICAL_ROLES.ACCOUNT_DTAM:
      return 'ACCOUNT_DTAM';
    case CANONICAL_ROLES.ACCOUNT_PLATFORM:
      return 'ACCOUNT_PLATFORM';
    case CANONICAL_ROLES.ACCOUNT:
      return 'ACCOUNTANT';
    case CANONICAL_ROLES.HEALTH:
      return 'HEALTH';
    default:
      return null;
  }
}

module.exports = {
  CANONICAL_ROLES,
  PERMISSIONS,
  ROLE_GROUPS,
  normalizeRole,
  hasPermission,
  isProviderRole,
  canonicalToLegacyRole,
};
