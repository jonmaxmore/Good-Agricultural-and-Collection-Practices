/**
 * Health Dashboard Stage — applicant-facing progress model.
 *
 * Maps the backend's canonical workflow states into user-friendly stages that
 * reflect the real GACP certification lifecycle.
 *
 * The old 5-stage model collapsed too many states together, making it impossible
 * for applicants to understand where they were in the process.
 *
 * Mirrors apps/backend/shared/health-dashboard-stage.js — the two normalizers
 * must agree, and both are pinned by tests against the workflow SSOT.
 */

/**
 * The stage union, declared once as data so tests and callers can iterate it.
 * Every copy table below is a `Record<HealthDashboardStage, …>`, so adding a
 * stage here is a compile error until every renderer handles it — this is the
 * exhaustiveness guarantee, not a convention.
 */
export const HEALTH_DASHBOARD_STAGES = [
  'DRAFT',
  'PENDING_FEE_PHASE1',
  // Between "I paid" and "the money is confirmed".
  'PAYMENT_UNDER_REVIEW',
  'UNDER_DOCUMENT_REVIEW',
  'REVISION_REQUIRED',
  'PENDING_FEE_PHASE2',
  'UNDER_FIELD_AUDIT',
  'APPROVED',
  'CERTIFIED',
  // Terminal. REJECTED / EXPIRED / CANCEL_EXPIRED were in no classification
  // set below and fell through to the closing UNDER_DOCUMENT_REVIEW fallback,
  // so a rejected applicant was told their documents were under review.
  'CLOSED',
] as const;

export type HealthDashboardStage = (typeof HEALTH_DASHBOARD_STAGES)[number];

/**
 * Stages where the file is finished and the stepper no longer applies. Callers
 * must branch on this rather than on `getStepperIndex(...) === 0`, which DRAFT
 * also satisfies.
 */
const TERMINAL_STAGES = new Set<HealthDashboardStage>(['CLOSED']);

export function isTerminalStage(stage: HealthDashboardStage): boolean {
  return TERMINAL_STAGES.has(stage);
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const STAGE_LABEL_TH: Record<HealthDashboardStage, string> = {
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
};

export const STAGE_LABEL_EN: Record<HealthDashboardStage, string> = {
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
};

// ── Descriptions (tells user what's happening) ──────────────────────────────

export const STAGE_DESCRIPTION_TH: Record<HealthDashboardStage, string> = {
  DRAFT: 'คำขอยังไม่ได้ส่ง กรุณากรอกข้อมูลให้ครบถ้วนแล้วกดยื่นคำขอ',
  PENDING_FEE_PHASE1: 'กรุณาชำระค่าธรรมเนียมยื่นคำขอ เพื่อเข้าสู่ขั้นตอนตรวจเอกสาร',
  PAYMENT_UNDER_REVIEW: 'เจ้าหน้าที่การเงินกำลังตรวจสอบหลักฐานการชำระเงินของท่าน',
  UNDER_DOCUMENT_REVIEW: 'เจ้าหน้าที่กำลังตรวจสอบเอกสารของท่าน กรุณารอผลการตรวจ',
  REVISION_REQUIRED: 'เจ้าหน้าที่แจ้งให้แก้ไขเอกสาร กรุณาอัปโหลดเอกสารที่แก้ไขภายในกำหนด',
  PENDING_FEE_PHASE2: 'เอกสารผ่านการตรวจสอบแล้ว กรุณาชำระค่าตรวจประเมินภาคสนาม',
  UNDER_FIELD_AUDIT: 'เจ้าหน้าที่กำลังดำเนินการตรวจประเมินภาคสนาม กรุณารอผลการตรวจ',
  APPROVED: 'คำขอได้รับการอนุมัติแล้ว อยู่ระหว่างจัดทำใบรับรอง GACP',
  CERTIFIED: 'ท่านได้รับใบรับรอง GACP แล้ว สามารถดาวน์โหลดได้จากหน้าใบรับรอง',
  CLOSED: 'คำขอนี้ปิดแล้ว (ไม่อนุมัติ หรือหมดเวลาดำเนินการ) ท่านสามารถยื่นคำขอใหม่ได้',
};

// ── Next Action (tells user what TO DO) ──────────────────────────────────────

export const STAGE_NEXT_ACTION_TH: Record<HealthDashboardStage, string> = {
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
};

// ── Badge Colors ────────────────────────────────────────────────────────────

export const STAGE_BADGE_STYLE: Record<HealthDashboardStage, { bg: string; text: string; dot: string }> = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  PENDING_FEE_PHASE1: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  PAYMENT_UNDER_REVIEW: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  UNDER_DOCUMENT_REVIEW: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  REVISION_REQUIRED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  PENDING_FEE_PHASE2: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  UNDER_FIELD_AUDIT: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  APPROVED: { bg: 'bg-leaf-soft', text: 'text-leaf-700', dot: 'bg-leaf-600' },
  CERTIFIED: { bg: 'bg-leaf-soft', text: 'text-leaf-800', dot: 'bg-leaf-700' },
  CLOSED: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
};

// ── Stepper Configuration ───────────────────────────────────────────────────

// CLOSED is deliberately absent: it is not a rung, it is the end of the road.
export const STEPPER_STEPS: Array<{
  stage: Exclude<HealthDashboardStage, 'CLOSED'>;
  label: string;
  shortLabel: string;
  icon: string;
}> = [
  { stage: 'DRAFT', label: 'ร่างคำขอ', shortLabel: 'ร่าง', icon: 'FileEdit' },
  { stage: 'PENDING_FEE_PHASE1', label: 'ชำระค่าธรรมเนียม ขั้นที่ 1', shortLabel: 'ชำระเงิน 1', icon: 'CreditCard' },
  { stage: 'PAYMENT_UNDER_REVIEW', label: 'ตรวจสอบการชำระเงิน', shortLabel: 'ตรวจชำระเงิน', icon: 'Search' },
  { stage: 'UNDER_DOCUMENT_REVIEW', label: 'ตรวจเอกสาร', shortLabel: 'ตรวจเอกสาร', icon: 'FileSearch' },
  { stage: 'REVISION_REQUIRED', label: 'แก้ไขเอกสาร', shortLabel: 'แก้ไข', icon: 'FilePen' },
  { stage: 'PENDING_FEE_PHASE2', label: 'ชำระค่าตรวจประเมิน ขั้นที่ 2', shortLabel: 'ชำระเงิน 2', icon: 'CreditCard' },
  { stage: 'UNDER_FIELD_AUDIT', label: 'ตรวจประเมินภาคสนาม', shortLabel: 'ตรวจสนาม', icon: 'ClipboardCheck' },
  { stage: 'APPROVED', label: 'อนุมัติ', shortLabel: 'อนุมัติ', icon: 'CheckCircle' },
  { stage: 'CERTIFIED', label: 'ออกใบรับรอง', shortLabel: 'ใบรับรอง', icon: 'Award' },
];

// ── Stepper index (for progress %) ──────────────────────────────────────────

export function getStepperIndex(stage: HealthDashboardStage): number {
  // REVISION_REQUIRED goes back to index 2 (document review area) on the stepper
  // but we treat it as its own visual step for clarity.
  //
  // Terminal stages return -1 — "not on the ladder". Collapsing them to 0 (the
  // old behaviour for any stage the stepper did not know) rendered a closed
  // file as a fresh draft sitting on step 1 of 9.
  const idx = STEPPER_STEPS.findIndex((s) => s.stage === stage);
  if (idx >= 0) return idx;
  return isTerminalStage(stage) ? -1 : 0;
}

export function getProgressPercent(stage: HealthDashboardStage): number {
  const idx = getStepperIndex(stage);
  if (idx < 0) return 0;
  return Math.round((idx / (STEPPER_STEPS.length - 1)) * 100);
}

// ── State Normalization ─────────────────────────────────────────────────────

type StageLikeApplication = {
  status?: string | null;
  workflowState?: string | null;
  phase1Status?: string | null;
  phase2Status?: string | null;
  formData?: { workflowState?: string | null } | null;
  dashboardStage?: string | null;
  hasCertificate?: boolean | null;
};

function toUpper(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

export function normalizeHealthDashboardStage(
  app: StageLikeApplication,
): HealthDashboardStage {
  const status = toUpper(app?.status);
  const workflowState = toUpper(app?.workflowState || app?.formData?.workflowState);
  const hasCertificate = app?.hasCertificate === true;

  // ── Terminal: Certified ──
  if (hasCertificate && (workflowState === 'CERTIFIED' || status === 'CERTIFIED')) {
    return 'CERTIFIED';
  }

  // ── Terminal: Closed ──
  // Ahead of every "in progress" branch — a closed file must never be reported
  // as still moving, and REJECTED in particular has to beat the closing
  // UNDER_DOCUMENT_REVIEW fallback that used to swallow it.
  const CLOSED_STATES = new Set(['REJECTED', 'EXPIRED', 'CANCEL_EXPIRED']);
  if (CLOSED_STATES.has(workflowState) || CLOSED_STATES.has(status)) {
    return 'CLOSED';
  }

  // ── Approved (waiting cert issuance) ──
  if (workflowState === 'APPROVED' || status === 'APPROVED') {
    if (hasCertificate) return 'CERTIFIED';
    return 'APPROVED';
  }

  // ── Field Audit phase ──
  const AUDIT_STATES = new Set([
    'AUDIT_FEE_PAID', 'AUDIT_CONFIRMED', 'CAR_PENDING', 'CAR_REVIEWING', 'AUDIT_PASSED',
  ]);
  if (AUDIT_STATES.has(workflowState) || AUDIT_STATES.has(status)) {
    return 'UNDER_FIELD_AUDIT';
  }

  // ── Pending Phase 2 Fee ──
  const PHASE2_FEE_STATES = new Set(['DOC_APPROVED', 'PENDING_AUDIT_FEE']);
  if (PHASE2_FEE_STATES.has(workflowState) || PHASE2_FEE_STATES.has(status)) {
    return 'PENDING_FEE_PHASE2';
  }

  // ── Revision Required ──
  const REVISION_STATES = new Set(['REVISION_REQUESTED']);
  if (REVISION_STATES.has(workflowState) || REVISION_STATES.has(status)) {
    return 'REVISION_REQUIRED';
  }

  // ── Under Document Review ──
  // PENDING_REVIEW / IN_REVIEW / UNDER_REVIEW belonged to other domain models,
  // not to Application — two domains sharing one string would let one model's
  // status classify an application. Only the canonical Application states below.
  const DOC_REVIEW_STATES = new Set(['DOC_FEE_PAID', 'ASSIGNED_FOR_REVIEW']);
  if (DOC_REVIEW_STATES.has(workflowState) || DOC_REVIEW_STATES.has(status)) {
    return 'UNDER_DOCUMENT_REVIEW';
  }

  // ── Pending Phase 1 Fee ──
  const PHASE1_FEE_STATES = new Set(['SUBMITTED', 'PENDING_DOC_FEE']);
  if (PHASE1_FEE_STATES.has(workflowState) || PHASE1_FEE_STATES.has(status)) {
    return 'PENDING_FEE_PHASE1';
  }

  // ── Draft ──
  if (status === 'DRAFT' || !status) {
    return 'DRAFT';
  }

  // Fallback for unknown states - show as under review
  return 'UNDER_DOCUMENT_REVIEW';
}

// NOTE: Legacy exports (HEALTH_STAGE_LABEL_TH, HEALTH_STAGE_BADGE_COLOR) removed.
// All consumers should import STAGE_LABEL_TH and STAGE_BADGE_STYLE directly.
