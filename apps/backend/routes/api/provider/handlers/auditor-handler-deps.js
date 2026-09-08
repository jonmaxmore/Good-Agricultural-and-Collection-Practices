const {
    prisma,
    authenticateProvider,
    logger,
    PERMISSIONS,
    requireCanonicalPermission,
    normalizeRole,
    safeInt, safeObject, safeArray, safeDate,
    toInt, obj, arr, dt,
    resolveUserIdFromHealthId,
} = require('./shared');
const {
    CANONICAL_ROLES,
} = require('../../../../shared/canonical-rbac');
const workflowTransitionService = require('../../../../services/workflow-transition-service');
const certificateService = require('../../../../services/certificate-service');
// Batch 14 (2026-05-16): invoice reads for the auditor handlers now go
// through invoice-service so this deps file does not reach into Prisma
// directly. The applicationService import follows the same pattern so
// downstream handlers can get the application-side helpers without
// re-importing themselves.
const applicationService = require('../../../../services/application-service');
const { getRequestIp } = require('../../../../utils/client-ip');
const {
    auditLogger,
    AuditCategory,
    AuditSeverity,
    ResourceType,
} = require('../../../../middleware/audit-logger');
const {
    buildAuditorQueueItem,
} = require('./queue-utils');

/**
 * เดิมถามว่า "ออกใบเสร็จงวด 2 แล้วหรือยัง" · GACP Lite ไม่ออกใบเสร็จ — เอกสารการเงิน
 * เป็นของระบบบัญชีลูกค้า สิ่งที่ระบบนี้รู้คือเจ้าหน้าที่ยืนยันรับเงินแล้วหรือยัง
 * ซึ่งเป็นคำถามเดียวกันในเชิงกระบวนการ: ทั้งสองอย่างแปลว่า "งวดนี้จบแล้ว เดินต่อได้"
 */
async function isPhase2ReceiptIssued(applicationId) {
    const confirmed = await prisma.feePayment.findFirst({
        where: { applicationId, phase: 'PHASE_2' },
        select: { id: true },
    });
    return Boolean(confirmed);
}

async function ensureCertificateIssuedForApplication(applicationId, actorIdentity) {
    return certificateService.generateCertificate(
        applicationId,
        actorIdentity || 'SYSTEM',
        { skipInitialAssets: true },
    );
}

module.exports = {
    prisma,
    authenticateProvider,
    logger,
    PERMISSIONS,
    requireCanonicalPermission,
    normalizeRole,
    safeInt, safeObject, safeArray, safeDate,
    toInt, obj, arr, dt,
    resolveUserIdFromHealthId,
    CANONICAL_ROLES,
    workflowTransitionService,
    applicationService,
    getRequestIp,
    auditLogger,
    AuditCategory,
    AuditSeverity,
    ResourceType,
    buildAuditorQueueItem,
    isPhase2ReceiptIssued,
    ensureCertificateIssuedForApplication,
};
