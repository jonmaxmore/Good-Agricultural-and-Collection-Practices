/**
 * ตำแหน่งงานทั้งหมดของ GACP Lite — คลังชื่อเดียว ไม่มีชื่อสำรอง ไม่มีชื่อเก่า
 *
 *   health             ผู้ขอรับรอง — ยื่นคำขอของตัวเอง
 *   account            บัญชี — ยืนยันว่ารับค่าธรรมเนียมแล้ว
 *   scheduler          คนจัดคิว — มอบหมายผู้ตรวจ นัดวันตรวจแปลง
 *   document_reviewer  ผู้ตรวจเอกสาร
 *   auditor            ผู้ตรวจแปลง — บันทึกผลตรวจและออกใบรับรอง
 *   admin              ผู้ดูแลระบบ — สร้างบัญชีเจ้าหน้าที่ ตั้งค่าระบบ
 *   platform_admin     เท่ากับ admin ในระบบนี้ (มีหน่วยงานเดียว) — คงชื่อไว้เพราะโค้ดอ้างถึง
 *   system             ผู้กระทำที่ไม่ใช่คน (cron) — ไม่มีสิทธิ์ใด ๆ นอกจาก edge ที่ระบุใน
 *                      ROLE_TRANSITIONS
 *
 * สิ่งที่เอาออกจากระบบเต็มโดยตั้งใจ และเหตุผล:
 *
 *   account_dtam / account_platform
 *     ระบบเต็มแยกฝ่ายบัญชีสองฝั่ง เพราะกรมฯ กับบริษัทออกเอกสารคนละชุด ลงบัญชีคนละเล่ม
 *     เลขที่ใบเสร็จคนละชุด และเซ็นด้วยกุญแจคนละดอก · GACP Lite มีหน่วยงานเดียว ไม่ออก
 *     เอกสารการเงินเลย และไม่มีสลิปให้ตรวจ การแยกจึงไม่เหลืออะไรให้แยก
 *
 *   head_auditor / approver / final_approver / reviewer_auditor / audit
 *     ชื่อสำรองของตำแหน่งเดียวกัน เกิดจากการเปลี่ยนชื่อหลายรอบในระบบเต็มแล้วต้องรับ
 *     ค่าที่ค้างอยู่ในฐานข้อมูลเดิม · Lite เริ่มจากฐานข้อมูลเปล่า จึงไม่มีค่าเก่าให้แปล
 *     และการเก็บชื่อที่แปลไปเป็นตำแหน่งอื่นไว้ คือกับดักสำหรับคนอ่านโค้ดคนต่อไป
 *
 * กติกา: ตำแหน่งหนึ่งมีชื่อเดียว · ถ้าต้องเพิ่มชื่อสำรอง แปลว่าตั้งชื่อผิดตั้งแต่แรก
 */

const CANONICAL_ROLES = Object.freeze({
  ADMIN: 'admin',
  // ผู้ดูแลข้ามหน่วยงาน · Lite มีหน่วยงานเดียว ตำแหน่งนี้จึงเท่ากับ ADMIN ในทางปฏิบัติ
  // คงไว้เพราะ routes/api/admin/* และ middleware อ้างถึง
  PLATFORM_ADMIN: 'platform_admin',
  ACCOUNT: 'account',
  SCHEDULER: 'scheduler',
  DOCUMENT_REVIEWER: 'document_reviewer',
  AUDITOR: 'auditor',
  HEALTH: 'health',
  // ผู้กระทำที่ไม่ใช่คน (cron) · ไม่มีสิทธิ์ใน ROLE_PERMISSIONS — เดินได้เฉพาะ edge ที่
  // ROLE_TRANSITIONS ให้ไว้ชัดเจน
  SYSTEM: 'system',
});

// ชื่อที่ normalizeRole() ยอมรับ · ทุกบรรทัดคือ "การสะกดของตำแหน่งที่มีอยู่จริง"
// ไม่ใช่ "ตำแหน่งเก่าที่แปลเป็นตำแหน่งอื่น" — อย่างหลังคือสิ่งที่ทำให้คนอ่านเข้าใจผิด
const ROLE_ALIASES = Object.freeze({
  admin: CANONICAL_ROLES.ADMIN,
  platform_admin: CANONICAL_ROLES.PLATFORM_ADMIN,
  account: CANONICAL_ROLES.ACCOUNT,
  scheduler: CANONICAL_ROLES.SCHEDULER,
  document_reviewer: CANONICAL_ROLES.DOCUMENT_REVIEWER,
  auditor: CANONICAL_ROLES.AUDITOR,
  health: CANONICAL_ROLES.HEALTH,
  system: CANONICAL_ROLES.SYSTEM,
  // ผู้กระทำอัตโนมัติสะกดต่างกันตามที่มา แต่เป็นตัวเดียวกัน
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
  // not match. The audit trail records actorRole = ACCOUNT so an auditor can see
  // which officer said the money arrived.
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
  CANONICAL_ROLES.ACCOUNT,
]);

// กลุ่มตำแหน่งที่ตั้งชื่อไว้ — ใช้แทนการเขียนอาร์เรย์ของ role ตรง ๆ ใน route
// ทุกค่าเป็น canonical ตัวเล็กอย่างเดียว: Lite ออก JWT เองทั้งหมดและออกเป็น canonical
// เสมอ จึงไม่มีค่าตัวใหญ่ให้ต้องรับ
const ROLE_GROUPS = Object.freeze({
  ALL_PROVIDER: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR, CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.ACCOUNT,
    'ADMIN', 'AUDITOR', 'SCHEDULER', ],
  ADMIN_ONLY: [
    CANONICAL_ROLES.ADMIN, 'ADMIN',
  ],
  // Cross-tenant platform operator only (ADR-014 / SEC-PROV-001). Tenant ADMIN
  // is intentionally NOT included — that is the cross-tenant separation.
  PLATFORM_ADMIN_ONLY: [
    CANONICAL_ROLES.PLATFORM_ADMIN, 'PLATFORM_ADMIN',
  ],
  REVIEWERS: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER, CANONICAL_ROLES.AUDITOR,
    'ADMIN', 'AUDITOR',
  ],
  AUDIT_STAFF: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR, CANONICAL_ROLES.SCHEDULER,
    'ADMIN', 'AUDITOR', 'SCHEDULER',
  ],
  // Tier 16: FINANCE now spans both split roles + legacy ACCOUNT so
  // existing callers (finance reports, bank-account routes) keep
  // working for all three role values. Side-specific authorisation
  // happens deeper in the call stack — at the slip-service layer.
  FINANCE: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.ACCOUNT,
    'ADMIN',
    ],
  // Tier 16: ACCOUNT_STAFF — explicit group for routes that need any
  // accounting role regardless of side. Includes the legacy bare
  // ACCOUNT so pre-migration users still satisfy requireRole().
  ACCOUNT_STAFF: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.ACCOUNT,
    'ADMIN',
    ],
  SCHEDULERS: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.SCHEDULER,
    'ADMIN', 'SCHEDULER',
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
    CANONICAL_ROLES.ADMIN, 'ADMIN',
  ],
  FULL_STAFF: [
    CANONICAL_ROLES.ADMIN, CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR, CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.ACCOUNT,
    'ADMIN', 'AUDITOR', 'SCHEDULER', ],
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
  // export เพื่อให้เทสเฝ้าได้จากข้างนอกว่าไม่มีชื่อสำรองที่ชี้ไปตำแหน่งที่ไม่มีอยู่
  ROLE_ALIASES,
  PERMISSIONS,
  ROLE_GROUPS,
  normalizeRole,
  hasPermission,
  isProviderRole,
  canonicalToLegacyRole,
};
