/**
 * ตัวตนของหน่วยงานที่ติดตั้งระบบนี้ — ชื่อ ที่อยู่ เบอร์ อีเมล เว็บไซต์
 *
 * ทำไมต้องมีไฟล์นี้: GACP Lite ถูกส่งให้ลูกค้าเอาไปติดตั้งเอง · ก่อนหน้านี้ชื่อกรมฯ
 * เบอร์ 0-2591-7007 และอีเมล contact@gacpth.com ถูกพิมพ์ไว้ในโค้ด 77 จุด ผลคือระบบ
 * ของลูกค้าบอกผู้ใช้ของลูกค้าให้ติดต่อ **หน่วยงานอื่น** — บนใบเสร็จ บนหน้าติดต่อ
 * ในอีเมลแจ้งเตือน และในเมทาดาทาของทุกหน้า
 *
 * กติกา: ค่าใดที่เปลี่ยนตามที่ติดตั้ง ต้องอ่านจาก env · ค่าเริ่มต้นที่เขียนไว้ที่นี่คือ
 * ของกรมการแพทย์แผนไทยฯ ซึ่งเป็นเจ้าของระบบต้นทาง — ลูกค้าที่ไม่ตั้ง env จะได้ค่านั้น
 * และนั่นคือเหตุผลที่ `assertConfigured()` มีอยู่ ให้เรียกตอนบูตในโหมด production
 *
 * ฝั่งหน้าจอมีคู่แฝดที่ต้องตรงกัน: apps/web-app/src/lib/organization-identity.ts
 * (ใช้ NEXT_PUBLIC_* เพราะค่าต้องไปถึงเบราว์เซอร์)
 */

'use strict';

const DEFAULTS = Object.freeze({
    name: 'กรมการแพทย์แผนไทยและการแพทย์ทางเลือก',
    nameEn: 'Department of Thai Traditional and Alternative Medicine, Ministry of Public Health',
    phone: '0-2591-7007',
    email: 'contact@gacpth.com',
    address: '88/23 หมู่ 4 ตำบลตลาดขวัญ อำเภอเมืองนนทบุรี จังหวัดนนทบุรี 11000',
    website: 'https://dtam.moph.go.th',
});

const read = (key, fallback) => {
    const v = process.env[key];
    return v && String(v).trim() ? String(v).trim() : fallback;
};

const ORGANIZATION = Object.freeze({
    name: read('ORG_NAME', DEFAULTS.name),
    nameEn: read('ORG_NAME_EN', DEFAULTS.nameEn),
    phone: read('ORG_PHONE', DEFAULTS.phone),
    email: read('ORG_EMAIL', DEFAULTS.email),
    address: read('ORG_ADDRESS', DEFAULTS.address),
    website: read('ORG_WEBSITE', DEFAULTS.website),
});

/** บรรทัดติดต่อสำหรับท้ายเอกสาร — รูปแบบเดียวทุกใบ */
const ORGANIZATION_CONTACT_LINE = `โทร: ${ORGANIZATION.phone} | อีเมล: ${ORGANIZATION.email}`;

/**
 * คืนรายการค่าที่ยังเป็นของหน่วยงานต้นทาง (ลูกค้ายังไม่ได้ตั้งเอง)
 *
 * ไม่ throw — การพิมพ์ชื่อผิดบนเอกสารเป็นเรื่องที่ต้องรู้ ไม่ใช่เรื่องที่ควรทำให้
 * ระบบบูตไม่ขึ้น · ผู้เรียกตัดสินเองว่าจะเตือนหรือจะหยุด
 */
function unconfiguredKeys() {
    return Object.entries({
        ORG_NAME: ORGANIZATION.name === DEFAULTS.name,
        ORG_PHONE: ORGANIZATION.phone === DEFAULTS.phone,
        ORG_EMAIL: ORGANIZATION.email === DEFAULTS.email,
        ORG_ADDRESS: ORGANIZATION.address === DEFAULTS.address,
    }).filter(([, isDefault]) => isDefault).map(([key]) => key);
}

module.exports = { ORGANIZATION, ORGANIZATION_CONTACT_LINE, unconfiguredKeys, DEFAULTS };
