/**
 * ตำแหน่งงานทั้งหมดของ GACP Lite ฝั่งหน้าจอ — ต้องตรงกับ apps/backend/shared/canonical-rbac.js
 *
 * หนึ่งตำแหน่งมีชื่อเดียว · ไม่มีชื่อสำรอง ไม่มีชื่อที่แปลไปเป็นตำแหน่งอื่น
 * เหตุผลเต็มอยู่ในหัวไฟล์ฝั่ง backend
 */

export const CANONICAL_ROLES = {
    HEALTH: 'health',
    ACCOUNT: 'account',
    SCHEDULER: 'scheduler',
    DOCUMENT_REVIEWER: 'document_reviewer',
    AUDITOR: 'auditor',
    ADMIN: 'admin',
    // Lite มีหน่วยงานเดียว ตำแหน่งนี้จึงเท่ากับ ADMIN — คงชื่อไว้เพราะ middleware
    // และ route ฝั่ง backend อ้างถึง ถ้า normalizeRole คืน null มันจะถูกล็อกออก
    PLATFORM_ADMIN: 'platform_admin',
    // ผู้กระทำที่ไม่ใช่คน (cron) · หน้าจอไม่เคยตั้งค่านี้ให้ใคร แต่ต้องแปลออก เพราะมัน
    // โผล่ในบันทึกตรวจสอบเป็น actorRole — ถ้าแปลไม่ออก แถวนั้นจะแสดงเป็นค่าว่าง
    SYSTEM: 'system',
} as const;

export type CanonicalRole = typeof CANONICAL_ROLES[keyof typeof CANONICAL_ROLES];

export const ROLE_ALIASES: Record<string, CanonicalRole> = {
    admin: 'admin',
    platform_admin: 'platform_admin',
    account: 'account',
    scheduler: 'scheduler',
    document_reviewer: 'document_reviewer',
    auditor: 'auditor',
    health: 'health',
    system: 'system',
};

export function normalizeRole(role: string | null | undefined): CanonicalRole | null {
    const key = String(role || '').trim().toLowerCase();
    return key ? (ROLE_ALIASES[key] ?? null) : null;
}

export const PROVIDER_ROLES = new Set<CanonicalRole>([
    CANONICAL_ROLES.ADMIN,
    CANONICAL_ROLES.PLATFORM_ADMIN,
    CANONICAL_ROLES.ACCOUNT,
    CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.DOCUMENT_REVIEWER,
    CANONICAL_ROLES.AUDITOR,
]);


export function isProviderRole(role: string | null | undefined): boolean {
    const canonical = normalizeRole(role);
    return canonical ? PROVIDER_ROLES.has(canonical) : false;
}
