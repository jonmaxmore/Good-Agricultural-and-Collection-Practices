/**
 * ทุกตำแหน่งงานต้องลงบนหน้าที่ "มีอยู่จริง" ไม่ใช่แค่ "มีสิทธิ์เข้า"
 *
 * เทสเดิมของระบบเต็ม (landing-route-coherence) ถามว่า landing ∈ เส้นทางที่ role นี้
 * เข้าได้ไหม — ซึ่งเป็นคำถามเรื่องสิทธิ์ ไม่ใช่เรื่องการมีอยู่ · ตอนตัดระบบเป็น Lite
 * หน้าจอถูกลบไปหลายหน้า แต่ตาราง landing ยังชี้ไปที่เดิม ผลคือ:
 *
 *   scheduler      -> /provider/coordinator     หน้าถูกลบ  -> ล็อกอินแล้วเจอ 404
 *   platform_admin -> /admin/organizations      หน้าถูกลบ  -> ล็อกอินแล้วเจอ 404
 *
 * ทั้งสองผ่านเทสเดิมสบาย ๆ เพราะกติกาสิทธิ์ยังประกาศเส้นทางนั้นไว้ · เทสนี้อ่าน
 * ระบบไฟล์จริงแทน จึงตอบคำถามที่เทสเดิมตอบไม่ได้
 */

import fs from 'fs';
import path from 'path';
import { PROVIDER_LANDING } from '@/lib/provider-role-config';

const APP_DIR = path.join(process.cwd(), 'src', 'app');

/** Next แม็ป /a/b เป็น src/app/a/b/page.tsx — และรองรับ route group (folder) ด้วย */
function pageExists(route: string): boolean {
    const direct = path.join(APP_DIR, route, 'page.tsx');
    if (fs.existsSync(direct)) { return true; }
    // route group: /login อาจอยู่ที่ src/app/(auth)/login/page.tsx
    const [, first, ...rest] = route.split('/');
    for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^\(.*\)$/.test(entry.name)) { continue; }
        if (fs.existsSync(path.join(APP_DIR, entry.name, first, ...rest, 'page.tsx'))) { return true; }
    }
    return false;
}

describe('landing ของทุกตำแหน่งชี้ไปหน้าที่มีอยู่จริง', () => {
    const entries = PROVIDER_LANDING.flatMap((e) => e.roles.map((role) => ({ role, path: e.path })));

    it('มี landing ให้ตรวจ (ถ้าลิสต์ว่าง เทสนี้ไม่ได้เฝ้าอะไรเลย)', () => {
        expect(entries.length).toBeGreaterThan(0);
    });

    it.each(entries.map((e) => [e.role, e.path]))('%s -> %s', (_role, route) => {
        expect(pageExists(route as string)).toBe(true);
    });
});
