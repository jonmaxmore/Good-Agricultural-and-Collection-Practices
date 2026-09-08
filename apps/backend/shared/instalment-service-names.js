'use strict';

/**
 * บริการที่เงินแต่ละงวดซื้อ — ที่เดียวในระบบที่ตอบคำถามนี้
 *
 * มติ operator 2026-09-07: *"เราแยกตามบริการ เช่น ค่าบริการตรวจสอบเอกสาร สำหรับขออนุญาต
 * รูปแบบการปลูกแบบกลางแจ้ง"* — และ *"เรื่ององค์ประกอบบัญชี จะไปคุยกันเอง"*
 *
 * ก่อนหน้านี้ใบเสนอราคาแตกบรรทัดตาม **องค์ประกอบบัญชี** (ค่าธรรมเนียมกรม · ค่าบริการ
 * แพลตฟอร์ม · VAT) คูณด้วยจำนวนรูปแบบการปลูก ⇒ ปลูก 3 รูปแบบได้ 9 บรรทัด ซึ่งเป็นการ
 * กางบัญชีภายในให้ลูกค้าดู ไม่ใช่การบอกว่าเขาซื้ออะไร · มติข้างต้นกลับทิศ: หนึ่งบรรทัด
 * = หนึ่งบริการ × หนึ่งรูปแบบการปลูก ⇒ 3 บรรทัด แต่ละบรรทัดคือราคาที่จ่ายจริงของรูปแบบนั้น
 *
 * ทำไมต้องเป็นไฟล์แยก: ก่อนหน้านี้ไม่มีที่ไหนในระบบตอบว่า "งวดที่ 1 ซื้อบริการอะไร" —
 * ชื่อบริการกระจายอยู่ในตัวเรนเดอร์ PDF ปนกับชื่อ stage ('ตรวจประเมิน'/'รับรองผล') ซึ่งเป็น
 * คนละเรื่องกับชื่อบริการ · หน้าจอกับเอกสารจึงมีสิทธิ์ตอบไม่ตรงกันได้ตลอดเวลา
 *
 * @module shared/instalment-service-names
 */

/** ชื่อบริการต่องวด — คีย์คือหมายเลขงวดที่เอกสารพิมพ์ */
const INSTALMENT_SERVICE_NAMES = Object.freeze({
    1: 'ค่าบริการตรวจสอบเอกสาร',
    2: 'ค่าบริการตรวจประเมินแปลงและออกใบรับรอง',
});

/** บริการของการต่ออายุ — เก็บค่าเดียว ไม่แบ่งงวด (fee-service ใช้ slot PHASE_2 เพื่อความเข้ากันได้เท่านั้น) */
const RENEWAL_SERVICE_NAME = 'ค่าบริการต่ออายุใบรับรอง';

/** คำที่บอกว่าเงินก้อนนี้จ่ายเพื่ออะไร */
const PURPOSES = Object.freeze({
    NEW: 'ขออนุญาต',
    RENEWAL: 'ต่ออายุ',
});

/**
 * @param {number|string} phase   1 หรือ 2
 * @param {object} [opts]
 * @param {boolean} [opts.isRenewal]  true = คำขอต่ออายุ ซึ่งมีค่าบริการก้อนเดียว
 * @returns {string} ชื่อบริการที่พิมพ์บนบรรทัด
 */
function serviceNameForInstalment(phase, { isRenewal = false } = {}) {
    if (isRenewal) { return RENEWAL_SERVICE_NAME; }
    return INSTALMENT_SERVICE_NAMES[Number(phase)] || INSTALMENT_SERVICE_NAMES[1];
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.isRenewal]
 * @returns {string} 'ขออนุญาต' หรือ 'ต่ออายุ'
 */
function purposeWord({ isRenewal = false } = {}) {
    return isRenewal ? PURPOSES.RENEWAL : PURPOSES.NEW;
}

/**
 * คำขอนี้เป็นการต่ออายุหรือไม่ — คำตอบเดียวของระบบ
 *
 * `formData.renewalOf` คือรอยที่ renewal-service ประทับไว้ตอนสร้างคำขอต่ออายุ
 * เดิมคำตอบนี้ถูกเขียนซ้ำในตัวคิดราคา (stripe-checkout-service) ซึ่งแปลว่าเอกสารกับ
 * ราคามีสิทธิ์ตอบไม่ตรงกัน — คลาสเดียวกับข้อบกพร่องที่เจอ 19 ตัวเมื่อ 2026-09-07
 *
 * @param {object|null|undefined} application
 * @returns {boolean}
 */
function isRenewalFiling(application) {
    const formData = typeof application?.formData === 'object' && application.formData
        ? application.formData
        : {};
    return Boolean(formData.renewalOf);
}

module.exports = {
    INSTALMENT_SERVICE_NAMES,
    RENEWAL_SERVICE_NAME,
    PURPOSES,
    serviceNameForInstalment,
    purposeWord,
    isRenewalFiling,
};
