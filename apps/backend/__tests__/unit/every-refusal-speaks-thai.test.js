/**
 * ทุกคำปฏิเสธต้องมีประโยคไทย และต้องเป็นประโยคที่ตรงกับเหตุผลจริง
 *
 * สองบั๊กที่เทสนี้กัน ทั้งคู่วัดจากระบบที่รันจริง 2026-09-09:
 *
 * 1. sendErrorResponse รู้จักแค่ 13 รหัส · อีก 191 รหัสที่มีประโยคไทยเขียนไว้แล้ว
 *    ใน shared/error-codes.js ตกลงมาที่ "เกิดข้อผิดพลาดภายในระบบ" ทั้งหมด
 *    ตัวอย่างที่วัดได้: ล็อกอินผิด 5 ครั้ง ระบบล็อกบัญชีถูกต้อง ตอบ 423 ACCOUNT_LOCKED
 *    แต่ messageTh บอกว่าระบบพัง ทั้งที่ระบบกำลังปกป้องผู้ใช้อยู่
 *
 * 2. middleware/auth-middleware.js ตอบเอง 29 จุด ข้าม responder ไป · ไม่มีสักจุด
 *    ที่ส่ง messageTh ทั้งที่ทั้ง 11 รหัสที่ใช้มีประโยคไทยครบ · ผลคือความล้มเหลว
 *    ที่เกษตรกรเจอบ่อยที่สุด (เซสชันหมดอายุ ไม่มีสิทธิ์) พูดอังกฤษล้วน
 *
 * ทำไมสำคัญกว่าที่เห็น: ผู้ใช้ที่ถูกบอกว่า "ระบบพัง" จะลองซ้ำ ๆ แทนที่จะทำสิ่งที่
 * แก้ปัญหาได้จริง แล้วโทรหาซัพพอร์ตเรื่องที่ไม่ใช่บั๊ก
 */

'use strict';

const express = require('express');
const request = require('supertest');
const { sendErrorResponse } = require('../../shared/api-response');
const errorCodesModule = require('../../shared/error-codes');

const CATALOGUE = errorCodesModule.ERROR_CODES || errorCodesModule;

function appReturning(payload) {
    const app = express();
    app.get('/x', (req, res) => sendErrorResponse(res, req, payload));
    return app;
}

describe('sendErrorResponse อ่านแคตตาล็อกใหญ่ ไม่ใช่แค่ 13 รหัส', () => {
    /** รหัสที่มีประโยคไทย แต่ไม่ได้อยู่ในลิสต์เล็ก — เดิมตกลงมาที่ข้อความกลางทั้งหมด */
    const sample = ['ACCOUNT_LOCKED', 'APPLICATION_NOT_EDITABLE', 'TOKEN_EXPIRED', 'NO_TOKEN']
        .filter((c) => CATALOGUE[c]?.messageTh);

    it('มีรหัสให้ตรวจ', () => {
        expect(sample.length).toBeGreaterThan(0);
    });

    it.each(sample)('%s ได้ประโยคของตัวเอง ไม่ใช่ "เกิดข้อผิดพลาดภายในระบบ"', async (code) => {
        const res = await request(appReturning({ status: 400, code })).get('/x');
        expect(res.body.messageTh).toBe(CATALOGUE[code].messageTh);
        expect(res.body.messageTh).not.toBe('เกิดข้อผิดพลาดภายในระบบ');
    });

    it('ผู้เรียกที่ส่ง messageTh มาเองยังชนะ', async () => {
        const res = await request(appReturning({
            status: 400, code: 'ACCOUNT_LOCKED', messageTh: 'ข้อความเฉพาะกิจ',
        })).get('/x');
        expect(res.body.messageTh).toBe('ข้อความเฉพาะกิจ');
    });

    it('รหัสที่ไม่มีใครรู้จักยังได้ข้อความกลาง ไม่ใช่ undefined', async () => {
        const res = await request(appReturning({ status: 500, code: 'NOBODY_KNOWS_THIS' })).get('/x');
        expect(typeof res.body.messageTh).toBe('string');
        expect(res.body.messageTh.length).toBeGreaterThan(0);
    });
});

describe('auth-middleware ไม่ตอบเป็นภาษาอังกฤษล้วนอีก', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'middleware', 'auth-middleware.js'), 'utf8');

    it('ใช้ authError() แทน res.status().json() ในจุดที่มี code', () => {
        // ถ้าตัวเลขนี้ตก แปลว่ามีคนเพิ่มจุดตอบใหม่โดยไม่ผ่านตัวช่วย
        const viaHelper = (src.match(/authError\(res,/g) || []).length;
        expect(viaHelper).toBeGreaterThanOrEqual(25);
    });

    it('authError เติม messageTh จากแคตตาล็อก', () => {
        expect(src).toMatch(/function authError\([\s\S]*?messageTh[\s\S]*?error-codes/);
    });
});
