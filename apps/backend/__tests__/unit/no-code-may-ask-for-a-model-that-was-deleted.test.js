/**
 * โค้ดที่ยังถามหาโมเดลที่ถูกลบไปแล้ว = 500 ที่รอเกิดในประตูที่ไปถึงมัน
 *
 * ตอนแยก GACP Lite ออกมา โมเดลหลายตัวถูกตัดออกจากสคีมา (Invoice, Payment,
 * PlantingCycle, Ticket, SOPDocument, ตระกูล Trace ฯลฯ) แต่โค้ดที่เรียกใช้มันไม่ได้
 * ถูกตามไปแก้ทุกที่ · `prisma.invoice` จึงเป็น undefined และบรรทัดที่เรียก .findMany
 * บนนั้นโยน TypeError ตอนมีคนกดปุ่ม ไม่ใช่ตอน deploy
 *
 * วัดจริง 2026-09-09 บนระบบที่รันอยู่:
 *
 *   GET /api/auth/health/me/export  ->  500
 *   log: TypeError: Cannot read properties of undefined (reading 'findMany')
 *        at assembleUserDataExport (services/pdpa-service.js:182)
 *
 * ประตูนั้นคือสิทธิ์ตาม PDPA ม.30 — ขอเข้าถึงและขอรับสำเนาข้อมูลของตนเอง · เจ้าของ
 * ข้อมูลกดแล้วได้ 500 ทุกครั้ง และไม่มีอะไรบอกใครว่ามันพัง
 *
 * เทสนี้ไม่ได้เฝ้าประตูเดียว — มันเดินกราฟ require จาก server.js (รวมทางที่
 * createLazyRouter โหลดด้วยสตริง ซึ่งตัววิเคราะห์ static มองไม่เห็น) แล้วยืนยันว่า
 * `prisma.<model>` ทุกตัวที่โค้ดซึ่งเข้าถึงได้เรียกใช้ มีอยู่จริงบน PrismaClient
 *
 * ไฟล์ที่ server.js เข้าไม่ถึงจะไม่ถูกตรวจ — ของค้างในนั้นเป็นเรื่องของ Step 5
 * (รายการเต็มอยู่ใน evidence/step3-refactor/REPORT.md REF-06)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { PrismaClient } = require('@prisma/client');

const ROOT = path.join(__dirname, '..', '..');

/** ไฟล์ทั้งหมดที่ server.js ไปถึงได้ */
function reachableFiles() {
    const seen = new Set();
    const visit = (file) => {
        let real;
        try { real = require.resolve(file); } catch { return; }
        if (seen.has(real) || real.includes('node_modules')) { return; }
        seen.add(real);
        let src;
        try { src = fs.readFileSync(real, 'utf8'); } catch { return; }
        const patterns = [
            /require\(\s*['"](\.[^'"]+)['"]\s*\)/g,
            // require ที่เกิดตอนรัน — routes/api/provider/index.js mount ด้วยวิธีนี้
            /createLazyRouter\(\s*['"](\.[^'"]+)['"]\s*\)/g,
        ];
        for (const pattern of patterns) {
            for (const m of src.matchAll(pattern)) {
                visit(path.resolve(path.dirname(real), m[1]));
            }
        }
    };
    visit(path.join(ROOT, 'server.js'));
    return [...seen];
}

const MODEL_CALL = /prisma\.([a-zA-Z][a-zA-Z0-9]*)\.(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|count|create|createMany|update|updateMany|upsert|delete|deleteMany|aggregate|groupBy)\b/g;

/**
 * ลอกคอมเมนต์ออกก่อนตรวจ
 *
 * รอบแรกผมไม่ได้ลอก แล้วเทสฟ้อง workflow-handler-deps.js กับ admin-dashboard-handler.js
 * ทั้งที่สองไฟล์นั้นแก้ไปแล้ว — สิ่งที่ตรงกับ regex คือคอมเมนต์ที่เขียนว่า "แทนที่
 * prisma.invoice.findMany เดิม" · เทสที่ฟ้องผิดก็เชื่อไม่ได้พอ ๆ กับเทสที่ฟ้องไม่ได้
 *
 * ตัดง่าย ๆ พอ: ตัดสตริงออกก่อน แล้วค่อยตัด // และ block comment
 */
function stripComments(src) {
    return src
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
}

/**
 * หนี้ที่รู้ตัวแล้ว — ลดได้อย่างเดียว ห้ามเพิ่ม
 *
 * โมเดล AssignmentLedgerEntry ("งานนี้พาสไปที่ใคร") ถูกตัดออกตอนแยก Lite แต่ฟีเจอร์
 * ยังถูกเรียกจากห้าที่ที่ยังใช้งานอยู่: มอบหมายผู้ตรวจเอกสาร · เปลี่ยนผู้ตรวจเอกสาร ·
 * เปลี่ยนผู้ตรวจแปลง · มอบหมายเป็นชุดจากหน้าผู้ดูแล · และ API อ่าน /api/provider/ledger
 *
 * การเขียนถูกกลืน error ไว้ ("Never break the assignment on a ledger failure" —
 * assignment-ledger-service.js) ผลจึงไม่ใช่ 500 แต่เป็น **ทุกการมอบหมายไม่ถูกบันทึก
 * เลย ตั้งแต่วันแรกของ Lite** และหน้าอ่าน ledger ก็จะว่างเปล่าตลอด
 *
 * ทางเลือกสองทาง ต้องให้ operator ตัดสิน (evidence/step3-refactor/REPORT.md REF-07):
 *   1. เอาโมเดลกลับเข้าสคีมา — เป็น migration จึงต้องผ่าน operator
 *   2. ย้ายการบันทึกไปที่ AuditLog ซึ่งอยู่ในรายการ RETAIN ของสเปก Lite อยู่แล้ว
 *      แต่ต้องเขียน query service ใหม่ทั้งตัว (count / findMany / groupBy คนละรูป)
 *
 * ผมไม่เลือกให้ เพราะทั้งสองทางเปลี่ยนความหมายของข้อมูล ไม่ใช่แค่ย้ายโค้ด
 */
const KNOWN_DEBT = [
    'services/assignment-ledger-service.js -> prisma.assignmentLedgerEntry.create',
    'services/assignment-ledger-query-service.js -> prisma.assignmentLedgerEntry.count',
    'services/assignment-ledger-query-service.js -> prisma.assignmentLedgerEntry.findMany',
    'services/assignment-ledger-query-service.js -> prisma.assignmentLedgerEntry.groupBy',
];

describe('ทุกโมเดลที่โค้ดซึ่งเข้าถึงได้เรียกใช้ มีอยู่จริง', () => {
    let client;
    let files;

    beforeAll(() => {
        client = new PrismaClient();
        files = reachableFiles();
    });

    afterAll(async () => {
        if (client) { await client.$disconnect(); }
    });

    it('เดินกราฟจาก server.js ได้จริง (กันเทสที่ผ่านเพราะไม่ได้ตรวจอะไรเลย)', () => {
        expect(files.length).toBeGreaterThan(200);
        expect(files.some((f) => f.endsWith(path.join('routes', 'api', 'index.js')))).toBe(true);
        // ไฟล์ที่ mount ด้วย createLazyRouter ต้องอยู่ในกราฟด้วย ไม่งั้นการตรวจนี้ตาบอด
        // ครึ่งหนึ่งของฝั่งเจ้าหน้าที่
        expect(files.some((f) => f.endsWith(path.join('provider', 'document-reviews.js')))).toBe(true);
    });

    it('ไม่มี prisma.<model> ที่ไม่มีอยู่ในสคีมา นอกจากเส้นฐานที่บันทึกไว้', () => {
        const dangling = [];
        for (const file of files) {
            const src = stripComments(fs.readFileSync(file, 'utf8'));
            for (const m of src.matchAll(MODEL_CALL)) {
                const model = m[1];
                if (client[model] === undefined) {
                    dangling.push(`${path.relative(ROOT, file)} -> prisma.${model}.${m[2]}`);
                }
            }
        }
        expect([...new Set(dangling)].sort()).toEqual([...KNOWN_DEBT].sort());
    });

    it('เส้นฐานลดได้อย่างเดียว — ของที่แก้แล้วต้องถูกลบออกจากรายการ', () => {
        // ถ้าหนี้ตัวไหนถูกจ่ายแล้วแต่ยังอยู่ในรายการ เทสนี้จะฟ้อง ทำให้รายการไม่ค้าง
        // เป็นเอกสารเก่าที่ไม่ตรงกับความจริง
        const stillPresent = new Set();
        for (const file of files) {
            const src = stripComments(fs.readFileSync(file, 'utf8'));
            for (const m of src.matchAll(MODEL_CALL)) {
                stillPresent.add(`${path.relative(ROOT, file)} -> prisma.${m[1]}.${m[2]}`);
            }
        }
        const paidOff = KNOWN_DEBT.filter((entry) => !stillPresent.has(entry));
        expect(paidOff).toEqual([]);
    });
});
