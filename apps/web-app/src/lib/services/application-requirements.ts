/**
 * The one lens, in the browser.
 *
 * `GET /api/applications/:id/requirements` is the server's answer to "which papers does
 * this filing still need, and why" — the same answer the submit gate enforces. Every v2
 * surface reads it and none of them recomputes it: the wizard's per-step cards (T6-T9),
 * the server-truth review page (T11) and the officer's checklist (T13). The browser used
 * to keep its own copy of the required set, which is how a farmer could be told ครบ on
 * one screen and ไม่ครบ on the next.
 */

import { apiClient } from '@/lib/api/api-client';

/** Why a slot is being asked for. The surfaces render this, so it is never a raw enum. */
export type RequirementReason =
    | 'ALWAYS'
    | 'RENTED'
    | 'INDOOR'
    | 'GREENHOUSE'
    | 'OUTDOOR'
    | 'PROCESSING'
    | 'EXPORT'
    | 'HOLDER_TYPE'
    | 'RENEWAL'
    | 'REPLACEMENT';

/** The case this filing is judged by. Any dimension may be null — null means "every value". */
export interface RequirementDimensions {
    holderType: 'INDIVIDUAL' | 'JURISTIC' | 'COMMUNITY_ENTERPRISE' | null;
    requestType: 'NEW' | 'RENEWAL' | 'REPLACEMENT';
    /**
     * null when the filing names no plant this platform recognises — `asPlantSlug`
     * returns null and the server sends it through as null. Declaring it `string` made
     * every surface believe a plant is always there; the PLANT_NOT_DECLARED refusal
     * exists precisely because it is not.
     */
    plantCode: string | null;
    landTenure: 'OWNED' | 'STATE_PERMITTED' | 'RENTED' | null;
    /**
     * EVERY ลักษณะพื้นที่ the filing ticks. กทล.1 ส่วนที่ ๒ prints them as checkboxes and
     * the attachments hang off the ticks, so this is a set and never one collapsed word:
     * a farm ticking กลางแจ้ง and โรงเรือน owes A4 and A4′ together. Empty means the
     * filing has not said yet.
     */
    areaTypes: Array<'OUTDOOR' | 'INDOOR' | 'GREENHOUSE' | 'OTHER'>;
    /** The words written in the form's ☐ อื่น ๆ ระบุ box, for the surfaces that print it. */
    areaTypeOther: string | null;
    certScope: 'PLANTING' | 'PROCESSING';
    purposes: string[];
}

export interface RequirementSlot {
    slotId: string;
    /** The ministry's own words for this paper. */
    labelTH: string;
    description: string | null;
    /** "หาได้ที่ไหน" — where a farmer actually obtains this paper. */
    sourceHint: string | null;
    required: boolean;
    /**
     * Set when this paper answers a demand JOINTLY with its alternatives — a replacement
     * needs the police report OR the damaged certificate, never both. `required` is false
     * on every member because none is demanded alone; the GROUP is, and the server reports
     * it as one entry in missingRequired ("police_report|damaged_cert"). A surface that
     * reads `required` alone will call a blocking paper optional.
     */
    alternativeGroup?: string | null;
    requiredReason: RequirementReason | null;
    satisfied: boolean;
    fileUrl: string | null;
    fileName: string | null;
    uploadedAt: string | null;
}

/**
 * Why this filing cannot be judged at all — a different thing from a missing paper.
 *
 * The register holds กทล.1 law per plant, and the attachments hang off the ลักษณะพื้นที่
 * ticks. A filing that names no plant, names one no rules have been filed for, or states
 * an area in words the platform cannot read, is not a filing with no requirements: it is a
 * question the law cannot answer. Rendering "ครบแล้ว" for it would be the worst possible
 * lie, so the server says so here and the submit gate refuses with the same words.
 */
export type RequirementBlockingCode =
    | 'PLANT_NOT_DECLARED'
    | 'PLANT_LAW_NOT_FILED'
    | 'AREA_TYPE_UNREADABLE';

/**
 * `detail` is a DISCRIMINATED union, because the three refusals do not carry the same
 * facts. It was declared as the plant pair alone while the server had already begun
 * sending `{ areaTypes, accepted }` for the area refusal, so a surface reading
 * `issue.detail.openPlantCodes` compiled clean and found `undefined` at runtime — on the
 * one refusal a farmer is most likely to hit, since the area answer is the one they can
 * leave unreadable. Narrow on `code` and the compiler will not let that happen again.
 */
export type RequirementBlockingIssue =
    | {
        code: 'PLANT_NOT_DECLARED' | 'PLANT_LAW_NOT_FILED';
        messageTH: string;
        /** Which plants the register actually holds law for, so the surface can offer them. */
        detail: { plantCode: string | null; openPlantCodes: string[] };
    }
    | {
        code: 'AREA_TYPE_UNREADABLE';
        messageTH: string;
        /** The words the platform can read, so the surface can name the lawful ticks. */
        detail: { areaTypes: string[]; accepted: string[] };
    };

export interface RequirementsPayload {
    dims: RequirementDimensions;
    slots: RequirementSlot[];
    /**
     * Canonical ids of the required slots with nothing behind them. A REPLACEMENT filing
     * reports its either-of pair as the single entry `police_report|damaged_cert`.
     */
    missingRequired: string[];
    /** Empty when the filing can be judged. Non-empty means `complete` is false whatever is attached. */
    blockingIssues: RequirementBlockingIssue[];
    complete: boolean;
}

/**
 * Ask the server what this filing still needs.
 *
 * Throws on refusal rather than returning an empty payload: a surface that renders "ไม่ต้อง
 * แนบอะไรแล้ว" because a request failed would be telling the applicant something false. The
 * caller shows the error; it must not invent a completeness it did not receive.
 */
export async function fetchApplicationRequirements(
    applicationId: string,
): Promise<RequirementsPayload> {
    const response = await apiClient.get<RequirementsPayload>(
        `/applications/${encodeURIComponent(applicationId)}/requirements`,
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'ระบบอ่านรายการเอกสารของคำขอนี้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
    return response.data;
}

/** The required slots the server cannot yet see — what a red "ยังขาด" card lists. */
export function missingRequiredSlots(payload: RequirementsPayload): RequirementSlot[] {
    return payload.slots.filter((slot) => slot.required && !slot.satisfied);
}

/**
 * The Thai a submit-gate refusal wants shown — never the machine code.
 *
 * Both refusals are authored in Thai by the backend gate
 * (apps/backend/services/application-document-requirements.js), and both used to die one
 * hop short of the screen: `message` is a RESERVED envelope key
 * (lib/api/api-client.ts:75) and is stripped from every non-2xx body, so a door that fell
 * back to `response.error` printed the bare enum — a farmer refused for picking a plant
 * with no filed law read the words "APPLICATION_NOT_JUDGEABLE".
 *
 * Preference order, most specific first:
 *   1. the refusal's own blocking issue — it names WHICH thing cannot be judged
 *   2. `meta.messageTh` — the gate's sentence, in the field the envelope preserves
 *   3. a Thai fallback per code, so an older backend still says something readable
 *
 * Returns null when `code` is not a submit-gate refusal, so a caller keeps its own
 * handling for everything else instead of mislabelling it.
 *
 * Mirrors `quotationGateRefusalTh` (services/payment-service.ts) — same shape, same reason.
 */
export function submitGateRefusalTh(
    code: string | null | undefined,
    meta?: Record<string, unknown> | null,
): string | null {
    const fallback: Record<string, string | undefined> = {
        APPLICATION_INCOMPLETE: 'กรุณากรอกข้อมูลให้ครบถ้วนก่อนส่งคำขอ',
        APPLICATION_NOT_JUDGEABLE:
            'ยังไม่สามารถตรวจสอบเอกสารของคำขอนี้ได้ กรุณาตรวจสอบข้อมูลคำขอแล้วลองใหม่อีกครั้ง',
    };
    // The last line is also the membership test: a code with no Thai of its own is not a
    // submit-gate refusal, and answering for it would mislabel somebody else's error.
    const lastResort = code ? fallback[code] : undefined;
    if (!lastResort) {
        return null;
    }

    const issues = meta?.blockingIssues;
    if (Array.isArray(issues)) {
        const spoken = issues.find(
            (issue): issue is RequirementBlockingIssue =>
                Boolean(issue)
                && typeof (issue as RequirementBlockingIssue).messageTH === 'string'
                && (issue as RequirementBlockingIssue).messageTH.trim() !== '',
        );
        if (spoken) {
            return spoken.messageTH;
        }
    }

    const messageTh = meta?.messageTh;
    if (typeof messageTh === 'string' && messageTh.trim() !== '') {
        return messageTh;
    }

    // APPLICATION_INCOMPLETE arrives with the field list — errorsByStep, per-field Thai
    // messages written in the form's own labels — and it survives the envelope into
    // `.meta` because it is not a reserved key. "กรุณากรอกข้อมูลให้ครบถ้วน" alone is a
    // sentence with nowhere to go: Deep QA walked a filing whose review banner said ครบ,
    // pressed ยื่นคำขอ, and got exactly that — a contradiction with no named field.
    // Name the first few; a longer tail is summarised as a count rather than truncated
    // silently.
    const fieldMessages = collectStepFieldMessages(meta?.errorsByStep);
    if (fieldMessages.length > 0) {
        const shown = fieldMessages.slice(0, 4);
        const rest = fieldMessages.length - shown.length;
        return `${lastResort}: ${shown.join(' · ')}${rest > 0 ? ` และอีก ${rest} รายการ` : ''}`;
    }

    return lastResort;
}

/** The Thai per-field messages inside a 422's errorsByStep, in step order. */
function collectStepFieldMessages(errorsByStep: unknown): string[] {
    if (!errorsByStep || typeof errorsByStep !== 'object') { return []; }
    const out: string[] = [];
    for (const issues of Object.values(errorsByStep as Record<string, unknown>)) {
        if (!Array.isArray(issues)) { continue; }
        for (const issue of issues) {
            const message = (issue as { message?: unknown })?.message;
            if (typeof message === 'string' && message.trim() !== '') { out.push(message.trim()); }
        }
    }
    return out;
}
