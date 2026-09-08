/**
 * Ministry of Public Health — DTAM contact constants.
 *
 * Single source of truth for footer/header contact details rendered on
 * invoices, receipts, tax invoices, quotations, and the React document
 * layout. Replaces hardcoded duplicate-email lines like
 *   "อีเมล contact@gacpth.com | อีเมล contact@gacpth.com"
 * which appeared on every issued tax document (P0-8 in the
 * 2026-04-28 system cohesion audit).
 *
 * Phone confirmed 2026-04-28 by reading the footer of the official
 * DTAM site (https://dtam.moph.go.th). Source: the `tel:` link on
 * the homepage. If DTAM relocates or changes the switchboard, update
 * here — every printed tax document will pick it up on next render.
 */

const { ORGANIZATION } = require('./organization-identity');

// ชื่อเดิมยังอยู่เพราะเอกสาร PDF เรียกใช้ · ค่าไม่ได้พิมพ์ไว้ที่นี่แล้ว มันมาจาก
// organization-identity.js ซึ่งอ่านจาก env — เหตุผลเต็มอยู่ที่นั่น
const MINISTRY_CONTACT = Object.freeze({
    phone: ORGANIZATION.phone,
    email: ORGANIZATION.email,
    ministry: ORGANIZATION.name,
    ministryEn: ORGANIZATION.nameEn,
    address: ORGANIZATION.address,
    website: ORGANIZATION.website,
});

/**
 * One-line contact string for tax document footers.
 * Format: "โทร: <phone> | อีเมล: <email>"
 */
const MINISTRY_CONTACT_LINE = `โทร: ${MINISTRY_CONTACT.phone} | อีเมล: ${MINISTRY_CONTACT.email}`;

module.exports = {
    MINISTRY_CONTACT,
    MINISTRY_CONTACT_LINE,
};
