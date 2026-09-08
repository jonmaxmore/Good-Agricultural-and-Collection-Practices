'use strict';

/**
 * PDPA ม.30 — the farmer's right to read what an auditor wrote about them.
 *
 * §5.2 of the T&T scope ruling (2026-09-05) settled the question with the operator's own
 * words, *"อ้างอิงตามกฎหมาย PDPA ได้เลย"*: ม.30 วรรคหนึ่ง gives a data subject the right to
 * access and obtain a copy of their personal data, and an auditor's checklist verdict and
 * free-text `notes` about a farm are that farmer's personal data.
 *
 * Until this file existed the right was decided and unusable — the only door reading
 * `farmAuditChecklistItem` was routes/api/audit/onsite.js behind requireRole(AUDIT_STAFF),
 * so a farmer could not reach one row about their own farm.
 *
 * TWO HALVES, and the second is why a plain read door would have been the wrong fix.
 * ม.30 วรรคสอง lets the controller refuse where the law or a court order requires it, or
 * where disclosure would affect ANOTHER person's rights and freedoms — an auditor's note
 * can name a neighbour, an employee, or a complainant. That is a judgement about one ROW,
 * so the switch lives on the row, and setting it requires a recorded reason: a refusal
 * nobody has to justify is not a lawful refusal, it is just a hidden field.
 *
 * A WITHHELD ROW IS STILL RETURNED. It says it was withheld, keeps its criterion and its
 * verdict, and drops only the free text. Dropping the whole row would leave the applicant
 * unable to tell a refusal from an absence, and a right to access that cannot be checked
 * is not one — the same reason the totals below count what was held back.
 */

/** Long enough that "ไม่ให้" cannot pass for a justification under ม.30 วรรคสอง. */
const WITHHOLD_REASON_MIN = 10;

function refuse(code, messageTh, statusCode) {
    const err = new Error(messageTh);
    err.code = code;
    err.messageTh = messageTh;
    err.statusCode = statusCode;
    return err;
}

/**
 * What one checklist row looks like to the person it is about.
 *
 * `notes` is the only field the switch touches. The criterion, the section, the verdict
 * and whether it was critical are the FINDING, not the free text, and a farmer told
 * "criterion 1.1 failed" without being told why can at least ask — a farmer told nothing
 * cannot even do that.
 */
function toApplicantView(row) {
    const withheld = Boolean(row.disclosureWithheld);
    return {
        id: row.id,
        itemCode: row.itemCode,
        section: row.section,
        response: row.response,
        isCritical: Boolean(row.isCritical),
        recordedAt: row.recordedAt || null,
        submittedAt: (row.audit && row.audit.submittedAt) || null,
        withheld,
        // Absent rather than empty-string: a caller that prints `notes` must show nothing,
        // and a caller that branches on it must see the difference between "no note was
        // written" and "a note was written and withheld" — which `withheld` answers.
        notes: withheld ? null : (row.notes || null),
        withholdReason: withheld ? (row.withholdReason || null) : null,
    };
}

/**
 * Every checklist note recorded against an application, as its own applicant may read it.
 *
 * @param {object} args
 * @param {object} args.prisma
 * @param {string} args.applicationId
 * @param {string} args.healthId  the caller's health identity — the ownership check
 */
async function listAuditNotesForApplicant({ prisma, applicationId, healthId } = {}) {
    // Ownership first, and a filing that is not this applicant's is a 404 rather than a
    // 403: telling a stranger that an application exists is itself a disclosure.
    const application = await prisma.application.findFirst({
        where: { id: String(applicationId || ''), healthId: String(healthId || ''), isDeleted: false },
        select: { id: true },
    });
    if (!application) {
        throw refuse('APPLICATION_NOT_FOUND', 'ไม่พบคำขอนี้ในบัญชีของคุณ', 404);
    }

    const rows = await prisma.farmAuditChecklistItem.findMany({
        where: { audit: { applicationId: application.id, isDeleted: false } },
        orderBy: [{ section: 'asc' }, { itemCode: 'asc' }],
        select: {
            id: true,
            itemCode: true,
            section: true,
            response: true,
            notes: true,
            isCritical: true,
            recordedAt: true,
            disclosureWithheld: true,
            withholdReason: true,
            audit: { select: { id: true, applicationId: true, submittedAt: true } },
        },
    });

    const items = rows.map(toApplicantView);
    return {
        applicationId: application.id,
        items,
        total: items.length,
        // Counted, not inferred from the list: a surface that shows only disclosed rows
        // must still be able to say how many were held back.
        withheldCount: items.filter((item) => item.withheld).length,
    };
}

/**
 * Withhold one note under ม.30 วรรคสอง, or put it back.
 *
 * Not a toggle: the caller states which way, so a double-click cannot flip a lawful
 * refusal into a disclosure nobody decided on.
 */
async function setNoteDisclosure({ prisma, itemId, withheld, reason, actorId } = {}) {
    const item = await prisma.farmAuditChecklistItem.findUnique({
        where: { id: String(itemId || '') },
        select: { id: true },
    });
    if (!item) {
        throw refuse('CHECKLIST_ITEM_NOT_FOUND', 'ไม่พบรายการตรวจนี้', 404);
    }

    if (!withheld) {
        // Clear the whole refusal, not just the flag. A stale reason left beside a
        // disclosed row would read, later, as though it were still being withheld.
        return prisma.farmAuditChecklistItem.update({
            where: { id: item.id },
            data: {
                disclosureWithheld: false,
                withholdReason: null,
                withheldBy: null,
                withheldAt: null,
            },
        });
    }

    const text = String(reason || '').trim();
    if (text.length < WITHHOLD_REASON_MIN) {
        throw refuse(
            'WITHHOLD_REASON_REQUIRED',
            'การไม่เปิดเผยบันทึกต้องระบุเหตุผลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล มาตรา 30 วรรคสอง '
            + 'เช่น บันทึกอ้างถึงบุคคลอื่นซึ่งจะกระทบสิทธิของเขา — กรุณาเขียนเหตุผลให้ผู้ยื่นอ่านเข้าใจ',
            422,
        );
    }

    return prisma.farmAuditChecklistItem.update({
        where: { id: item.id },
        data: {
            disclosureWithheld: true,
            withholdReason: text,
            withheldBy: actorId || null,
            withheldAt: new Date(),
        },
    });
}

module.exports = {
    listAuditNotesForApplicant,
    setNoteDisclosure,
    toApplicantView,
    WITHHOLD_REASON_MIN,
};
