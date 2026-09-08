/**
 * The whole API surface of GACP Lite, in one readable table.
 *
 * The full platform mounted 60+ routers here across payment, traceability,
 * planting, herbal knowledge, surveys, SOP authoring, accounting and
 * multi-tenant workspaces. Lite answers one question — "may this farm be
 * certified?" — so the table below is the entire product:
 *
 *   ยื่นคำขอ → ชำระค่าตรวจเอกสาร → เจ้าหน้าที่ตรวจเอกสาร → ชำระค่าตรวจแปลง
 *   → ตรวจแปลง → ออกใบรับรอง
 *
 * Anything absent from this file is absent from the system. That is the point:
 * a route that is not mounted cannot be reached, and a reader can see the whole
 * product without opening another file.
 */

const express = require('express');
const router = express.Router();

const { authenticateProvider } = require('../../middleware/auth-middleware');
const { requireAdmin } = require('../../middleware/require-admin');
const { auditMiddleware } = require('../../middleware/audit-middleware');
const { ENTITIES } = require('../../services/audit-trail');
const appMetrics = require('../../shared/metrics');

// ── ระบบ ────────────────────────────────────────────────────────────────────
// /health stays anonymous on purpose: the container healthcheck depends on it.
router.use('/health', require('./health'));
router.use('/notifications', require('./system/notifications'));
router.use('/config', require('./system/config'));
router.use('/system-config', require('./system/system-config-routes'));
router.use('/dashboard', require('./system/dashboard'));
router.use('/master-data', require('./system/master-data'));

// ── บัญชีผู้ใช้ ──────────────────────────────────────────────────────────────
// Local JWT only. The full platform's ThaiD / หมอพร้อม IdP exchange is not part
// of Lite — a customer deploying this has no BORA credentials and should not
// need any to log a farmer in.
// Two doors, because the two audiences are different: an applicant registers
// themselves, an officer is created by an admin. Both are password + local JWT.
//
// `applicant` and `officer` are the names this product uses. `health` and
// `provider` are the full platform's vocabulary, still answered so a client
// written against it keeps working; the files behind both mounts are the same.
router.use('/auth/applicant', require('./auth/auth-health'));
router.use('/auth/officer', require('./auth/auth-provider'));
router.use('/auth/health', require('./auth/auth-health'));
router.use('/auth/provider', require('./auth/auth-provider'));
router.use('/public', require('./auth/public'));
// ยืนยันตัวตนสองชั้นด้วย TOTP — เป็นความปลอดภัยของบัญชี ไม่ใช่การต่อ IdP ภายนอก
router.use('/mfa', require('./identity/mfa'));

// ── คำขอรับรอง ──────────────────────────────────────────────────────────────
const applications = express.Router();
applications.use('/config', require('./applications/applications-config'));
applications.use('/validate', require('./applications/validation'));
applications.use('/calculations', require('./applications/calculations'));
applications.use('/revision-deadline', require('./applications/revision-deadline'));
applications.use('/journey', require('./applications/journey'));
// Mounted BEFORE the '/:applicationId' catch-all so '/renewals' resolves to its
// own handler instead of being read as an id.
applications.use('/renewals', require('./applications/renewals'));
// The CAR router declares its own '/:id/car' paths, so it hangs at the domain
// root. Mounted under an extra '/car' segment it would answer at
// /api/applications/car/:id/car — a door nothing calls (measured 2026-09-07).
applications.use('/', require('./applications/applications-car'));
applications.use('/', require('./applications/revision-resubmit'));
applications.use('/', require('./applications/audit-notes'));
applications.use('/', require('./applications/applications'));
router.use('/applications', applications);
router.use('/criteria', require('./applications/criteria'));

// ── ฟาร์มและแปลง ────────────────────────────────────────────────────────────
// Master data the filing points at. In the full platform these lived under
// `cultivation/` beside planting cycles; a plot belongs to the farm, not to a
// planting, so Lite files them under their own name.
router.use('/farms', require('./farm/farms'));
router.use('/plots', require('./farm/plots'));
router.use('/plants', require('./farm/plants'));

// ── ค่าธรรมเนียม ────────────────────────────────────────────────────────────
// No payment gateway. The application still stops at PENDING_DOC_FEE and
// PENDING_AUDIT_FEE, and an officer records that the fee was received —
// operator ruling 2026-09-08. See routes/api/fees/fee-payments.js.
router.use('/fees', require('./fees/fee-payments'));

// ── ตรวจเอกสารและตรวจแปลง ───────────────────────────────────────────────────
router.use('/audits', require('./audit/audits'));
router.use('/audit/scheduling', require('./audit/scheduling'));
router.use('/audit/onsite', require('./audit/onsite'));
router.use('/audit', require('./audit/audit'));
router.use('/post-audit', require('./audit/post-audit'));
router.use('/site-analyses', require('./audit/site-analyses'));

// ── ใบรับรอง ────────────────────────────────────────────────────────────────
router.use('/certificates', require('./certificates/certificates'));
router.use('/standards', require('./certificates/standards'));

// ── เอกสารแนบ ───────────────────────────────────────────────────────────────
router.use('/files', require('./files/files'));
router.use('/documents', require('./documents/documents'));
router.use('/templates', require('./documents/templates'));
router.use('/training-records', require('./documents/training-records'));
// รายงานตามเงื่อนไขใบรับรอง — ผู้ถือใบรับรองส่งรายงานประจำงวด (ReportSubmission)
router.use('/report-submissions', require('./documents/report-submissions'));

// ── หน้าจอเจ้าหน้าที่ ────────────────────────────────────────────────────────
const provider = express.Router();
provider.use(auditMiddleware({ entityType: ENTITIES.SYSTEM }));
provider.use('/', require('./provider/index'));
provider.use('/directory', require('./system/provider'));
router.use('/provider', provider);

// ── ผู้ดูแลระบบ ─────────────────────────────────────────────────────────────
router.use('/admin', require('./admin'));

// ── ปลายทางเชิงปฏิบัติการ ───────────────────────────────────────────────────
router.get('/metrics', authenticateProvider, requireAdmin, (_req, res) => {
    res.json({ success: true, data: appMetrics.getMetrics() });
});

router.get('/version', (_req, res) => {
    res.json({
        success: true,
        version: '1.0.0-lite',
        edition: 'lite',
        features: ['applications', 'documents', 'audits', 'certificates', 'fees'],
    });
});

module.exports = router;
