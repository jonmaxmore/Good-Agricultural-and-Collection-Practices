/**
 * ข้อมูลติดต่อของหน่วยงานต้องมาจาก config ไม่ใช่จากการพิมพ์ไว้ในหน้าจอ
 *
 * GACP Lite ถูกส่งให้ลูกค้าเอาไปติดตั้งบนโดเมนของตัวเอง · ก่อนหน้านี้ชื่อกรมฯ
 * เบอร์ 0-2591-7007 และ contact@gacpth.com ถูกพิมพ์ไว้ในโค้ด 77 จุด ผลคือระบบของ
 * ลูกค้าบอกผู้ใช้ของลูกค้าให้ติดต่อหน่วยงานอื่น
 *
 * เทสนี้เฝ้าเฉพาะ "ชั้นที่แก้แล้ว" — โมดูลกลางสองตัวที่ทุกที่ควรอ่านผ่าน
 * ไม่ได้เฝ้าทั้ง repo เพราะยังมีหน้า marketing/help ที่พิมพ์เอง (บันทึกไว้ใน
 * evidence/step2-hardcode/REPORT.md ว่าเหลืออะไร)
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CENTRAL = [
  'src/lib/organization-identity.ts',
  'src/lib/ministry-contact.ts',
];

/** ค่าที่เป็นของหน่วยงานต้นทาง — ต้องปรากฏได้เฉพาะเป็น default ในโมดูล identity */
const FOREIGN = ['0-2591-7007', 'contact@gacpth.com'];

describe('โมดูลกลางอ่านค่าจาก config ไม่ใช่พิมพ์ไว้', () => {
  /** ตัดคอมเมนต์ออกก่อนตรวจ — ตัวอย่างรูปแบบเบอร์ในคอมเมนต์ไม่ใช่ค่าที่ระบบใช้ */
  const codeOnly = (file: string) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('ministry-contact ไม่พิมพ์ค่าไว้เอง — มันอ่านจาก organization-identity', () => {
    const src = codeOnly('src/lib/ministry-contact.ts');
    for (const value of FOREIGN) {
      expect({ value, foundInMinistryContact: src.includes(value) })
        .toEqual({ value, foundInMinistryContact: false });
    }
    expect(src).toContain('organization-identity');
  });

  it('organization-identity อ่าน env ทุกฟิลด์', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/organization-identity.ts'), 'utf8');
    for (const key of ['ORG_NAME', 'ORG_PHONE', 'ORG_EMAIL', 'ORG_ADDRESS', 'ORG_WEBSITE']) {
      expect({ key, readsEnv: src.includes(`NEXT_PUBLIC_${key}`) })
        .toEqual({ key, readsEnv: true });
    }
  });

  it('โมดูลกลางทั้งสองมีอยู่จริง (ถ้าถูกลบ เทสนี้จะไม่ได้เฝ้าอะไรเลย)', () => {
    for (const f of CENTRAL) {
      expect({ f, exists: fs.existsSync(path.join(ROOT, f)) }).toEqual({ f, exists: true });
    }
  });
});
