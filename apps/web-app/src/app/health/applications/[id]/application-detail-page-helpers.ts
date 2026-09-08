import {
  type ActionMeta,
  type ApplicationHistoryPayload,
  type WorkflowHistoryEntry,
  toThaiDateTime,
} from './application-detail-page-config';

export type TimelineItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  isCurrent?: boolean;
};

export type OfficerComment = {
  id: string;
  author: string;
  message: string;
  timestamp: string;
};

export function upper(value?: string | null): string {
  return String(value || '').trim().toUpperCase();
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

export function formatActor(actorRole?: string | null, actorId?: string | null): string {
  const role = upper(actorRole);
  if (role.includes('HEALTH') || role === 'HEALTH') {
    return 'เกษตรกร';
  }
  if (role.includes('AUDITOR') || role.includes('REVIEW')) {
    return 'ผู้ตรวจ';
  }
  if (role.includes('COORDINATOR') || role.includes('SCHEDULER')) {
    return 'ผู้ประสานงาน';
  }
  if (role.includes('HEAD')) {
    return 'หัวหน้าผู้ตรวจ';
  }
  if (role.includes('WEBHOOK') || role.includes('SYSTEM')) {
    return 'ระบบ';
  }
  if (role) {
    return role.toLowerCase();
  }
  return actorId ? `รหัส ${actorId.slice(0, 8)}` : 'ระบบ';
}

export function mapTimelineTitle(entry: WorkflowHistoryEntry): string {
  const action = upper(entry.action);
  const toStatus = upper(entry.toStatus);

  if (action === 'APPLICATION_PREPARED') return 'ร่าง';
  if (action === 'PHASE_1_PAYMENT_CREATED') return 'รอชำระค่าตรวจเอกสาร';
  if (action === 'APPLICATION_FINALIZED_AFTER_PHASE1_PAYMENT') return 'ยื่นแล้ว';
  if (action === 'WORKFLOW_AUTO_FINAL_APPROVED') return 'ผ่านการประเมิน';
  if (action === 'AUDIT_DECISION_RECORDED') return 'บันทึกผลการประเมิน';
  if (action === 'AUDIT_RESCHEDULED') return 'เลื่อนนัดหมายลงพื้นที่';

  if (toStatus === 'SUBMITTED') return 'ยื่นแล้ว';
  if (toStatus === 'IN_REVIEW' || toStatus === 'ASSIGNED_FOR_REVIEW') return 'กำลังตรวจเอกสาร';
  if (toStatus === 'DOCUMENT_APPROVED' || toStatus === 'DOC_APPROVED') return 'เอกสารผ่าน';
  if (toStatus === 'PAYMENT_2_PENDING' || toStatus === 'PENDING_AUDIT_FEE') return 'รอชำระค่าประเมินหน้างาน';
  if (toStatus === 'AWAITING_SCHEDULE' || toStatus === 'AUDIT_CONFIRMED' || toStatus === 'AUDIT_SCHEDULED') return 'นัดหมายลงพื้นที่';
  if (toStatus === 'AUDIT_IN_PROGRESS') return 'ประเมินหน้างาน';
  if (toStatus === 'CAR_PENDING') return 'ต้องแก้ไข CAR';
  if (toStatus === 'CAR_REVIEWING') return 'กำลังตรวจ CAR';
  if (toStatus === 'AUDITED' || toStatus === 'AUDIT_PASSED' || toStatus === 'APPROVED') return 'รอพิจารณาอนุมัติ';
  if (toStatus === 'CERTIFIED') return 'ได้รับใบรับรอง';

  if (action.startsWith('WORKFLOW_') && toStatus) {
    return toStatus.replace(/_/g, ' ').toLowerCase();
  }
  return action ? action.replace(/_/g, ' ').toLowerCase() : 'อัปเดตสถานะ';
}

export function buildTimeline(history?: ApplicationHistoryPayload | null): TimelineItem[] {
  const events = Array.isArray(history?.workflowHistory) ? history!.workflowHistory : [];
  if (events.length === 0) {
    return [];
  }

  return events
    .map((entry, index) => ({
      id: `${entry.index || index}-${entry.timestamp || index}`,
      title: mapTimelineTitle(entry),
      description: String(entry.comment || entry.reason || '').trim() || 'ไม่มีหมายเหตุเพิ่มเติม',
      timestamp: toThaiDateTime(entry.timestamp),
      actor: formatActor(entry.actorRole, entry.actorId),
      isCurrent: index === events.length - 1,
    }));
}

export function buildOfficerComments(history?: ApplicationHistoryPayload | null): OfficerComment[] {
  const workflowComments = (history?.workflowHistory || [])
    .filter((entry) => String(entry.comment || '').trim().length > 0)
    .map((entry, index) => ({
      id: `wf-${index}-${entry.timestamp || ''}`,
      author: formatActor(entry.actorRole, entry.actorId),
      message: String(entry.comment || '').trim(),
      timestamp: toThaiDateTime(entry.timestamp),
    }));

  const directComments = (history?.comments || [])
    .filter((entry) => String(entry.commentText || '').trim().length > 0)
    .map((entry) => ({
      id: `cm-${entry.id}`,
      author: formatActor(entry.type, entry.auditorId),
      message: String(entry.commentText || '').trim(),
      timestamp: toThaiDateTime(entry.createdAt),
    }));

  return [...directComments, ...workflowComments]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 8);
}

export function resolveActionTarget(actionKey: string, applicationId: string, actionMeta: ActionMeta): { href: string; label: string } | null {
  const key = upper(actionKey);
  if (key === 'PAY_DOC_FEE') {
    return { href: `/health/payments?app=${applicationId}&phase=PHASE_1`, label: actionMeta.buttonLabel || 'ชำระค่าตรวจเอกสาร' };
  }
  if (key === 'PAY_AUDIT_FEE') {
    return { href: `/health/payments?app=${applicationId}&phase=PHASE_2`, label: actionMeta.buttonLabel || 'ชำระค่าประเมินหน้างาน' };
  }
  if (key === 'SUBMIT_REVISION') {
    return { href: `/health/applications/${applicationId}/edit`, label: actionMeta.buttonLabel || 'แก้ไขและส่งข้อมูลใหม่' };
  }
  if (key === 'SUBMIT_CAR_EVIDENCE') {
    return { href: `/health/applications/${applicationId}/car`, label: actionMeta.buttonLabel || 'ส่งหลักฐาน CAR' };
  }
  if (key === 'DOWNLOAD_CERTIFICATE') {
    return { href: '/health/certificates', label: actionMeta.buttonLabel || 'ไปที่ใบรับรอง' };
  }
  // CONTINUE_DRAFT means: this user has an in-progress draft, send them
  // back to THIS specific draft via the edit page. Routing to /new (a
  // blank form) is the bug reported on 2026-05-02 — the user pressed
  // "ดำเนินการต่อ" expecting to resume APP-2569-MOOJ3HDI-CFF529 and
  // instead got an empty wizard.
  //
  // The edit page (apps/web-app/src/app/health/applications/[id]/edit/
  // client-view.tsx) handles DRAFT status (line 102 editableStatuses
  // already includes 'DRAFT') and hydrates the wizard store from
  // application data via handleStartEdit() before navigating to the
  // wizard. That's the path the user expects.
  if (key === 'CONTINUE_DRAFT') {
    return {
      href: `/health/applications/${applicationId}/edit`,
      label: actionMeta.buttonLabel || 'ดำเนินการต่อ',
    };
  }

  // REAPPLY is different — previous app is REJECTED / EXPIRED / CANCELLED,
  // so a new application makes sense (no draft to resume).
  if (key === 'REAPPLY') {
    return {
      href: '/health/applications/new',
      label: actionMeta.buttonLabel || 'ยื่นคำขอใหม่',
    };
  }
  return null;
}

/**
 * Optional canonical phase status that the backend now returns alongside
 * application detail. When present, these are the SOURCE OF TRUTH for
 * "did the applicant already pay phase 1 / phase 2?". Falls back to
 * workflow-history inference for older payloads that don't carry these.
 */
export interface PaymentFactsCanonical {
  phase1Status?: string | null;
  phase1PaidAt?: string | null;
  phase2Status?: string | null;
  phase2PaidAt?: string | null;
}

export function resolvePaymentFacts(
  status: string,
  history?: ApplicationHistoryPayload | null,
  canonical?: PaymentFactsCanonical | null,
) {
  // Prefer canonical phase columns from the DB when the backend included them.
  // Fixes the case (real prod 2026-04-28) where status=REGISTERED but
  // phase1Status=PAID — workflow-history inference alone said docPaid=false
  // and the application detail page rendered the wrong action card.
  if (canonical?.phase1Status || canonical?.phase2Status) {
    const docPaidByColumn = upper(canonical.phase1Status || '') === 'PAID';
    const auditPaidByColumn = upper(canonical.phase2Status || '') === 'PAID';
    return {
      docPaid: docPaidByColumn,
      auditPaid: auditPaidByColumn,
      docPaidAt: canonical.phase1PaidAt || null,
      auditPaidAt: canonical.phase2PaidAt || null,
    };
  }

  // Fallback: infer from workflow text. Older API responses without the
  // canonical columns still need to render correctly.
  const allStatuses = new Set<string>([upper(status)]);
  for (const row of history?.workflowHistory || []) {
    if (row.fromStatus) allStatuses.add(upper(row.fromStatus));
    if (row.toStatus) allStatuses.add(upper(row.toStatus));
  }

  const docPaidMarkers = new Set([
    'DOC_FEE_PAID',
    'SUBMITTED',
    'ASSIGNED_FOR_REVIEW',
    'REVISION_REQUESTED',
    'DOC_APPROVED',
    'PENDING_AUDIT_FEE',
    'PAYMENT_2_PENDING',
    'AUDIT_FEE_PAID',
    'AWAITING_SCHEDULE',
    'AUDIT_CONFIRMED',
    'AUDIT_IN_PROGRESS',
    'AUDIT_PASSED',
    'AUDITED',
    'APPROVED',
    'CERTIFIED',
    'DOCUMENT_APPROVED',
    'IN_REVIEW',
  ]);

  const auditPaidMarkers = new Set([
    'AUDIT_FEE_PAID',
    'AWAITING_SCHEDULE',
    'AUDIT_CONFIRMED',
    'AUDIT_SCHEDULED',
    'AUDIT_IN_PROGRESS',
    'CAR_PENDING',
    'CAR_REVIEWING',
    'AUDIT_PASSED',
    'AUDITED',
    'APPROVED',
    'CERTIFIED',
  ]);

  const docPaid = [...allStatuses].some((item) => docPaidMarkers.has(item));
  const auditPaid = [...allStatuses].some((item) => auditPaidMarkers.has(item));

  const docPaidEvent = (history?.workflowHistory || []).find((entry) => {
    const action = upper(entry.action);
    const toStatus = upper(entry.toStatus);
    return action === 'APPLICATION_FINALIZED_AFTER_PHASE1_PAYMENT' || toStatus === 'DOC_FEE_PAID' || toStatus === 'SUBMITTED';
  });

  const auditPaidEvent = (history?.workflowHistory || []).find((entry) => {
    const action = upper(entry.action);
    const toStatus = upper(entry.toStatus);
    return action === 'PHASE_2_PAYMENT_CREATED' || toStatus === 'AUDIT_FEE_PAID' || toStatus === 'AWAITING_SCHEDULE';
  });

  return {
    docPaid,
    auditPaid,
    docPaidAt: docPaidEvent?.timestamp || null,
    auditPaidAt: auditPaidEvent?.timestamp || null,
  };
}
