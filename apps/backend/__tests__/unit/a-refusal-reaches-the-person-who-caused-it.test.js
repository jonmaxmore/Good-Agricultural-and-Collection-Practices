/**
 * คำปฏิเสธเชิงกฎต้องบอกเหตุผลจริง ไม่ใช่ "เกิดข้อผิดพลาดภายในระบบ"
 *
 * วัดจริง 2026-09-09: ผู้ยื่นอัปโหลดเอกสารเข้าคำขอที่อยู่สถานะ PENDING_AUDIT_FEE
 * เซิร์ฟเวอร์รู้ครบว่า APPLICATION_NOT_EDITABLE และแคตตาล็อกมีประโยคไทยเขียนไว้แล้ว
 * แต่ผู้ยื่นได้:
 *
 *   error     "Failed to upload draft document"
 *   messageTh "เกิดข้อผิดพลาดภายในระบบ"     <- ไม่จริง ระบบทำงานปกติ
 *
 * เหตุ: respondError อ่าน opts.message ของผู้เรียกเป็น "ข้อความทับ" ทั้งที่ผู้เรียก
 * ตั้งใจให้เป็น "ข้อความสำรอง" · ผลคือกฎธุรกิจปกติถูกแสดงเป็นระบบพัง และเกษตรกร
 * โทรหาซัพพอร์ตเรื่องที่ไม่ใช่บั๊ก
 */

'use strict';

const express = require('express');
const request = require('supertest');
const { respondError } = require('../../shared/api-response');

/** โยน error ที่มีทั้ง status และ code แบบเดียวกับที่ service ชั้นในโยนจริง */
function buildApp(thrown, fallbackMessage) {
    const app = express();
    app.get('/boom', (req, res) => respondError(res, req, thrown, { message: fallbackMessage }));
    return app;
}

function businessRefusal(code, status = 409) {
    const e = new Error(`something the user did, not a fault: ${code}`);
    e.code = code;
    e.statusCode = status;
    return e;
}

describe('คำปฏิเสธที่แคตตาล็อกรู้จัก', () => {
    it('ตอบด้วยประโยคของแคตตาล็อก ไม่ใช่ข้อความสำรองของผู้เรียก', async () => {
        const res = await request(buildApp(businessRefusal('APPLICATION_NOT_EDITABLE'), 'Failed to upload draft document'))
            .get('/boom');
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('APPLICATION_NOT_EDITABLE');
        expect(res.body.messageTh).toBe('ใบสมัครนี้ไม่สามารถแก้ไขได้ในสถานะปัจจุบัน');
        expect(res.body.message).not.toBe('Failed to upload draft document');
    });

    it('ไม่บอกว่าเป็นข้อผิดพลาดภายในระบบ ทั้งที่ระบบทำงานปกติ', async () => {
        const res = await request(buildApp(businessRefusal('APPLICATION_NOT_EDITABLE'), 'Failed to upload draft document'))
            .get('/boom');
        expect(res.body.messageTh).not.toBe('เกิดข้อผิดพลาดภายในระบบ');
    });
});

describe('คำปฏิเสธที่แคตตาล็อกไม่รู้จัก', () => {
    it('ยังใช้ข้อความสำรองของผู้เรียกเหมือนเดิม — ไม่ได้ทำให้เส้นทางเดิมพัง', async () => {
        const res = await request(buildApp(businessRefusal('SOME_CODE_NO_CATALOGUE_KNOWS'), 'Failed to upload draft document'))
            .get('/boom');
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SOME_CODE_NO_CATALOGUE_KNOWS');
        expect(res.body.message).toBe('Failed to upload draft document');
    });
});
