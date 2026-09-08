/**
 * The officer document-check screen, as decisions rather than markup.
 *
 * ── WHY A SEPARATE MODULE ─────────────────────────────────────────────────────
 * Which button is enabled, what a row looks like, and whether a form may be
 * submitted are RULES, and they mirror refusals the backend already enforces
 * (application-document-review-service.js). Keeping them here means they can be
 * tested exhaustively without rendering, and — more importantly — that the two
 * sides can be compared by reading two files rather than by clicking.
 *
 * The screen must never be MORE permissive than the server. It may be less: a
 * disabled button is a better explanation than a 409.
 */

export type Verdict = 'ACCEPTED' | 'MORE_REQUESTED' | null;

export interface SlotRow {
    slotId: string;
    labelTH: string;
    required: boolean;
    satisfied: boolean;
    fileUrl: string | null;
    fileName: string | null;
    verdict: Verdict;
    reviewReason: string | null;
    reviewDueDate: string | null;
}

/** Mirrors services/application-document-review-service.js MIN_REASON_LENGTH. */
export const MIN_REASON_LENGTH = 10;

export const DOCUMENT_CHECK_COPY_TH = Object.freeze({
    title: 'ตรวจเอกสารตาม กทล.1',
    sectionSlots: 'ข้อ 1.1 เอกสารประกอบคำขอ',
    accept: 'รับเอกสารนี้',
    requestMore: 'ขอเอกสารเพิ่ม',
    view: 'ดู',
    notAttached: 'ยังไม่ได้แนบ',
    optional: 'ไม่บังคับ',
    reasonLabel: 'เหตุผลที่ขอเพิ่ม',
    reasonHint: 'อธิบายให้ผู้ยื่นทราบว่าต้องแก้ไขอะไร อย่างน้อย 10 ตัวอักษร',
    dueLabel: 'วันครบกำหนดส่ง',
    dueHint: 'ต้องเป็นวันทำการ',
    decisionAccept: 'รับคำขอ',
    decisionRequest: 'ส่งคำขอเอกสารเพิ่ม',
    blockedByRequired: 'ยังมีเอกสารที่จำเป็นซึ่งยังไม่ได้รับ',
    nothingRequested: 'ยังไม่ได้เลือกเอกสารที่ต้องการเพิ่ม',
});

/** The visual state of one row. Amber is "we asked for something". */
export function rowState(slot: SlotRow): 'ACCEPTED' | 'REQUESTED' | 'PENDING' {
    if (slot.verdict === 'ACCEPTED') { return 'ACCEPTED'; }
    if (slot.verdict === 'MORE_REQUESTED') { return 'REQUESTED'; }
    return 'PENDING';
}

/**
 * Is the per-slot "ขอเอกสารเพิ่ม" form complete?
 *
 * Same two rules the server applies, so the officer is told before the round
 * trip rather than after it. A weekend check needs the holiday calendar and
 * therefore stays server-side; this catches only what a browser can know.
 */
export function canSubmitRequest(reason: string, dueDate: string): boolean {
    return reason.trim().length >= MIN_REASON_LENGTH && Boolean(dueDate);
}

export interface DecisionState {
    canAccept: boolean;
    canRequestMore: boolean;
    /** Why ACCEPT is unavailable, in the officer's language. */
    acceptBlockedReason: string | null;
    /** The required slots still standing in the way — the rows to point at. */
    blockingSlotIds: string[];
}

/**
 * Which decision the officer may take.
 *
 * Mirrors decideDocumentOutcome: every REQUIRED slot accepted → รับคำขอ; at
 * least one MORE_REQUESTED → ส่งคำขอเอกสารเพิ่ม. OPTIONAL slots never block
 * acceptance, and an optional slot CAN be the thing requested.
 */
export function decisionState(slots: SlotRow[]): DecisionState {
    const rows = Array.isArray(slots) ? slots : [];
    const blockingSlotIds = rows
        .filter((s) => s.required && s.verdict !== 'ACCEPTED')
        .map((s) => s.slotId);
    const requested = rows.filter((s) => s.verdict === 'MORE_REQUESTED');

    return {
        canAccept: rows.length > 0 && blockingSlotIds.length === 0,
        canRequestMore: requested.length > 0,
        acceptBlockedReason: blockingSlotIds.length > 0
            ? DOCUMENT_CHECK_COPY_TH.blockedByRequired
            : null,
        blockingSlotIds,
    };
}

/**
 * รับได้ไหม — ปุ่มต้อง "เข้มกว่าหรือเท่ากับ" ประตูเสมอ ไม่มีทางหลวมกว่า
 *
 * ประตูปฏิเสธ REVIEW_SLOT_NOT_ATTACHED เมื่อสั่งรับช่องที่ยังไม่มีเอกสาร (เพิ่ม 2026-09-06
 * หลังเดินจริงแล้วพบว่ารับช่องว่างได้ และฐานข้อมูลบันทึก ACCEPTED ให้ water_test/soil_test
 * ที่ไม่เคยมีไฟล์) · ปุ่มที่กดได้แล้วถูกปฏิเสธเสมอ คือปุ่มที่โกหกเจ้าหน้าที่
 */
export function canAcceptSlot(slot: { satisfied?: boolean } | null | undefined): boolean {
    return slot?.satisfied === true;
}

/** เหตุผลที่ปุ่มรับกดไม่ได้ — บอกทางออกด้วย ไม่ใช่แค่บอกว่าไม่ได้ */
export const ACCEPT_BLOCKED_TH = 'ยังไม่มีเอกสารในรายการนี้ให้ตรวจ หากต้องการให้ผู้ยื่นส่ง ให้เลือก "ขอเอกสารเพิ่ม"';
