/**
 * ตัวตนของหน่วยงานที่ติดตั้งระบบนี้ — ฝั่งหน้าจอ
 *
 * ต้องตรงกับ apps/backend/shared/organization-identity.js · ที่นี่ใช้ NEXT_PUBLIC_*
 * เพราะค่าต้องไปถึงเบราว์เซอร์ · Next อ่านค่าเหล่านี้ตอน build ไม่ใช่ตอนรัน
 * ลูกค้าที่เปลี่ยนค่าต้อง build ใหม่ (compose ส่งเป็น build arg ให้แล้ว)
 *
 * ก่อนมีไฟล์นี้ ชื่อกรมฯ เบอร์ และอีเมลถูกพิมพ์ไว้ในหน้าจอ ~70 จุด — หน้าติดต่อ
 * หน้าช่วยเหลือ ท้ายหน้าทุกหน้า และเมทาดาทา · ระบบของลูกค้าจึงบอกผู้ใช้ของลูกค้า
 * ให้ติดต่อหน่วยงานอื่น
 */

const read = (value: string | undefined, fallback: string): string =>
  value && value.trim() ? value.trim() : fallback;

export const ORGANIZATION = {
  name: read(process.env.NEXT_PUBLIC_ORG_NAME, 'กรมการแพทย์แผนไทยและการแพทย์ทางเลือก'),
  nameEn: read(
    process.env.NEXT_PUBLIC_ORG_NAME_EN,
    'Department of Thai Traditional and Alternative Medicine, Ministry of Public Health',
  ),
  phone: read(process.env.NEXT_PUBLIC_ORG_PHONE, '0-2591-7007'),
  email: read(process.env.NEXT_PUBLIC_ORG_EMAIL, 'contact@gacpth.com'),
  address: read(
    process.env.NEXT_PUBLIC_ORG_ADDRESS,
    '88/23 หมู่ 4 ตำบลตลาดขวัญ อำเภอเมืองนนทบุรี จังหวัดนนทบุรี 11000',
  ),
  website: read(process.env.NEXT_PUBLIC_ORG_WEBSITE, 'https://dtam.moph.go.th'),
  /** ที่อยู่ที่ผู้ใช้เปิดระบบนี้จริง — ใช้กับ canonical URL, sitemap, OpenGraph */
  publicUrl: read(process.env.NEXT_PUBLIC_WEB_URL, 'http://localhost:3100'),
} as const;

/** บรรทัดติดต่อสำหรับท้ายหน้า/ท้ายเอกสาร — รูปแบบเดียวทุกที่ */
export const ORGANIZATION_CONTACT_LINE = `โทร: ${ORGANIZATION.phone} | อีเมล: ${ORGANIZATION.email}`;
