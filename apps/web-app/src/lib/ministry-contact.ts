/**
 * ข้อมูลติดต่อของหน่วยงาน — ตอนนี้อ่านจาก config ที่ตั้งค่าได้ ไม่ใช่ค่าคงที่
 *
 * ชื่อ `MINISTRY_CONTACT` ยังอยู่เพราะมี 5 หน้าจอเรียกใช้ แต่ค่าไม่ได้พิมพ์ไว้ที่นี่แล้ว
 * มันมาจาก @/lib/organization-identity ซึ่งอ่าน NEXT_PUBLIC_ORG_* · เหตุผลเต็มอยู่ที่นั่น
 *
 * สรุปสั้น: GACP Lite ถูกส่งให้ลูกค้าเอาไปติดตั้ง · ค่าที่พิมพ์ไว้ตายตัวทำให้ระบบของ
 * ลูกค้าบอกผู้ใช้ของลูกค้าให้ติดต่อหน่วยงานอื่น
 */

import { ORGANIZATION } from '@/lib/organization-identity';

export const MINISTRY_CONTACT = Object.freeze({
  phone: ORGANIZATION.phone,
  email: ORGANIZATION.email,
  ministry: ORGANIZATION.name,
  ministryEn: ORGANIZATION.nameEn,
  address: ORGANIZATION.address,
  website: ORGANIZATION.website,
} as const);

export type MinistryContact = typeof MINISTRY_CONTACT;

/**
 * Build a tel: URL from the dashed local format we render in the UI.
 * `0-2591-7007` → `tel:+6625917007`.
 */
export function ministryTelHref(): string {
  const digitsOnly = MINISTRY_CONTACT.phone.replace(/\D/g, '');
  // Drop leading 0 and prepend +66 (Thailand country code).
  const national = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly;
  return `tel:+66${national}`;
}

export function ministryMailtoHref(): string {
  return `mailto:${MINISTRY_CONTACT.email}`;
}
