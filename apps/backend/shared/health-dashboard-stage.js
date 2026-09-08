/**
 * Health Dashboard Stage — Enterprise Stage Model
 *
 * Maps the backend's 20 canonical workflow states into 10 user-friendly stages.
 * Aligned with frontend `lib/health-dashboard-stage.ts`.
 *
 * Source of truth: services/workflow-transition-service.js (canonical workflow)
 * This file: projection layer for health-side dashboard UX.
 */

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toUpper(value) {
  return String(value || '').trim().toUpperCase();
}

// ── 10 canonical dashboard stages ────────────────────────────────────────────
const HEALTH_DASHBOARD_STAGES = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_FEE_PHASE1: 'PENDING_FEE_PHASE1',
  // Between "I paid" and "the money is confirmed". The two slip-review
  // states were in no set here, so they fell through every branch to the
  // closing UNDER_DOCUMENT_REVIEW and a farmer who had just uploaded a
  // transfer slip was told their documents were being reviewed — while an
  // accounts officer was looking at a bank slip that could still be rejected.
  PAYMENT_UNDER_REVIEW: 'PAYMENT_UNDER_REVIEW',
  UNDER_DOCUMENT_REVIEW: 'UNDER_DOCUMENT_REVIEW',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  PENDING_FEE_PHASE2: 'PENDING_FEE_PHASE2',
  UNDER_FIELD_AUDIT: 'UNDER_FIELD_AUDIT',
  APPROVED: 'APPROVED',
  CERTIFIED: 'CERTIFIED',
  // Terminal. REJECTED / EXPIRED / CANCEL_EXPIRED matched no set below and
  // fell through every branch to the closing UNDER_DOCUMENT_REVIEW fallback,
  // so an applicant whose file had been rejected — or auto-cancelled for
  // missing the 5-working-day revision deadline — was told on their dashboard
  // that their documents were being reviewed, and waited for a result that
  // was never coming.
  CLOSED: 'CLOSED',
});

// ── Thai labels ─────────────────────────────────────────────────────────────
const STAGE_LABEL_TH = Object.freeze({
  DRAFT: 'ร่างคำขอ',
  PENDING_FEE_PHASE1: 'รอชำระค่าธรรมเนียมขั้นที่ 1',
  PAYMENT_UNDER_REVIEW: 'รอตรวจสอบการชำระเงิน',
  UNDER_DOCUMENT_REVIEW: 'อยู่ระหว่างตรวจเอกสาร',
  REVISION_REQUIRED: 'แก้ไขเอกสารตามข้อเสนอแนะ',
  PENDING_FEE_PHASE2: 'รอชำระค่าตรวจประเมินขั้นที่ 2',
  UNDER_FIELD_AUDIT: 'อยู่ระหว่างตรวจประเมินภาคสนาม',
  APPROVED: 'ผ่านการอนุมัติ',
  CERTIFIED: 'ได้รับใบรับรอง GACP',
  CLOSED: 'คำขอปิดแล้ว',
});

// ── English labels ──────────────────────────────────────────────────────────
const STAGE_LABEL_EN = Object.freeze({
  DRAFT: 'Draft',
  PENDING_FEE_PHASE1: 'Pending Phase 1 Fee',
  PAYMENT_UNDER_REVIEW: 'Payment Under Review',
  UNDER_DOCUMENT_REVIEW: 'Document Review',
  REVISION_REQUIRED: 'Revision Required',
  PENDING_FEE_PHASE2: 'Pending Phase 2 Fee',
  UNDER_FIELD_AUDIT: 'Field Audit in Progress',
  APPROVED: 'Approved',
  CERTIFIED: 'GACP Certified',
  CLOSED: 'Closed',
});

// ── Next action (tells user what TO DO) ─────────────────────────────────────
const STAGE_NEXT_ACTION_TH = Object.freeze({
  DRAFT: 'กรอกข้อมูลและยื่นคำขอ',
  PENDING_FEE_PHASE1: 'ชำระค่าธรรมเนียม',
  PAYMENT_UNDER_REVIEW: 'รอเจ้าหน้าที่ตรวจสอบหลักฐานการชำระเงิน',
  UNDER_DOCUMENT_REVIEW: 'รอผลตรวจเอกสาร',
  REVISION_REQUIRED: 'อัปโหลดเอกสารที่แก้ไข',
  PENDING_FEE_PHASE2: 'ชำระค่าตรวจประเมิน',
  UNDER_FIELD_AUDIT: 'รอผลตรวจประเมิน',
  APPROVED: 'รอออกใบรับรอง',
  CERTIFIED: 'ดาวน์โหลดใบรับรอง',
  CLOSED: 'ยื่นคำขอใหม่',
});

// ── Classification sets ─────────────────────────────────────────────────────

// Note: a `_CERTIFIED_STATES` Set was previously declared here but never
// referenced. The classification for "certified-equivalent" states is handled
// inline in `normalizeHealthDashboardStage()` (lines 116, 121) where the
// CERTIFIED/APPROVED/FINAL_APPROVED checks live next to the hasCertificate
// gate. Removed in 2026-05-04 cleanup.

// PR 2c: the "// Legacy" halves of these sets are gone. Every one of them was
// a spelling no writer can produce (PR 2b) and no row holds (the column is
// canonical), so they could never match — dead entries that read like a live
// requirement and invited new code to copy the pattern.
const AUDIT_STATES = new Set([
  'AUDIT_FEE_PAID', 'AUDIT_CONFIRMED', 'AUDIT_PASSED', 'CAR_PENDING', 'CAR_REVIEWING',
]);

const PHASE2_FEE_STATES = new Set(['DOC_APPROVED', 'PENDING_AUDIT_FEE']);

const REVISION_STATES = new Set(['REVISION_REQUESTED']);

// PENDING_REVIEW / IN_REVIEW / UNDER_REVIEW were in this set. They are not
// Application statuses at all — they belong to PaymentSlip (SLIP_STATUS in
// services/payment-slip-service.js) and PurchaseInvoice. Two unrelated domains
// shared one string, so a slip status classified an application, and the
// coupling made PaymentSlip.status impossible to change without auditing the
// application dashboard.
const DOC_REVIEW_STATES = new Set(['DOC_FEE_PAID', 'ASSIGNED_FOR_REVIEW']);

const SLIP_REVIEW_STATES = new Set([
]);

const PHASE1_FEE_STATES = new Set(['SUBMITTED', 'PENDING_DOC_FEE']);

const CLOSED_STATES = new Set(['REJECTED', 'EXPIRED', 'CANCEL_EXPIRED']);

// ── Normalization function ──────────────────────────────────────────────────

function normalizeHealthDashboardStage(application, options = {}) {
  const app = asObject(application);
  const formData = asObject(app.formData);

  const status = toUpper(app.status);
  const workflowState = toUpper(app.workflowState || formData.workflowState);
  const hasCertificate = options.hasCertificate === true
    || Number(options.certificateCount || 0) > 0
    || app.hasCertificate === true;

  // ── Terminal: Certified ──
  if (hasCertificate && (workflowState === 'CERTIFIED' || status === 'CERTIFIED')) {
    return HEALTH_DASHBOARD_STAGES.CERTIFIED;
  }

  // ── Terminal: Closed ──
  // Ahead of every "in progress" branch. A closed file must never be reported
  // as still moving, and REJECTED in particular has to beat the closing
  // UNDER_DOCUMENT_REVIEW fallback that used to swallow it.
  if (CLOSED_STATES.has(workflowState) || CLOSED_STATES.has(status)) {
    return HEALTH_DASHBOARD_STAGES.CLOSED;
  }

  // ── Approved (waiting cert issuance) ──
  if (workflowState === 'APPROVED' || status === 'APPROVED') {
    if (hasCertificate) {return HEALTH_DASHBOARD_STAGES.CERTIFIED;}
    return HEALTH_DASHBOARD_STAGES.APPROVED;
  }

  // ── Audit Passed (waiting final approval) ──
  if (workflowState === 'AUDIT_PASSED' || status === 'AUDIT_PASSED') {
    return HEALTH_DASHBOARD_STAGES.APPROVED;
  }

  // ── Field Audit phase ──
  if (AUDIT_STATES.has(workflowState) || AUDIT_STATES.has(status)) {
    return HEALTH_DASHBOARD_STAGES.UNDER_FIELD_AUDIT;
  }

  // ── Payment slip being checked ──
  // Before the fee branches: the applicant has paid, and sending them back to
  // a payment screen invites a second transfer.
  if (SLIP_REVIEW_STATES.has(workflowState) || SLIP_REVIEW_STATES.has(status)) {
    return HEALTH_DASHBOARD_STAGES.PAYMENT_UNDER_REVIEW;
  }

  // ── Pending Phase 2 Fee ──
  if (PHASE2_FEE_STATES.has(workflowState) || PHASE2_FEE_STATES.has(status)) {
    return HEALTH_DASHBOARD_STAGES.PENDING_FEE_PHASE2;
  }

  // ── Revision Required ──
  if (REVISION_STATES.has(workflowState) || REVISION_STATES.has(status)) {
    return HEALTH_DASHBOARD_STAGES.REVISION_REQUIRED;
  }

  // ── Under Document Review ──
  if (DOC_REVIEW_STATES.has(workflowState) || DOC_REVIEW_STATES.has(status)) {
    return HEALTH_DASHBOARD_STAGES.UNDER_DOCUMENT_REVIEW;
  }

  // ── Pending Phase 1 Fee ──
  if (PHASE1_FEE_STATES.has(workflowState) || PHASE1_FEE_STATES.has(status)) {
    return HEALTH_DASHBOARD_STAGES.PENDING_FEE_PHASE1;
  }

  // ── Draft ──
  if (status === 'DRAFT' || !status) {
    return HEALTH_DASHBOARD_STAGES.DRAFT;
  }

  // Fallback for unknown states
  return HEALTH_DASHBOARD_STAGES.UNDER_DOCUMENT_REVIEW;
}

// ── Process counting ────────────────────────────────────────────────────────

function buildHealthProcessCounts(applications) {
  const counts = {
    draft: 0,
    pendingFeePhase1: 0,
    paymentUnderReview: 0,
    underDocumentReview: 0,
    revisionRequired: 0,
    pendingFeePhase2: 0,
    underFieldAudit: 0,
    approved: 0,
    certified: 0,
    closed: 0,
  };

  for (const app of applications || []) {
    const stage = normalizeHealthDashboardStage(app, {
      hasCertificate: app?.hasCertificate === true,
      certificateCount: app?.certificateCount || 0,
    });

    switch (stage) {
      case HEALTH_DASHBOARD_STAGES.DRAFT:
        counts.draft += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.PENDING_FEE_PHASE1:
        counts.pendingFeePhase1 += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.PAYMENT_UNDER_REVIEW:
        counts.paymentUnderReview += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.UNDER_DOCUMENT_REVIEW:
        counts.underDocumentReview += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.REVISION_REQUIRED:
        counts.revisionRequired += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.PENDING_FEE_PHASE2:
        counts.pendingFeePhase2 += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.UNDER_FIELD_AUDIT:
        counts.underFieldAudit += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.APPROVED:
        counts.approved += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.CERTIFIED:
        counts.certified += 1;
        break;
      case HEALTH_DASHBOARD_STAGES.CLOSED:
        counts.closed += 1;
        break;
      default:
        // Unreachable while normalizeHealthDashboardStage only returns declared
        // stages — the JS stand-in for an exhaustiveness `never` check. A new
        // stage added without a counter lands here loudly instead of vanishing
        // from every dashboard total.
        throw new Error(`[health-dashboard-stage] uncounted dashboard stage: ${stage}`);
    }
  }

  // Backward compatibility: provide old keys too
  counts.waitingDocumentReview = counts.underDocumentReview + counts.revisionRequired;
  counts.waitingPayment = counts.pendingFeePhase1 + counts.pendingFeePhase2;
  counts.waitingAudit = counts.underFieldAudit + counts.approved;

  return counts;
}

module.exports = {
  HEALTH_DASHBOARD_STAGES,
  STAGE_LABEL_TH,
  STAGE_LABEL_EN,
  STAGE_NEXT_ACTION_TH,
  normalizeHealthDashboardStage,
  buildHealthProcessCounts,
};
