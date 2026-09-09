const express = require('express');

const router = express.Router();

/**
 * โหลด router ตอนมีคนเรียกครั้งแรก แต่ **ยืนยันว่าโมดูลมีอยู่จริงตั้งแต่ตอน mount**
 *
 * เดิม require เกิดตอนมีคนยิงเข้ามาเท่านั้น · โมดูลที่หายไปจึงไม่ทำให้ boot ล้ม
 * แต่ไปโผล่เป็น 500 ในหน้าผู้ใช้ · วัดจริง 2026-09-09 บนระบบที่รันอยู่:
 *
 *   GET /api/provider/planting-cycles  -> 500 MODULE_NOT_FOUND  (./planting ถูกลบ
 *                                         ตอนตัด T&T ออก แต่ mount ยังอยู่)
 *   GET /api/provider/waiver-reopen    -> 500 MODULE_NOT_FOUND
 *
 * require.resolve ที่นี่ทำให้ mount ที่ชี้ไปหาโมดูลที่ไม่มี ล้มตั้งแต่ตอน boot ซึ่ง
 * เห็นตอน deploy · ส่วนการโหลดจริงยังขี้เกียจเหมือนเดิม ไม่ได้เพิ่มต้นทุน boot
 */
const createLazyRouter = (modulePath) => {
    // ล้มที่นี่ = ล้มตอน boot · ล้มตอน require ข้างล่าง = ล้มใส่หน้าผู้ใช้
    require.resolve(modulePath);
    let resolvedRouter = null;
    return (req, res, next) => {
        if (!resolvedRouter) {
            resolvedRouter = require(modulePath);
        }
        return resolvedRouter(req, res, next);
    };
};

// Canonical provider namespaces (resource-oriented, kebab-case path policy)
router.use('/reviewer', createLazyRouter('./reviewer'));
router.use('/scheduler', createLazyRouter('./scheduler'));
router.use('/auditor', createLazyRouter('./auditor'));
// Legacy: redirect /head-auditor/* to /auditor/* (role merged)
router.use('/head-auditor', createLazyRouter('./auditor'));
// กทล.๑ ส่วน จนท. ข้อ ๑.๑ — per-slot document verdicts. Mounted BEFORE the
// generic /applications router so its specific paths match first.
router.use('/applications', createLazyRouter('./document-reviews'));
router.use('/applications', createLazyRouter('./applications'));
// ADR-016 Phase 1C/1D — work-queue admin surfaces (admin-only).
// Mounted BEFORE /admin so the more-specific paths match first.
router.use('/admin/user-groups', createLazyRouter('./admin-user-groups'));
router.use('/admin/work-config', createLazyRouter('./admin-work-config'));
router.use('/admin', createLazyRouter('./admin'));
router.use('/certificates', createLazyRouter('./certificates'));
// /waiver-reopen: โมดูล ./waiver-reopen ไม่ได้ถูกนำมาด้วยตอนแยก Lite ออกมา
// mount ที่ค้างไว้ตอบ 500 · ถ้าจะเอาฟีเจอร์นี้กลับ ต้องเอาไฟล์กลับมาก่อน
// ADR-016 Phase 4 — work-queue KPI roll-up (admin + scheduler).
// Mounted BEFORE /analytics so the more-specific path matches first.
router.use('/analytics/work-kpis', createLazyRouter('./analytics-work-kpis'));
router.use('/analytics', createLazyRouter('./analytics'));
// /planting-cycles ถูกถอดออกพร้อมกับการตัด T&T ออกจาก Lite — โมดูล ./planting
// ไม่มีอยู่แล้ว mount ที่ค้างไว้ตอบ 500 ให้ทุกคนที่ยิงเข้ามา
router.use('/reports', createLazyRouter('./reports'));
// ADR-016 Phase 1A — unified work queue (BPMN-aligned)
router.use('/work', createLazyRouter('./work'));
// Work-distribution ledger read API (Phase 1C) — who-assigned-whom queries
// (workload / fairness / timeline / reassignments). ADMIN + SCHEDULER only.
router.use('/ledger', createLazyRouter('./ledger'));

// /stats เคยเป็นเส้นทางที่ลงทะเบียนไว้เพื่อตอบ 404 · ผลคือ DELETE /api/provider/stats
// ได้ 405 Allow: GET แล้ว GET ก็ได้ 404 — คำตอบที่ขัดกันเอง แบบเดียวกับข้อบกพร่อง
// ของ mountPathOf (evidence/step2-api/REPORT.md API-01) · ไม่ลงทะเบียนเลย ตัวจับ
// ที่ท้าย /api จะตอบ 404 ให้ทุกวิธีอย่างสม่ำเสมอ

module.exports = router;
