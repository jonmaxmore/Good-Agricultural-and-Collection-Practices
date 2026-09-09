/**
 * โมดูลที่หายไป ต้องล้มตอน deploy ไม่ใช่ตอนมีคนกดปุ่ม
 *
 * routes/api/provider/index.js mount router 15 ตัวผ่าน createLazyRouter ซึ่ง
 * require ตอนมีคนยิงเข้ามาครั้งแรก · ผลข้างเคียงคือ mount ที่ชี้ไปหาโมดูลที่ไม่มีอยู่
 * ไม่ทำให้ boot ล้ม แต่ไปโผล่เป็น 500 ในหน้าผู้ใช้
 *
 * วัดจริง 2026-09-09 บนระบบที่รันอยู่ ก่อนแก้:
 *
 *   GET /api/provider/planting-cycles  -> 500 {"code":"MODULE_NOT_FOUND"}
 *   GET /api/provider/waiver-reopen    -> 500 {"code":"MODULE_NOT_FOUND"}
 *
 * ./planting ถูกลบตอนตัด T&T ออกจาก Lite และ ./waiver-reopen ไม่ได้ถูกนำมาด้วยตอน
 * แยก repo — แต่ mount ทั้งสองยังอยู่ · ไม่มีอะไรในขั้นตอน deploy จับได้เลย เพราะ
 * แอปขึ้นปกติ
 *
 * require.resolve ตอน mount ทำให้ความผิดพลาดชนิดนี้ล้มตั้งแต่ boot ซึ่งเห็นทันที
 * ตอน deploy · การโหลดจริงยังขี้เกียจเหมือนเดิม
 */

'use strict';

const path = require('path');

describe('createLazyRouter ยืนยันโมดูลตั้งแต่ตอน mount', () => {
    /** ดึงตัวสร้างออกมาจากไฟล์จริง — ไม่ได้เขียนสำเนาไว้ในเทส */
    function loadFactory() {
        const fs = require('fs');
        const file = path.join(__dirname, '..', '..', 'routes', 'api', 'provider', 'index.js');
        const src = fs.readFileSync(file, 'utf8');
        const start = src.indexOf('const createLazyRouter = (modulePath) => {');
        const end = src.indexOf('\n};', start) + 3;
        expect(start).toBeGreaterThan(-1);
        // shim ของ require ที่แปลพาธสัมพัทธ์จากมุมของ provider/index.js เอง
        // ต้องมี .resolve ด้วย เพราะนั่นคือสิ่งที่ตัวสร้างเรียกใช้
        const dir = path.dirname(file);
        const shim = (p) => require(p.startsWith('.') ? path.join(dir, p) : p);
        shim.resolve = (p) => require.resolve(p.startsWith('.') ? path.join(dir, p) : p);
        // eslint-disable-next-line no-eval
        return eval(`(function(require){${src.slice(start, end)} return createLazyRouter;})`)(shim);
    }

    it('โมดูลที่ไม่มีอยู่ ล้มทันทีตอนเรียก createLazyRouter', () => {
        const createLazyRouter = loadFactory();
        expect(() => createLazyRouter('./a-module-that-does-not-exist')).toThrow(/Cannot find module/);
    });

    it('โมดูลที่มีอยู่ ยังไม่ถูกโหลดจนกว่าจะมีคนเรียก', () => {
        const createLazyRouter = loadFactory();
        const handler = createLazyRouter('path');
        expect(typeof handler).toBe('function');
    });
});

describe('ทุก mount ในไฟล์จริงชี้ไปหาโมดูลที่มีอยู่', () => {
    it('ไม่มี mount ค้างที่ชี้ไปหาไฟล์ที่ถูกลบไปแล้ว', () => {
        const fs = require('fs');
        const dir = path.join(__dirname, '..', '..', 'routes', 'api', 'provider');
        const src = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
        const missing = [];
        for (const m of src.matchAll(/createLazyRouter\(\s*'(\.[^']+)'\s*\)/g)) {
            const target = path.join(dir, m[1]);
            if (!fs.existsSync(`${target}.js`) && !fs.existsSync(target)) {
                missing.push(m[1]);
            }
        }
        expect(missing).toEqual([]);
    });
});

describe('ไม่มีเส้นทางที่ลงทะเบียนไว้เพื่อบอกว่าตัวเองไม่มี', () => {
    it('provider/index.js ไม่มี handler ที่ตอบ 404 อย่างเดียว', () => {
        const fs = require('fs');
        const src = fs.readFileSync(
            path.join(__dirname, '..', '..', 'routes', 'api', 'provider', 'index.js'),
            'utf8',
        );
        // เส้นทางแบบนั้นทำให้ Allow โกหก: DELETE ได้ 405 Allow: GET แล้ว GET ได้ 404
        // (ชนิดเดียวกับ evidence/step2-api/REPORT.md API-01)
        expect(src).not.toMatch(/router\.(get|post|put|patch|delete)\([^)]*\)\s*=>\s*\{\s*res\.status\(404\)/);
        expect(src).not.toMatch(/Legacy provider route is disabled/);
    });
});
