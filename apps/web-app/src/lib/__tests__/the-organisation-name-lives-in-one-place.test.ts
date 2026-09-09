/**
 * หน้าจอที่แสดง "ตัวตนของหน่วยงาน" ต้องอ่านจากที่เดียว
 *
 * lib/organization-identity.ts อ่านค่าจาก NEXT_PUBLIC_ORG_* เพื่อให้ลูกค้าที่นำ
 * GACP Lite ไปติดตั้งเปลี่ยนเป็นชื่อ ที่อยู่ เบอร์ และเว็บไซต์ของหน่วยงานตัวเองได้ ·
 * ค่าเริ่มต้นเป็นของกรมการแพทย์แผนไทยฯ ตามที่ระบบนี้ถูกสร้างขึ้นมาให้
 *
 * วัดจริง 2026-09-09: ชื่อหน่วยงานถูกพิมพ์ตรง ๆ ไว้ 39 จุดใน 27 ไฟล์ · หน้า verify
 * ที่ประชาชนเปิดดูใบรับรอง หน้าสมัครสำเร็จ ป้าย alt ของตราหน่วยงาน หัวเอกสาร กทล.1
 * และ footer ทุกหน้า ล้วนพิมพ์ชื่อไว้เอง ไม่ได้อ่านจาก config · ลูกค้าที่ตั้ง
 * NEXT_PUBLIC_ORG_NAME จึงจะเห็นชื่อหน่วยงานตัวเองบางหน้า และชื่อกรมฯ บางหน้า
 *
 * เทสนี้เฝ้าเฉพาะจุดที่เป็น "ตัวตน/แบรนด์" — ไม่ได้เฝ้าข้อความกฎหมาย
 * (เงื่อนไขการใช้บริการ นโยบายความเป็นส่วนตัว การอ้างประกาศฉบับจริง) ซึ่งจงใจปล่อยไว้
 * เพราะการเปลี่ยนชื่อในนั้นให้ถูกต้องเป็นงานของฝ่ายกฎหมายลูกค้า ไม่ใช่การแทนตัวแปร
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');

/** ชื่อที่ต้องไม่ถูกพิมพ์ซ้ำในไฟล์เหล่านี้ */
const LITERAL_NAME = 'กรมการแพทย์แผนไทยและการแพทย์ทางเลือก';

/** ไฟล์ที่แสดงตัวตนของหน่วยงาน และถูกแก้ให้อ่านจาก ORGANIZATION แล้ว */
const BRAND_SURFACES = [
  'lib/i18n/dictionaries/sections/th-core.ts',
  'lib/i18n/dictionaries/sections/th-footer.ts',
  'lib/i18n/dictionaries/sections/th-provider.ts',
  'app/(public)/verify/[cert-number]/page.tsx',
  'app/(public)/verify/[cert-number]/revision/[n]/page.tsx',
  'app/(auth)/register/success/page.tsx',
  'app/auth/_components/login-chooser.tsx',
  'app/auth/_components/health-login-page.tsx',
  'app/help/contact/page.tsx',
  'app/terms/page.tsx',
  'app/privacy/page.tsx',
  'app/provider/scheduler/queue/client-view.tsx',
  'components/application/application-document-view.tsx',
];

describe('ตัวตนของหน่วยงานมาจาก lib/organization-identity เท่านั้น', () => {
  it.each(BRAND_SURFACES)('%s ไม่พิมพ์ชื่อหน่วยงานเอง', (rel) => {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    expect(src).not.toContain(LITERAL_NAME);
  });

  it.each(BRAND_SURFACES)('%s อ่านจากแหล่งเดียว', (rel) => {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    expect(src).toMatch(/ORGANIZATION|MINISTRY_CONTACT/);
  });
});

describe('แหล่งเดียวนั้นอ่านค่าจาก env ได้จริง', () => {
  it('ทุกฟิลด์ของ ORGANIZATION ผูกกับตัวแปร NEXT_PUBLIC_ORG_*', () => {
    const src = fs.readFileSync(path.join(SRC, 'lib', 'organization-identity.ts'), 'utf8');
    for (const key of ['NAME', 'PHONE', 'EMAIL', 'ADDRESS', 'WEBSITE']) {
      expect(src).toContain(`NEXT_PUBLIC_ORG_${key}`);
    }
  });

  it('ค่าเริ่มต้นยังเป็นของกรมฯ — ไม่มีใครเสียชื่อหน่วยงานไปเพราะการแก้นี้', () => {
    const src = fs.readFileSync(path.join(SRC, 'lib', 'organization-identity.ts'), 'utf8');
    expect(src).toContain(LITERAL_NAME);
  });
});
