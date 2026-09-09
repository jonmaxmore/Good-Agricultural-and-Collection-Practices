/**
 * "ไม่ใช่ผู้ยื่น" ไม่ได้แปลว่า "เป็นเจ้าหน้าที่"
 *
 * ประตูอ่านค่าธรรมเนียม GET /api/fees/:applicationId ตัดสินสิทธิ์ด้วยการปฏิเสธ:
 *
 *     const isOfficer = Boolean(req.user?.providerId)
 *                    || normalizeRole(req.user?.role) !== 'health';
 *
 * normalizeRole คืน null กับทุกคำที่ไม่อยู่ใน ROLE_ALIASES (canonical-rbac.js:204)
 * เงื่อนไขจึงอ่านว่า `null !== 'health'` = จริง = เป็นเจ้าหน้าที่ · ค่าเริ่มต้นของ
 * การตัดสินสิทธิ์กลายเป็น "ผ่าน" ซึ่งกลับด้าน
 *
 * วัดจริง 2026-09-09 บนระบบที่รันอยู่ · ผู้ยื่นคนที่สอง (คนละคนกับเจ้าของใบ)
 * โทเคนของผู้ใช้คนเดียวกัน ต่างกันแค่ค่า role:
 *
 *   role: 'health'         ->  404  ไม่พบคำขอนี้              (ถูกต้อง)
 *   role: 'farmer_legacy'  ->  200  {applicationNumber, phase1Amount, phase2Amount,
 *                                    feePayments[].confirmedBy{firstName,lastName}}
 *
 * บทบาทที่ระบบไม่รู้จักเกิดได้จริง — โทเคนที่ออกก่อนการรวบบทบาทใน Step 2.1
 * หรือแถวผู้ใช้ที่ค่า role ไม่ได้อยู่ในรายการแล้ว
 *
 * คอมเมนต์ใน routes/api/system/tickets.js:25 บันทึกว่าโค้ดชุดนี้เคยเจอบั๊กชนิดเดียวกัน
 * มาแล้ว ("'HEALTH' !== 'health' is true ... made the old gate dead code")
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { isProviderRole, normalizeRole, CANONICAL_ROLES } = require('../../shared/canonical-rbac');

const FEE_ROUTE = path.join(__dirname, '..', '..', 'routes', 'api', 'fees', 'fee-payments.js');

describe('คำที่ระบบไม่รู้จัก ต้องไม่ถูกนับเป็นเจ้าหน้าที่', () => {
    // ตั้งชื่อเคสเอง แทนการ JSON.stringify — undefined ไม่มีรูป JSON จึงหลุดหายไป
    const UNKNOWN = [
        ['farmer_legacy', 'farmer_legacy'],
        ['HEALTH_USER', 'HEALTH_USER'],
        ['officer', 'officer'],
        ['สตริงว่าง', ''],
        ['null', null],
        ['undefined', undefined],
        ['ภาษาไทย', 'ผู้ตรวจ'],
    ];

    it.each(UNKNOWN)('%s -> ไม่ใช่เจ้าหน้าที่', (_label, role) => {
        expect(isProviderRole(role)).toBe(false);
        // และนี่คือเหตุผลที่เงื่อนไขแบบปฏิเสธพัง — คำเดียวกันนี้ผ่านเงื่อนไขเดิม
        expect(normalizeRole(role) !== 'health').toBe(true);
    });

    it('ผู้ยื่นก็ไม่ใช่เจ้าหน้าที่', () => {
        expect(isProviderRole('health')).toBe(false);
        expect(isProviderRole(CANONICAL_ROLES.HEALTH)).toBe(false);
    });

    it('เจ้าหน้าที่จริงยังเป็นเจ้าหน้าที่ — ไม่มีใครเสียสิทธิ์', () => {
        for (const role of ['admin', 'scheduler', 'account', 'document_reviewer', 'auditor']) {
            expect(isProviderRole(role)).toBe(true);
        }
    });
});

describe('ประตูค่าธรรมเนียมไม่ตัดสินสิทธิ์ด้วยการปฏิเสธอีก', () => {
    let src;
    beforeAll(() => { src = fs.readFileSync(FEE_ROUTE, 'utf8'); });

    it('ไม่มีเงื่อนไข "ไม่เท่ากับ health" เหลืออยู่', () => {
        expect(src).not.toMatch(/normalizeRole\([^)]*\)\s*!==?\s*'health'/);
    });

    it('ใช้รายชื่อบทบาทเจ้าหน้าที่ตัดสิน', () => {
        expect(src).toMatch(/const isOfficer = isProviderRole\(/);
    });

    it('การตรวจความเป็นเจ้าของยังอยู่ครบ', () => {
        // ถ้า isOfficer เป็นเท็จ ต้องเทียบ healthId กับเจ้าของใบ และตอบ 404 ไม่ใช่ 403
        expect(src).toMatch(/application\.healthId !== req\.user\?\.healthId/);
        const ownerBlock = src.slice(src.indexOf('const isOfficer'), src.indexOf('const confirmed'));
        expect(ownerBlock).toMatch(/status: 404/);
        expect(ownerBlock).not.toMatch(/status: 403/);
    });
});
