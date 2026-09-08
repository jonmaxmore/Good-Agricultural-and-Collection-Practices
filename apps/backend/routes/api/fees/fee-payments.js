/**
 * ค่าธรรมเนียม — เจ้าหน้าที่บันทึกว่ารับเงินแล้ว
 *
 * ระบบเต็มเก็บเงินเอง: ใบเสนอราคา → ใบแจ้งหนี้ → Stripe → webhook ที่ตรวจลายเซ็นแล้ว
 * เดินสถานะให้ · GACP Lite ไม่เก็บเงิน ลูกค้าเก็บด้วยช่องทางของตัวเอง (เงินสด โอน
 * ระบบการเงินของหน่วยงาน) แล้วเจ้าหน้าที่มาบันทึกที่นี่ — คำตัดสิน operator 2026-09-08
 *
 * สิ่งที่ประตูนี้ **ไม่ทำ** และไม่ควรถูกอ่านว่าทำ:
 *   - ไม่ตรวจสอบว่าเงินเข้าจริง · ไม่มีอะไรให้ตรวจ ระบบไม่ได้ต่อกับบัญชีใด
 *   - ไม่คำนวณราคาใหม่ · ราคามาจาก Application.phase1Amount / phase2Amount ที่คำนวณ
 *     ตอนยื่น จาก config/business-rules.js (แก้ได้ผ่าน SystemConfig ไม่ใช่ค่าคงที่ในโค้ด)
 *   - ไม่ออกใบเสร็จ · เอกสารการเงินเป็นของระบบบัญชีลูกค้า ไม่ใช่ของระบบนี้
 *
 * สิ่งที่มันทำคือบันทึกว่า **ใครเป็นผู้ยืนยัน เมื่อไร อ้างอิงอะไร** แล้วเดินสถานะคำขอ
 * หนึ่งก้าว · หนึ่งงวดยืนยันได้ครั้งเดียว (unique [applicationId, phase]) การกดซ้ำจึง
 * ไม่ทำให้สถานะเดินซ้ำ แม้จะมีสองแท็บกดพร้อมกัน
 */

const express = require('express');
const { prisma } = require('../../../services/prisma-database');
const { authenticateProvider, authenticateAny } = require('../../../middleware/auth-middleware');
const { sendSuccessResponse, sendErrorResponse } = require('../../../shared/api-response');
const { writeApplicationStatus } = require('../../../services/application-status-writer');
const { canRoleTransition } = require('../../../services/workflow-transition-service');
const { normalizeRole } = require('../../../shared/canonical-rbac');
const logger = require('../../../shared/logger');

const router = express.Router();

/**
 * งวดค่าธรรมเนียม → สถานะที่ต้องยืนอยู่ก่อน และสถานะปลายทาง
 * เป็นตารางเดียวที่ผูกคำว่า "งวด" กับ state machine ไว้ ไม่กระจายเป็น if
 */
const PHASES = Object.freeze({
    PHASE_1: {
        label: 'ค่าตรวจเอกสาร',
        from: 'PENDING_DOC_FEE',
        to: 'DOC_FEE_PAID',
        amountField: 'phase1Amount',
        statusField: 'phase1Status',
        paidAtField: 'phase1PaidAt',
    },
    PHASE_2: {
        label: 'ค่าตรวจแปลง',
        from: 'PENDING_AUDIT_FEE',
        to: 'AUDIT_FEE_PAID',
        amountField: 'phase2Amount',
        statusField: 'phase2Status',
        paidAtField: 'phase2PaidAt',
    },
});

/**
 * GET /api/fees/:applicationId — ค่าธรรมเนียมสองงวดของคำขอนี้ ยืนยันแล้วหรือยัง
 *
 * เจ้าหน้าที่อ่านได้ทุกใบ · ผู้ยื่นอ่านได้เฉพาะใบของตัวเอง — เพราะเขาต้องรู้ว่าต้องจ่าย
 * เท่าไรและระบบรับรู้แล้วหรือยัง ถ้าไม่เห็นก็ต้องโทรถาม ซึ่งเป็นภาระที่ระบบสร้างเอง
 */
router.get('/:applicationId', authenticateAny, async (req, res) => {
    try {
        const application = await prisma.application.findUnique({
            where: { id: req.params.applicationId },
            select: {
                id: true, applicationNumber: true, status: true, healthId: true,
                phase1Amount: true, phase1Status: true, phase1PaidAt: true,
                phase2Amount: true, phase2Status: true, phase2PaidAt: true,
                feePayments: {
                    select: {
                        id: true, phase: true, amountThb: true, externalReference: true,
                        note: true, confirmedAt: true,
                        confirmedBy: { select: { id: true, firstName: true, lastName: true } },
                    },
                    orderBy: { confirmedAt: 'asc' },
                },
            },
        });
        if (!application) {
            return sendErrorResponse(res, req, {
            status: 404,
            code: 'APPLICATION_NOT_FOUND',
            message: 'ไม่พบคำขอนี้',
            messageTh: 'ไม่พบคำขอนี้',
        });
        }

        // ผู้ยื่นเห็นได้เฉพาะใบของตัวเอง · ตอบ 404 ไม่ใช่ 403 กับใบของคนอื่น เพราะ 403
        // ยืนยันว่าใบนั้นมีอยู่จริง ซึ่งเป็นข้อมูลที่ผู้ถามไม่ควรได้
        const isOfficer = Boolean(req.user?.providerId) || normalizeRole(req.user?.role) !== 'health';
        if (!isOfficer) {
            // Application.healthId ชี้ไปที่ User.canonicalId — ไม่ใช่ User.id
            // (prisma/schema/application.prisma:12-13) การเทียบกับ req.user.id จึงผิดเสมอ
            if (!application.healthId || application.healthId !== req.user?.healthId) {
                return sendErrorResponse(res, req, {
            status: 404,
            code: 'APPLICATION_NOT_FOUND',
            message: 'ไม่พบคำขอนี้',
            messageTh: 'ไม่พบคำขอนี้',
        });
            }
        }

        const confirmed = new Set(application.feePayments.map((p) => p.phase));
        return sendSuccessResponse(res, req, { data: {
            applicationId: application.id,
            applicationNumber: application.applicationNumber,
            status: application.status,
            phases: Object.entries(PHASES).map(([phase, spec]) => ({
                phase,
                label: spec.label,
                amountThb: application[spec.amountField],
                confirmed: confirmed.has(phase),
                // "ยืนยันได้ตอนนี้ไหม" ตอบจากสถานะจริงของคำขอ ไม่ใช่จากการเดาของหน้าจอ
                confirmable: application.status === spec.from && !confirmed.has(phase),
            })),
            payments: application.feePayments,
        } });
    } catch (error) {
        logger.error('[fees] read failed', { error: error?.message });
        return sendErrorResponse(res, req, {
            status: 500,
            code: 'FEE_READ_FAILED',
            message: 'อ่านข้อมูลค่าธรรมเนียมไม่สำเร็จ',
            messageTh: 'อ่านข้อมูลค่าธรรมเนียมไม่สำเร็จ',
        });
    }
});

/**
 * POST /api/fees/:applicationId/:phase/confirm
 * เจ้าหน้าที่ยืนยันว่ารับค่าธรรมเนียมงวดนั้นแล้ว และคำขอเดินหนึ่งก้าว
 */
router.post('/:applicationId/:phase/confirm', authenticateProvider, async (req, res) => {
    const phase = String(req.params.phase || '').toUpperCase();
    const spec = PHASES[phase];
    if (!spec) {
        return sendErrorResponse(res, req, {
            status: 400,
            code: 'FEE_PHASE_UNKNOWN',
            message: `งวดค่าธรรมเนียมต้องเป็น ${Object.keys(PHASES).join(' หรือ ')}`,
            messageTh: `งวดค่าธรรมเนียมต้องเป็น ${Object.keys(PHASES).join(' หรือ ')}`,
        });
    }

    const actorRole = normalizeRole(req.user?.role);
    // สิทธิ์มาจาก ROLE_TRANSITIONS ที่เดียว — ผู้ตรวจเอกสารถือ งวด 1 ผู้ตรวจแปลงถือ งวด 2
    // ไม่ทำสำเนากติกามาไว้ที่นี่ เพราะสำเนาคือสิ่งที่จะเพี้ยนทีหลัง
    if (!canRoleTransition(actorRole, spec.from, spec.to)) {
        return sendErrorResponse(res, req, {
            status: 403,
            code: 'FEE_CONFIRM_FORBIDDEN',
            message: `ตำแหน่งของคุณไม่มีสิทธิ์ยืนยัน${spec.label}`,
            messageTh: `ตำแหน่งของคุณไม่มีสิทธิ์ยืนยัน${spec.label}`,
        });
    }

    try {
        const application = await prisma.application.findUnique({
            where: { id: req.params.applicationId },
            select: { id: true, status: true, [spec.amountField]: true },
        });
        if (!application) {
            return sendErrorResponse(res, req, {
            status: 404,
            code: 'APPLICATION_NOT_FOUND',
            message: 'ไม่พบคำขอนี้',
            messageTh: 'ไม่พบคำขอนี้',
        });
        }
        if (application.status !== spec.from) {
            return sendErrorResponse(res, req, {
            status: 409,
            code: 'FEE_NOT_DUE',
            message: `คำขออยู่ที่สถานะ ${application.status} จึงยังไม่ถึงขั้นยืนยัน${spec.label}`,
            messageTh: `คำขออยู่ที่สถานะ ${application.status} จึงยังไม่ถึงขั้นยืนยัน${spec.label}`,
        });
        }

        // แถวค่าธรรมเนียมเกิดก่อน แล้วจึงเดินสถานะ — ถ้ามีคนกดพร้อมกัน unique constraint
        // จะปฏิเสธใบที่สอง และสถานะยังไม่ทันเดิน จึงไม่มีทางเดินสองครั้ง
        const payment = await prisma.feePayment.create({
            data: {
                applicationId: application.id,
                phase,
                amountThb: application[spec.amountField],
                externalReference: req.body?.externalReference?.trim() || null,
                note: req.body?.note?.trim() || null,
                confirmedById: req.user.id,
            },
        });

        await writeApplicationStatus({
            prisma,
            applicationId: application.id,
            fromStatus: spec.from,
            toStatus: spec.to,
            actorId: req.user.id,
            actorRole,
            reason: `ยืนยันรับ${spec.label}` + (payment.externalReference ? ` (อ้างอิง ${payment.externalReference})` : ''),
            additionalData: {
                [spec.statusField]: 'PAID',
                [spec.paidAtField]: payment.confirmedAt,
            },
            assertTransition: true,
        });

        logger.info('[fees] confirmed', { applicationId: application.id, phase, by: req.user.id });
        return sendSuccessResponse(res, req, { status: 201, data: { payment, status: spec.to } });
    } catch (error) {
        // P2002 = unique([applicationId, phase]) — มีคนยืนยันงวดนี้ไปแล้ว
        if (error?.code === 'P2002') {
            return sendErrorResponse(res, req, {
            status: 409,
            code: 'FEE_ALREADY_CONFIRMED',
            message: `${spec.label}ถูกยืนยันไปแล้ว`,
            messageTh: `${spec.label}ถูกยืนยันไปแล้ว`,
        });
        }
        logger.error('[fees] confirm failed', { error: error?.message });
        return sendErrorResponse(res, req, {
            status: 500,
            code: 'FEE_CONFIRM_FAILED',
            message: 'บันทึกการรับค่าธรรมเนียมไม่สำเร็จ',
            messageTh: 'บันทึกการรับค่าธรรมเนียมไม่สำเร็จ',
        });
    }
});

module.exports = router;
