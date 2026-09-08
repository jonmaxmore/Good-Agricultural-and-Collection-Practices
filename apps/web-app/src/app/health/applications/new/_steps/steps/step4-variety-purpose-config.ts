/**
 * กทล.1 ข้อ ๓ — what is grown, and what it is for.
 *
 * TWO lawful objectives, and no default.
 *
 * The v1 wizard offered RESEARCH / COMMERCIAL / EXPORT and, when the applicant ticked
 * none, the review step posted `['COMMERCIAL']` on their behalf. That is the same
 * defect B1 spent a commit closing on the other side of the wire: a default is not a
 * tick. A purpose is a legal declaration about what the produce is for — it decides
 * whether an export licence is demanded — and the platform may not make it for someone.
 *
 * The vocabulary is also narrower than v1's because only two of those words are things
 * กทล.1 actually certifies. RESEARCH and COMMERCIAL were never lawful objectives on this
 * form; they were wizard inventions, and a filing that carried them named a purpose no
 * officer could act on.
 */

export type CertificationObjective = 'MEDICAL' | 'EXPORT';

export interface ObjectiveOption {
    value: CertificationObjective;
    labelTH: string;
    helpTH: string;
}

export const OBJECTIVE_OPTIONS: ReadonlyArray<ObjectiveOption> = Object.freeze([
    {
        value: 'MEDICAL',
        labelTH: 'ใช้ทางการแพทย์',
        helpTH: 'ผลผลิตนำไปใช้ในทางการแพทย์หรือการผลิตยาภายในประเทศ',
    },
    {
        value: 'EXPORT',
        labelTH: 'ส่งออก',
        helpTH: 'ผลผลิตมีปลายทางเป็นการส่งออกไปต่างประเทศ',
    },
]);

/** Words v1 offered that this form never certified. Kept named so a test can pin them out. */
export const RETIRED_OBJECTIVES: readonly string[] = Object.freeze(['RESEARCH', 'COMMERCIAL']);

export type VarietyKind = 'SEED' | 'OTHER_PART';
export type VarietyOrigin = 'DOMESTIC' | 'IMPORTED';

export const VARIETY_KIND_OPTIONS: ReadonlyArray<{ value: VarietyKind; labelTH: string }> = Object.freeze([
    { value: 'SEED', labelTH: 'เมล็ดพันธุ์' },
    { value: 'OTHER_PART', labelTH: 'ส่วนขยายพันธุ์อื่น เช่น กิ่งพันธุ์ ต้นกล้า' },
]);

export const VARIETY_ORIGIN_OPTIONS: ReadonlyArray<{ value: VarietyOrigin; labelTH: string }> = Object.freeze([
    { value: 'DOMESTIC', labelTH: 'ในประเทศ' },
    { value: 'IMPORTED', labelTH: 'นำเข้า' },
]);

export interface VarietyRow {
    kind: VarietyKind | null;
    name: string;
    origin: VarietyOrigin | null;
    originCountry?: string;
    source: string;
    quantity: string;
    unit: string;
}

export function emptyVarietyRow(): VarietyRow {
    // Every field blank and both choices null. The form asks; it does not assume.
    return { kind: null, name: '', origin: null, source: '', quantity: '', unit: '' };
}

/**
 * The paper prints two rows. A filing with more is not wrong — it is a farm growing
 * more than two varieties — so the extra ones go into a free-text note that the
 * generated กทล.1 prints beneath the table, rather than being silently dropped.
 */
export const VARIETY_ROWS_ON_THE_FORM = 2;

export function needsVarietiesNote(rows: readonly unknown[]): boolean {
    return rows.length > VARIETY_ROWS_ON_THE_FORM;
}

/** An imported variety has to say where from; a domestic one has no country to give. */
export function needsOriginCountry(origin: VarietyOrigin | null): boolean {
    return origin === 'IMPORTED';
}

export const STEP4_COPY_TH = Object.freeze({
    objectiveHeading: 'วัตถุประสงค์การขอรับรอง เลือกได้มากกว่าหนึ่งข้อ',
    varietiesHeading: 'สายพันธุ์และแหล่งที่มา',
    processingHeading: 'ข้อมูลการแปรรูป',
    addVariety: 'เพิ่มสายพันธุ์',
    removeVariety: 'ลบแถวนี้',
    varietiesNote: 'สายพันธุ์เพิ่มเติม',
    varietiesNoteHelp: 'แบบฟอร์ม กทล.1 มีช่องสำหรับสองสายพันธุ์ ระบบจะพิมพ์รายการที่เกินไว้ใต้ตาราง',
    originCountry: 'ประเทศต้นทาง',
    /** Shown the moment ส่งออก is ticked, so the extra paper is not a surprise at step 5. */
    exportNotice: 'กรณีส่งออก ระบบจะขอใบอนุญาตส่งออกสมุนไพรควบคุมในขั้นที่ 5',
    /** The refusal when the applicant tries to leave without an objective. */
    objectiveRequired: 'กรุณาเลือกวัตถุประสงค์การขอรับรองอย่างน้อยหนึ่งข้อ ระบบใช้ข้อมูลนี้ตัดสินว่าต้องขอเอกสารใดเพิ่ม',
});

/** ส่งออก brings a controlled-herb export licence at step 5. Say so here, not there. */
export function showsExportNotice(objectives: readonly string[]): boolean {
    return objectives.includes('EXPORT');
}

/**
 * What step 4 must have before the applicant may leave it.
 *
 * The plant is the load-bearing one. กทล.1 law is filed PER PLANT, so a filing that
 * names none is refused outright by the submit gate (APPLICATION_NOT_JUDGEABLE) rather
 * than judged leniently — asking here is what stops an applicant reaching the review
 * page only to be turned away.
 */
export function step4CanProceed(input: {
    plantId?: string | null;
    objectives?: readonly string[] | null;
}): boolean {
    // The plant is answered at STEP 1 since 2026-09-06 (F-QA-04) and gated there, so demanding
    // it again here would block a filing on a field this screen no longer shows — the v1
    // hard-lock class. `plantId` stays in the input type because callers still pass it.
    return (input.objectives?.length ?? 0) > 0;
}
