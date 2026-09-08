/**
 * ตำแหน่งงานมีคลังชื่อเดียว และเส้นทางเดินคำขอต้องมีเจ้าของทุกขั้น
 *
 * สองสิ่งที่เทสนี้กัน — ทั้งคู่เคยเกิดจริงระหว่างตัดระบบเต็มมาเป็น Lite:
 *
 *   1. ชื่อสำรองที่ชี้ไปตำแหน่งที่ไม่มีอยู่ · normalizeRole() คืนค่าที่ไม่มีใครรู้จัก
 *      บัญชีถูกสร้างได้ แต่ล็อกอินแล้วถูกล็อกออกโดยไม่มีคำอธิบาย
 *
 *   2. ขั้นตอนในเส้นทางที่ไม่มีตำแหน่งไหนเดินได้ · ตอนยุบ scheduler กับ account
 *      ทิ้ง สองขั้นกลายเป็นทางตัน คำขอค้างอยู่ตรงนั้นตลอดไป และไม่มี error ใด ๆ
 *      เพราะไม่มีใครไปกดมันได้ตั้งแต่แรก
 */

'use strict';

const { CANONICAL_ROLES, ROLE_ALIASES, normalizeRole } = require('../../shared/canonical-rbac');
const {
    ALLOWED_TRANSITIONS,
    ROLE_TRANSITIONS,
    canRoleTransition,
} = require('../../services/workflow-transition-service');

const REAL = new Set(Object.values(CANONICAL_ROLES));

describe('คลังชื่อตำแหน่ง', () => {
    it('ชื่อสำรองทุกตัวชี้ไปตำแหน่งที่มีอยู่จริง', () => {
        for (const [alias, target] of Object.entries(ROLE_ALIASES)) {
            expect({ alias, real: REAL.has(target) }).toEqual({ alias, real: true });
        }
    });

    it('ชื่อของตำแหน่งที่มีอยู่ ต้องชี้กลับมาที่ตัวเอง ไม่ใช่ไปโผล่ที่ตำแหน่งอื่น', () => {
        for (const role of REAL) {
            expect({ role, normalised: normalizeRole(role) }).toEqual({ role, normalised: role });
        }
    });

    it('ทุกตำแหน่งใน ROLE_TRANSITIONS มีอยู่ในคลังชื่อ', () => {
        for (const role of Object.keys(ROLE_TRANSITIONS)) {
            expect({ role, real: REAL.has(role) }).toEqual({ role, real: true });
        }
    });
});

describe('เส้นทางเดินคำขอไม่มีขั้นที่ไม่มีเจ้าของ', () => {
    /** ทุก edge ที่กฎอนุญาต ต้องมีอย่างน้อยหนึ่งตำแหน่งที่เดินมันได้ */
    const edges = [];
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
        for (const to of targets) { edges.push([from, to]); }
    }

    it('มี edge ให้ตรวจ', () => {
        expect(edges.length).toBeGreaterThan(0);
    });

    it.each(edges)('%s -> %s มีคนเดินได้', (from, to) => {
        const owners = [...REAL].filter((role) => canRoleTransition(role, from, to));
        expect({ edge: `${from}->${to}`, owners }).not.toEqual({ edge: `${from}->${to}`, owners: [] });
    });
});

describe('งานเงินกับงานตัดสิน ไม่ใช่คนเดียวกัน', () => {
    it('ผู้ตรวจเอกสารยืนยันรับเงินไม่ได้', () => {
        expect(canRoleTransition('document_reviewer', 'PENDING_DOC_FEE', 'DOC_FEE_PAID')).toBe(false);
    });

    it('ผู้ตรวจแปลงยืนยันรับเงินไม่ได้', () => {
        expect(canRoleTransition('auditor', 'PENDING_AUDIT_FEE', 'AUDIT_FEE_PAID')).toBe(false);
    });

    it('บัญชีตัดสินผลตรวจเอกสารไม่ได้', () => {
        expect(canRoleTransition('account', 'ASSIGNED_FOR_REVIEW', 'DOC_APPROVED')).toBe(false);
    });

    it('คนจัดคิวตัดสินผลตรวจแปลงไม่ได้', () => {
        expect(canRoleTransition('scheduler', 'AUDIT_CONFIRMED', 'AUDIT_PASSED')).toBe(false);
    });
});
