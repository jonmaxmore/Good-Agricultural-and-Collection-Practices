/**
 * ฐานข้อมูลต้องปฏิเสธคำที่ไม่มีอยู่จริง ไม่ใช่แค่จาวาสคริปต์
 *
 * วัดจริง 2026-09-09 ก่อนแก้: ทั้งสคีมามี CHECK constraint ศูนย์ตัว · เขียน SQL ตรง ๆ
 * ใส่ค่าที่ไม่มีอยู่จริงได้ทั้งคู่ —
 *
 *   UPDATE applications SET status='ไม่มีสถานะนี้อยู่จริง'   -> UPDATE 1
 *   INSERT INTO fee_payments (phase,"amountThb") ('PHASE_999',-1) -> INSERT 1
 *
 * ตัวที่สองร้ายกว่า: ค่าธรรมเนียม -1 บาท บนแถวที่ทั้งระบบใช้เป็นหลักฐานว่าเงินเข้าแล้ว
 *
 * เทสนี้ไม่ต่อฐานข้อมูล — มันอ่านไฟล์ migration แล้วยืนยันว่าคำที่ constraint ยอมรับ
 * ตรงกับคำที่โค้ดใช้จริง · เหตุผล: ถ้าวันหนึ่งมีคนเพิ่มสถานะใน WORKFLOW_STATES แล้วลืม
 * แก้ constraint ระบบจะเขียนสถานะนั้นไม่ลงและล้มตอนรัน ไม่ใช่ตอนเทส
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { WORKFLOW_STATES } = require('../../services/workflow-transition-service');

const MIGRATION = path.join(
    __dirname, '..', '..', 'prisma', 'migrations',
    '20260909000000_integrity_constraints', 'migration.sql',
);

describe('CHECK constraint มีอยู่จริงในไฟล์ migration', () => {
    let sql;
    beforeAll(() => { sql = fs.readFileSync(MIGRATION, 'utf8'); });

    it('ไฟล์ migration มีอยู่ (ถ้าถูกลบ เทสนี้ไม่ได้เฝ้าอะไรเลย)', () => {
        expect(fs.existsSync(MIGRATION)).toBe(true);
    });

    it.each([
        'applications_status_vocabulary',
        'fee_payments_phase_vocabulary',
        'fee_payments_amount_positive',
        'applications_phase_amounts_nonnegative',
    ])('มี constraint %s', (name) => {
        expect(sql).toContain(name);
    });

    it('หลักฐานการรับเงินไม่หายไปพร้อมคำขอ — FK เป็น RESTRICT ไม่ใช่ CASCADE', () => {
        expect(sql).toMatch(/fee_payments_applicationId_fkey[\s\S]*ON DELETE RESTRICT/);
    });
});

describe('คำใน constraint ตรงกับคำที่โค้ดใช้', () => {
    let sql;
    beforeAll(() => { sql = fs.readFileSync(MIGRATION, 'utf8'); });

    it.each(WORKFLOW_STATES)('สถานะ %s อยู่ใน CHECK', (state) => {
        // ถ้าข้อนี้แดง แปลว่ามีคนเพิ่มสถานะในโค้ดแล้วลืมแก้ constraint —
        // ระบบจะเขียนสถานะนั้นลงฐานข้อมูลไม่ได้เลยตอนรันจริง
        expect(sql).toContain(`'${state}'`);
    });

    it('CHECK ไม่มีสถานะที่โค้ดไม่รู้จัก', () => {
        const block = sql.slice(sql.indexOf('applications_status_vocabulary'));
        const listed = [...block.slice(0, block.indexOf('));')).matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
        const unknown = listed.filter((s) => !WORKFLOW_STATES.includes(s));
        expect({ unknown }).toEqual({ unknown: [] });
    });
});
