'use strict';

/**
 * Turn a cert-auto-generation failure into the answer the auditor actually needs.
 *
 * F-WALK-01 (walked 2026-09-06): pressing PASS on the desktop audit-decision door with no
 * onsite audit recorded returned a blanket HTTP 500 "Failed to record audit decision". The
 * real reason — assertOnsiteEvidenceSufficient threw NO_ONSITE_AUDIT, so the certificate
 * cannot issue until the field audit is recorded — died in the catch. The auditor read a
 * server error where they should have read "record the onsite audit first".
 *
 * writeApplicationStatus wraps the originating error and CARRIES its `.code` and, when the
 * error had one, its `.statusCode` (application-status-writer.js — CERT_AUTO_GEN_ROLLBACK).
 * So the route can map the code to a 4xx the auditor can act on, with a Thai sentence, and
 * fall through to 500 only for a genuinely unexpected failure.
 *
 * Returns { status, body } for a known, correctable failure; null when the error is not one
 * of them (the caller answers 500). Pure — no I/O, unit-tested.
 */

/** Onsite-evidence-gate codes: the decision is refused because the evidence is not there. */
const ONSITE_EVIDENCE_TH = Object.freeze({
    NO_ONSITE_AUDIT:
        'ยังไม่มีบันทึกการตรวจภาคสนามของคำขอนี้ — ต้องเปิดการตรวจ (เช็คอิน GPS) บันทึกแบบตรวจ '
        + 'และถ่ายภาพหลักฐานให้ครบก่อน จึงจะบันทึกผล PASS และออกใบรับรองได้',
    AUDIT_APPLICATION_MISMATCH:
        'บันทึกการตรวจที่ผูกไว้ไม่ตรงกับคำขอนี้ — กรุณาบันทึกผลใหม่เพื่อให้ผูกกับการตรวจของคำขอนี้เอง',
    EVIDENCE_CAPTURE_UNAVAILABLE:
        'ระบบยืนยันหลักฐานภาคสนามไม่พร้อมใช้งานขณะนี้ — ยังออกใบรับรองไม่ได้ (กันไว้ก่อนโดยตั้งใจ)',
    INSUFFICIENT_PHOTOS:
        'ภาพถ่ายหลักฐานภาคสนามยังไม่ครบตามจำนวนขั้นต่ำ — กรุณาถ่ายเพิ่มก่อนบันทึกผล PASS',
    INCOMPLETE_CHECKLIST:
        'แบบตรวจภาคสนามยังไม่ครบทุกข้อ — กรุณาบันทึกให้ครบก่อนบันทึกผล PASS',
    CRITICAL_CHECKLIST_FAILURE:
        'มีข้อตรวจสำคัญที่ไม่ผ่าน — ออกใบรับรองไม่ได้',
});

function auditDecisionErrorResponse(error) {
    const code = error?.code || error?.cause?.code || null;

    if (code && ONSITE_EVIDENCE_TH[code]) {
        return {
            status: 422,
            body: {
                success: false,
                code,
                error: 'Onsite evidence insufficient for certification',
                messageTh: ONSITE_EVIDENCE_TH[code],
            },
        };
    }

    // Certificate-generation refusals (e.g. CERTIFICATE_FARM_LOCATION_MISSING,
    // CERTIFICATE_PLANT_UNKNOWN) carry their own 4xx statusCode and a Thai message on the
    // cause. Honour that intent instead of flattening it to 500.
    const statusCode = error?.statusCode || error?.cause?.statusCode || null;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        const stated = error?.cause?.message || error?.message || null;
        return {
            status: statusCode,
            body: {
                success: false,
                code: code || 'CERTIFICATE_NOT_ISSUED',
                error: 'Certificate could not be issued',
                messageTh: withRemedyForTheAuditor(code, stated),
            },
        };
    }

    return null;
}


/**
 * คำปฏิเสธที่มาถึงประตูนี้ ถูกอ่านโดย "ผู้ตรวจแปลง" — ไม่ใช่ผู้ยื่น และไม่ใช่ผู้ดูแลระบบ
 *
 * เดินจริงบน staging 2026-09-07: ผู้ตรวจกดบันทึกผลว่าผ่าน แล้วได้
 * CERTIFICATE_FARM_LOCATION_MISSING พร้อมประโยค "กรุณาแก้ไขข้อมูลที่ตั้งฟาร์มในคำขอ…"
 * ซึ่งสั่งสิ่งที่ผู้ตรวจทำไม่ได้ — PATCH /api/farms/:id เฝ้าด้วย authenticateHealth และ
 * ผูกกับเจ้าของฟาร์ม · ผู้ตรวจจึงติดกำแพงที่มีป้ายชี้ไปยังประตูที่เขาเปิดไม่ได้ และเจ้าของ
 * ฟาร์มก็ไม่รู้ว่ามีอะไรค้างอยู่
 *
 * ทางที่ประตูนี้มีจริงคือส่งกลับไปให้ผู้ยื่นแก้ (AUDIT_CONFIRMED → CAR_PENDING)
 * ข้อเท็จจริงว่าอะไรขาดยังเป็นของ certificate-service เหมือนเดิม — ที่เติมตรงนี้คือ
 * "แล้วคนที่ยืนอยู่ตรงประตูนี้ทำอะไรได้"
 */
const APPLICANT_DATA_REFUSALS = new Set([
    'CERTIFICATE_FARM_LOCATION_MISSING',
    'CERTIFICATE_FARM_NAME_MISSING',
    'CERTIFICATE_PLANT_UNKNOWN',
    'CERTIFICATE_HOLDER_MISMATCH',
]);

const AUDITOR_REMEDY_TH = 'ข้อมูลนี้แก้ได้โดยผู้ยื่นคำขอเท่านั้น '
    + 'กรุณาส่งกลับให้ผู้ยื่นแก้ไข (ขอให้แก้ไข/CAR) แล้วบันทึกผลอีกครั้งเมื่อแก้ครบ';

/** ตัดประโยคที่สั่งผู้ตรวจให้ไปแก้ข้อมูลเอง แล้วต่อด้วยทางที่เขาเดินได้ */
function withRemedyForTheAuditor(code, stated) {
    if (!stated) { return stated; }
    if (!APPLICANT_DATA_REFUSALS.has(String(code || ''))) { return stated; }
    const fact = String(stated).replace(/\s*กรุณาแก้ไข[^]*$/u, '').trim();
    return `${fact} ${AUDITOR_REMEDY_TH}`;
}

module.exports = { auditDecisionErrorResponse, ONSITE_EVIDENCE_TH, AUDITOR_REMEDY_TH };
