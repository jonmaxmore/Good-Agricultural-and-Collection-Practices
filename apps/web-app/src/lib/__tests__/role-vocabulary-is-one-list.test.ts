/**
 * ตำแหน่งงานมีคลังชื่อเดียว และทุกที่ที่เอ่ยถึงตำแหน่ง ต้องเอ่ยชื่อที่มีอยู่จริง
 *
 * เหตุที่ต้องมีเทสนี้: ตอนตัดระบบเต็มมาเป็น Lite เราลบตำแหน่ง account_dtam /
 * account_platform ออกจากคลังชื่อ แต่หน้าจอที่ให้ผู้ดูแล "เลือกตำแหน่ง" ยังเสนอสองชื่อ
 * นั้นอยู่ · ผลคือผู้ดูแลสร้างเจ้าหน้าที่ด้วยตำแหน่งที่ normalizeRole() แปลไม่ออก
 * บัญชีถูกสร้างสำเร็จ แต่ล็อกอินแล้วถูกล็อกออกทันที และไม่มีอะไรบอกว่าเพราะอะไร
 *
 * เทสนี้ทำให้ "เพิ่มตำแหน่งในหน้าจอโดยไม่เพิ่มในคลังชื่อ" กลายเป็นสิ่งที่ทำไม่ได้
 */

import { ADMIN_ROLE_OPTIONS } from '@/lib/constants/admin-role-options';
import { CANONICAL_ROLES, ROLE_ALIASES, normalizeRole, PROVIDER_ROLES } from '@/lib/constants/canonical-roles';

const REAL_ROLES = new Set<string>(Object.values(CANONICAL_ROLES));

describe('คลังชื่อตำแหน่ง', () => {
    it('ไม่มีชื่อสำรองที่ชี้ไปตำแหน่งที่ไม่มีอยู่', () => {
        for (const [alias, target] of Object.entries(ROLE_ALIASES)) {
            expect({ alias, target, real: REAL_ROLES.has(target) })
                .toEqual({ alias, target, real: true });
        }
    });

    it('ชื่อสำรองทุกตัวเป็นการสะกดของตำแหน่งเดียวกัน ไม่ใช่การแปลงเป็นตำแหน่งอื่น', () => {
        // ถ้าคีย์เป็นชื่อตำแหน่งที่มีอยู่ มันต้องชี้กลับมาที่ตัวเอง — ไม่ใช่ไปโผล่ที่อื่น
        // (กับดักเดิม: head_auditor -> auditor, reviewer_auditor -> document_reviewer)
        for (const [alias, target] of Object.entries(ROLE_ALIASES)) {
            if (REAL_ROLES.has(alias)) {
                expect({ alias, target }).toEqual({ alias, target: alias });
            }
        }
    });

    it('PROVIDER_ROLES มีเฉพาะตำแหน่งที่มีอยู่จริง', () => {
        for (const role of PROVIDER_ROLES) {
            expect(REAL_ROLES.has(role)).toBe(true);
        }
    });
});

describe('ตัวเลือกตำแหน่งในหน้าจอผู้ดูแล', () => {
    it('มีตัวเลือกให้ตรวจ', () => {
        expect(ADMIN_ROLE_OPTIONS.length).toBeGreaterThan(0);
    });

    it.each(ADMIN_ROLE_OPTIONS.map((o) => [o.value, o.canonical]))(
        '%s เป็นตำแหน่งที่มีอยู่จริง',
        (_value, canonical) => {
            expect(REAL_ROLES.has(canonical as string)).toBe(true);
        },
    );

    it.each(ADMIN_ROLE_OPTIONS.map((o) => [o.value, o.canonical]))(
        '%s: ค่าที่เก็บลงฐานข้อมูล normalise กลับมาเป็นตัวเดิม',
        (value, canonical) => {
            // ผู้ดูแลเลือก value (ตัวใหญ่) แต่ระบบตัดสินสิทธิ์จาก canonical
            // ถ้าสองอย่างนี้ไม่ตรงกัน บัญชีจะได้สิทธิ์ของตำแหน่งอื่น หรือไม่ได้เลย
            expect(normalizeRole(value as string)).toBe(canonical);
        },
    );
});
