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

const crypto = require('crypto');
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

/**
 * บัญชีผู้ดูแลคนแรก
 *
 * ต้องเขียนสี่อย่างให้ครบ ไม่ใช่แค่ role — ประตูล็อกอินของเจ้าหน้าที่
 * (routes/api/auth/auth-provider.js) ค้นด้วย **providerIdHash** ไม่ใช่ providerId
 * และปฏิเสธบัญชีที่ accountType ไม่ใช่ PROVIDER · seed รุ่นแรกเขียนแค่ role กับ
 * password ผลคือสร้างผู้ดูแลได้แต่ล็อกอินไม่ได้ ซึ่งแปลว่าระบบที่ติดตั้งเสร็จแล้ว
 * ไม่มีใครเข้าได้เลย · เทสที่กันไม่ให้เกิดซ้ำอยู่ที่ท้ายไฟล์นี้ (verifyCanLogIn)
 */
async function seedInitialAdmin(organizationId) {
    const identifier = String(process.env.ADMIN_IDENTIFIER || '').replace(/\D/g, '');
    const password = process.env.ADMIN_INITIAL_PASSWORD;

    if (!identifier || !password) {
        console.log('[seed] ข้ามการสร้างผู้ดูแล — ยังไม่ได้ตั้ง ADMIN_IDENTIFIER + ADMIN_INITIAL_PASSWORD');
        console.log('[seed] ตั้งสองค่านี้แล้วรัน `pnpm db:seed` อีกครั้งเมื่อพร้อม');
        return null;
    }
    if (identifier.length !== 13) {
        throw new Error('[seed] ADMIN_IDENTIFIER ต้องเป็นเลขบัตรประชาชน 13 หลัก');
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
            // คอลัมน์ที่ประตูล็อกอินค้นจริง — ไม่มีค่านี้ = บัญชีมีอยู่แต่หาไม่เจอ
            providerIdHash: crypto.createHash('sha256').update(identifier).digest('hex'),
            // ประตูเจ้าหน้าที่ปฏิเสธทุกบัญชีที่ไม่ใช่ PROVIDER
            accountType: 'PROVIDER',
            authType: 'PROVIDER_ID',
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

/**
 * ตรวจว่าบัญชีที่เพิ่งสร้าง "ล็อกอินได้จริง" ไม่ใช่แค่ "มีอยู่ในตาราง"
 *
 * เทียบด้วยเงื่อนไขเดียวกับที่ประตูล็อกอินใช้ ถ้าวันหนึ่งประตูเปลี่ยนคอลัมน์ค้นหา
 * seed จะดังตรงนี้แทนที่จะเงียบแล้วปล่อยให้ลูกค้าไปเจอเอง
 */
async function verifyCanLogIn(user) {
    if (!user) { return; }
    const found = await prisma.user.findFirst({
        where: {
            providerIdHash: crypto.createHash('sha256').update(user.canonicalId).digest('hex'),
            status: 'ACTIVE',
        },
        select: { id: true, accountType: true },
    });
    if (!found) {
        throw new Error('[seed] บัญชีผู้ดูแลถูกสร้างแล้วแต่ประตูล็อกอินหาไม่เจอ — '
            + 'ตรวจ providerIdHash ใน seed ให้ตรงกับ routes/api/auth/auth-provider.js');
    }
    if (String(found.accountType).toUpperCase() !== 'PROVIDER') {
        throw new Error('[seed] บัญชีผู้ดูแล accountType ไม่ใช่ PROVIDER — ประตูเจ้าหน้าที่จะปฏิเสธ');
    }
    console.log('[seed] ตรวจแล้ว: ผู้ดูแลล็อกอินได้จริง');
}

async function main() {
    const org = await seedOrganization();
    const admin = await seedInitialAdmin(org.id);
    await verifyCanLogIn(admin);
}

main()
    .catch((error) => {
        console.error('[seed] ล้มเหลว:', error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
