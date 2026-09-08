/**
 * What one required-document card says, and what pressing it does.
 *
 * The card is the wizard's ONLY upload surface, and every fact it shows comes from
 * the server's answer (`GET /applications/:id/requirements`) — never from a list the
 * browser keeps. The browser holding its own copy of the required set is exactly how
 * a farmer was told ครบ on one screen and ไม่ครบ on the next.
 *
 * The decisions live here rather than in the component so they can be tested for what
 * they are: `openSlotDocument` in particular exists so the PDPA posture is provable.
 */

import { openDocumentPreview } from '@/lib/services/preview-document';
import type { RequirementSlot } from '@/lib/services/application-requirements';

export type SlotCardState = 'missing' | 'attached' | 'optional-missing';

/**
 * Three states, and the difference between the last two is the whole point of the
 * OPTIONAL rule: an optional slot with nothing behind it must never read as a problem,
 * because it does not count toward completeness (review-completeness.ts). Painting it
 * amber next to a genuinely missing paper is how an applicant is sent hunting for a
 * document nobody asked them for.
 */
export function slotCardState(slot: Pick<RequirementSlot, 'required' | 'satisfied'>): SlotCardState {
    if (slot.satisfied) { return 'attached'; }
    return slot.required ? 'missing' : 'optional-missing';
}

/**
 * WHY this paper is being asked for, in the applicant's words.
 *
 * `requiredReason` is the register's own word for the rule that pulled the slot in, and
 * showing it raw would put INDOOR on a farmer's screen. Saying the cause out loud
 * matters more here than in most places: the required set CHANGES as the filing changes
 * (tick โรงเรือนระบบปิด and a building plan appears), and a document that turns up with
 * no explanation reads as the system malfunctioning rather than as the law applying.
 *
 * ALWAYS carries no badge: "you must attach this because you must" says nothing.
 */
export const REQUIRED_REASON_TH: Readonly<Record<string, string>> = Object.freeze({
    RENTED: 'เพราะที่ดินเป็นการเช่า',
    INDOOR: 'เพราะโรงเรือนระบบปิด',
    GREENHOUSE: 'เพราะเป็นโรงเรือน',
    OUTDOOR: 'เพราะปลูกกลางแจ้ง',
    PROCESSING: 'เพราะขอรับรองขั้นแปรรูป',
    EXPORT: 'เพราะมีวัตถุประสงค์เพื่อส่งออก',
    HOLDER_TYPE: 'เพราะประเภทผู้ยื่นคำขอ',
    RENEWAL: 'เพราะเป็นคำขอต่ออายุ',
    REPLACEMENT: 'เพราะเป็นคำขอใบแทน',
});

/** The badge text for a slot, or null when the reason explains nothing worth saying. */
export function requiredReasonBadge(slot: Pick<RequirementSlot, 'requiredReason'>): string | null {
    const reason = slot.requiredReason;
    if (!reason || reason === 'ALWAYS') { return null; }
    return REQUIRED_REASON_TH[reason] ?? null;
}

export const SLOT_CARD_COPY_TH = Object.freeze({
    missing: 'ยังไม่ได้แนบ',
    attached: 'อัปโหลดแล้ว',
    optionalBadge: 'ไม่บังคับ ช่วยให้วันตรวจเร็วขึ้น',
    view: 'เปิดดูในหน้า',
    replace: 'แทนที่ไฟล์',
    upload: 'อัปโหลดไฟล์',
    /** Where the applicant actually obtains the paper, when the catalog knows. */
    sourceLabel: 'หาได้ที่',
});

/**
 * Open an attached document for reading.
 *
 * `window.open(fileUrl)` is FORBIDDEN in this app and this function is why it stays
 * that way. `/uploads` is served with `Content-Disposition: attachment`
 * (middleware/uploads-security-headers.js) so a plain link downloads a copy of a
 * national-ID scan onto the reader's disk, outside the platform's control — a PDPA
 * problem, not a UX one. `openDocumentPreview` fetches the bytes and shows them in
 * the page instead.
 *
 * Returns false when there is nothing to open, so a caller cannot mistake "no file"
 * for "opened".
 */
export async function openSlotDocument(
    slot: Pick<RequirementSlot, 'fileUrl'>,
    open: (url: string) => Promise<void> = openDocumentPreview,
): Promise<boolean> {
    const url = slot.fileUrl;
    if (!url) { return false; }
    await open(url);
    return true;
}

/**
 * The qualification papers step 2 is responsible for, in the order กทล.1 lists them.
 *
 * Intersected with the server's payload rather than rendered blind: the engine already
 * scopes by holderType, so an INDIVIDUAL filing simply does not get the juristic ids
 * back. Rendering this list directly would show a sole trader the company-registration
 * card and ask them for a paper the law never demanded of them.
 */
export const STEP2_QUALIFICATION_SLOT_IDS: readonly string[] = Object.freeze([
    'id_house_reg',
    'community_reg_members',
    'community_assignment',
    'producer_supervision_letter',
    'juristic_reg_6m',
    'juristic_authority',
]);

/** The step-2 cards, in the catalog's order, for whatever the server actually returned. */
export function step2QualificationSlots(slots: readonly RequirementSlot[]): RequirementSlot[] {
    const bySlotId = new Map(slots.map((s) => [s.slotId, s]));
    return STEP2_QUALIFICATION_SLOT_IDS
        .map((id) => bySlotId.get(id))
        .filter((s): s is RequirementSlot => Boolean(s));
}
