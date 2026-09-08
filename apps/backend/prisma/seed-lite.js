/**
 * ข้อมูลตั้งต้นที่ระบบต้องมีจึงจะทำงานได้ — ไม่ใช่ข้อมูลตัวอย่าง
 *
 * รันครั้งเดียวหลัง `prisma migrate deploy` และรันซ้ำได้ (ทุกอย่างเป็น upsert)
 *
 * มีสองอย่างเท่านั้น:
 *   1. หน่วยงานเจ้าของระบบ — โค้ดทั้งระบบสมมติว่าทุกแถวมีเจ้าของ (organizationId)
 *      GACP Lite ให้บริการหน่วยงานเดียว ตารางนี้จึงมีแถวเดียวตลอดไป
 *      ดูเหตุผลเต็มที่ prisma/schema/tenancy.prisma
 *   2. บัญชีผู้ดูแลระบบคนแรก — เพราะเจ้าหน้าที่ถูกสร้างโดยผู้ดูแล ไม่ได้สมัครเอง
 *      ถ้าไม่มีคนแรก ก็ไม่มีใครสร้างใครได้เลย
 *
 * รหัสผ่านผู้ดูแลมาจาก ADMIN_INITIAL_PASSWORD · ไม่มีค่าเริ่มต้นโดยตั้งใจ — ระบบราชการ
 * ที่มีรหัสผ่านผู้ดูแลเหมือนกันทุกที่ติดตั้ง คือช่องโหว่ที่รอวันถูกใช้
 */

'use strict';

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ORG = {
    slug: 'default',
    code: 'GACP_LITE',
    name: process.env.ORGANIZATION_NAME || 'หน่วยงานรับรองมาตรฐาน GACP',
    type: 'GOVERNMENT',
};

async function seedOrganization() {
    const org = await prisma.organization.upsert({
        where: { slug: ORG.slug },
        update: { name: ORG.name },
        create: ORG,
    });
    console.log(`[seed] หน่วยงาน: ${org.name} (${org.slug})`);
    return org;
}

async function seedInitialAdmin(organizationId) {
    const identifier = process.env.ADMIN_IDENTIFIER;
    const password = process.env.ADMIN_INITIAL_PASSWORD;

    if (!identifier || !password) {
        console.log('[seed] ข้ามการสร้างผู้ดูแล — ยังไม่ได้ตั้ง ADMIN_IDENTIFIER + ADMIN_INITIAL_PASSWORD');
        console.log('[seed] ตั้งสองค่านี้แล้วรัน `pnpm db:seed` อีกครั้งเมื่อพร้อม');
        return null;
    }
    if (password.length < 12) {
        throw new Error('[seed] ADMIN_INITIAL_PASSWORD ต้องยาวอย่างน้อย 12 ตัวอักษร');
    }

    const existing = await prisma.user.findFirst({ where: { canonicalId: identifier } });
    if (existing) {
        console.log('[seed] มีผู้ดูแลอยู่แล้ว — ไม่เขียนทับรหัสผ่านของบัญชีที่ใช้งานอยู่');
        return existing;
    }

    const admin = await prisma.user.create({
        data: {
            organizationId,
            canonicalId: identifier,
            providerId: identifier,
            password: await bcrypt.hash(password, 12),
            firstName: 'ผู้ดูแล',
            lastName: 'ระบบ',
            role: 'admin',
            status: 'ACTIVE',
        },
    });
    console.log('[seed] สร้างผู้ดูแลระบบคนแรกแล้ว — เปลี่ยนรหัสผ่านทันทีหลังเข้าใช้ครั้งแรก');
    return admin;
}

async function main() {
    const org = await seedOrganization();
    await seedInitialAdmin(org.id);
}

main()
    .catch((error) => {
        console.error('[seed] ล้มเหลว:', error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
