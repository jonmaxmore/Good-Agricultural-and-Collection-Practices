const express = require('express');
const { providerRouteHandlers } = require('./route-registry');
const {
    authenticateProvider,
    requireCanonicalPermission,
    requireRole,
    PERMISSIONS,
    logger,
    prisma,
} = require('./handlers/shared');
const { ROLE_GROUPS } = require('../../../shared/canonical-rbac');
const workflowTransitionService = require('../../../services/workflow-transition-service');
const { withVisibility } = require('../../../shared/application-visibility');
// Batch 14 (2026-05-16): auditor routes now go through the service layer.
// `applicationService` owns the final-approval queue listing, the
// visibility-scoped detail lookup and the column-only writes that follow a
// buildTransitionUpdate(). Direct prisma.X.find/update calls have been
// retired — only the prisma client handle is needed for downstream callers
// (none here at the moment, but the pattern stays consistent with the rest
// of the provider cluster).
const applicationService = require('../../../services/application-service');
const certificateService = require('../../../services/certificate-service');
const { statusTransitionAuditHook } = require('../../../middleware/audit-logger');

const router = express.Router();

router.get('/dashboard', ...providerRouteHandlers.auditorDashboard);
router.post(
    '/applications/:id/inspection-starts',
    ...providerRouteHandlers.auditorInspectionStarts,
);
router.post(
    '/applications/:id/audit-decisions',
    ...providerRouteHandlers.auditorAuditDecisions,
);

// ── Audit Session (GPS Check-in / Evidence / Notes / Duration) ──────
const {
    handleGPSCheckIn,
    handleSaveEvidence,
    handleSaveSessionNotes,
    handleGetSession,
} = require('./handlers/auditor-session-handler');

router.get('/applications/:id/session', authenticateProvider, handleGetSession);
router.post('/applications/:id/session/checkin', authenticateProvider, requireCanonicalPermission(PERMISSIONS.AUDIT_SUBMIT), handleGPSCheckIn);
router.post('/applications/:id/session/evidence', authenticateProvider, requireCanonicalPermission(PERMISSIONS.AUDIT_SUBMIT), handleSaveEvidence);
router.post('/applications/:id/session/notes', authenticateProvider, requireCanonicalPermission(PERMISSIONS.AUDIT_SUBMIT), handleSaveSessionNotes);

// ── Final Approval (merged from head-auditor) ──────────────────────

// X2-FIX-D M-18 (DR-FA-1): defense-in-depth — tighten the GET queue to
// AUDITORS + ADMIN. DOC_REVIEWER holds APPLICATION_WORKFLOW_TRANSITION
// for its own ASSIGNED_FOR_REVIEW→DOC_APPROVED/REVISION_REQUESTED set,
// so the perm-only gate was admitting DR even though no canonical
// transition from AUDIT_PASSED is available to it. POST already 400s
// at buildTransitionUpdate, but the GET leaked the AUDIT_PASSED list.
// Same gate is intentionally NOT added to the POST endpoints — those
// already fail-closed at the service-layer canRoleTransition check,
// and adding requireRole there would change the response shape (403
// vs the existing 400 "cannot transition"), breaking existing tests.
router.get(
    '/final-approval-queue',
    authenticateProvider,
    requireCanonicalPermission(PERMISSIONS.APPLICATION_WORKFLOW_TRANSITION),
    requireRole(ROLE_GROUPS.AUDITORS),
    async (req, res) => {
        try {
            const rows = await applicationService.listFinalApprovalQueue();
            return res.json({
                success: true,
                data: {
                    total: rows.length,
                    items: rows.map((row) => ({
                        id: row.id,
                        applicationNumber: row.applicationNumber,
                        status: row.status,
                        updatedAt: row.updatedAt,
                        createdAt: row.createdAt,
                        applicantName: `${String(row.applicant?.firstName || '')} ${String(row.applicant?.lastName || '')}`.trim() || '-',
                    })),
                },
            });
        } catch (error) {
            logger.error('[provider] auditor/final-approval-queue failed', { message: error.message });
            return res.status(500).json({ success: false, error: 'Failed to load final approval queue' });
        }
    },
);

router.post(
    '/applications/:id/final-approvals',
    authenticateProvider,
    requireCanonicalPermission(PERMISSIONS.APPLICATION_WORKFLOW_TRANSITION),
    async (req, res) => {
        try {
            const idOrNumber = String(req.params.id || '').trim();
            if (!idOrNumber) {
                return res.status(400).json({ success: false, error: 'Application id is required' });
            }

            // Wave A Phase 29: gate auditor final-approval by visibility.
            // The role permission allows auditors broadly; the visibility
            // filter narrows to their assigned applications.
            const application = await applicationService.findApplicationForFinalApproval({
                where: withVisibility(
                    { OR: [{ id: idOrNumber }, { applicationNumber: idOrNumber }], isDeleted: false },
                    req.user,
                ),
            });
            if (!application) {
                return res.status(404).json({ success: false, error: 'Application not found' });
            }

            const transition = workflowTransitionService.buildTransitionUpdate({
                application,
                toState: 'APPROVED',
                actorId: req.user.id,
                actorRole: req.user.canonicalRole || req.user.role,
                comment: String(req.body?.comment || '').trim() || 'Final approval by auditor',
                reasonCode: 'AUDITOR_FINAL_APPROVED',
            });

            // 2026-06-05: the certificate is already issued on the AUDIT_PASSED
            // write (single-auditor flow — the two-person APPROVED step was
            // removed). This route now just advances AUDIT_PASSED → APPROVED for
            // the record; generateCertificate is idempotent (it skips when a
            // cert already exists) and is kept as a belt-and-suspenders so an
            // application can never sit APPROVED without a certificate.
            const updated = await prisma.$transaction(async (tx) => {
                const row = await tx.application.update({
                    where: { id: application.id },
                    data: transition.updateData,
                    select: { id: true, applicationNumber: true, status: true, updatedAt: true },
                });
                // F-FINAL-APPROVAL-NO-AUDIT (Phase 0 walk-2 2026-08-19, C13):
                // this route updates the row directly (buildTransitionUpdate
                // guards the edge but writeApplicationStatus is never called),
                // so the AUDIT_PASSED → APPROVED hop committed with NO canonical
                // APPLICATION_STATUS_TRANSITION row. Write the same canonical
                // row the writer's onAudit hook writes, in the SAME tx, so the
                // hop cannot commit without its trail.
                await statusTransitionAuditHook({ tx, metadata: { reasonCode: 'AUDITOR_FINAL_APPROVED' } })({
                    event: 'APPLICATION_STATUS_TRANSITION',
                    applicationId: application.id,
                    fromStatus: application.status,
                    toStatus: 'APPROVED',
                    actorId: req.user.id,
                    actorRole: req.user.canonicalRole || req.user.role,
                    reason: 'AUDITOR_FINAL_APPROVED',
                });
                // PDPA close-natid-round2 (2026-06-30): pass the User UUID
                // (req.user.id), NOT req.user.providerId. `generateCertificate`
                // stamps this value into Certificate.issuedBy + signedBy; a
                // providerId is a 13-digit national ID that would otherwise land
                // plaintext on the cert and on the rendered "ออกโดย" / trace
                // surfaces (admin cert detail-view, interoperability trace
                // events). The UUID eliminates the national ID at SOURCE and
                // matches the AUDIT_PASSED auto-issue path
                // (application-status-writer.js passes the UUID actorId). The
                // issuedBy/signedBy columns are also encrypted at rest (defence
                // in depth) — see prisma-pdpa-extension CERTIFICATE_PII_COLUMNS.
                await certificateService.generateCertificate(
                    application.id,
                    req.user.id,
                    { skipInitialAssets: true, prisma: tx },
                );
                return row;
            });
            return res.json({ success: true, data: updated });
        } catch (error) {
            logger.error('[provider] auditor final approval failed', { message: error.message });
            // buildTransitionUpdate's guards (wrong role / illegal edge /
            // already-in-state) throw PLAIN Errors with no status — those are
            // client/state conditions, not server faults, so surface them as 422
            // rather than a misleading 500 (UAT 2026-06-05: ADMIN final-approval
            // returned 500 for "Role admin cannot transition AUDIT_PASSED ->
            // APPROVED"). A pre-set error.status (if any) is still honoured.
            const msg = String(error?.message || '');
            const isTransitionGuard = /cannot transition|Invalid transition|already in workflow state|Only admin can force|Unknown actor role|Invalid workflow state/i.test(msg);
            const statusCode = error.status || (isTransitionGuard ? 422 : 500);
            const clientVisible = statusCode !== 500;
            return res.status(statusCode).json({
                success: false,
                error: clientVisible ? error.message : 'Failed to finalize approval',
                code: error.code || (isTransitionGuard ? 'INVALID_TRANSITION' : undefined),
            });
        }
    },
);

router.post(
    '/applications/:id/reject-to-auditor',
    authenticateProvider,
    requireCanonicalPermission(PERMISSIONS.APPLICATION_WORKFLOW_TRANSITION),
    async (req, res) => {
        try {
            const idOrNumber = String(req.params.id || '').trim();
            if (!idOrNumber) {
                return res.status(400).json({ success: false, error: 'Application id is required' });
            }

            const comment = String(req.body?.comment || '').trim();
            if (!comment) {
                return res.status(400).json({ success: false, error: 'Rejection reason (comment) is required' });
            }

            // Wave A Phase 29: gate auditor reject-to-auditor by visibility.
            const application = await applicationService.findApplicationForFinalApproval({
                where: withVisibility(
                    { OR: [{ id: idOrNumber }, { applicationNumber: idOrNumber }], isDeleted: false },
                    req.user,
                ),
            });
            if (!application) {
                return res.status(404).json({ success: false, error: 'Application not found' });
            }
            if (application.status !== 'AUDIT_PASSED') {
                return res.status(422).json({ success: false, error: `Cannot reject — status is "${application.status}", expected "AUDIT_PASSED"` });
            }

            const transition = workflowTransitionService.buildTransitionUpdate({
                application,
                toState: 'CAR_REVIEWING',
                actorId: req.user.id,
                actorRole: req.user.canonicalRole || req.user.role,
                comment,
                reasonCode: 'AUDITOR_REJECTED',
            });

            // Reversing AUDIT_PASSED voids the certificate auto-issued on the
            // pass. The status revert and the cert void commit atomically so we
            // never leave a live certificate for an application sent back to CAR
            // review (and so a re-pass can mint a fresh certificate).
            const updated = await prisma.$transaction(async (tx) => {
                const row = await tx.application.update({
                    where: { id: application.id },
                    data: transition.updateData,
                    select: { id: true, applicationNumber: true, status: true, updatedAt: true },
                });
                // Same F-FINAL-APPROVAL-NO-AUDIT hole as the final-approvals
                // route above: the AUDIT_PASSED → CAR_REVIEWING reversal also
                // committed with no canonical APPLICATION_STATUS_TRANSITION row.
                await statusTransitionAuditHook({ tx, metadata: { reasonCode: 'AUDITOR_REJECTED' } })({
                    event: 'APPLICATION_STATUS_TRANSITION',
                    applicationId: application.id,
                    fromStatus: application.status,
                    toStatus: 'CAR_REVIEWING',
                    actorId: req.user.id,
                    actorRole: req.user.canonicalRole || req.user.role,
                    reason: 'AUDITOR_REJECTED',
                });
                await certificateService.revokeCertificateForApplication(application.id, {
                    revokedBy: req.user.id,
                    reason: `Audit pass reversed by auditor: ${comment}`,
                    prisma: tx,
                });
                return row;
            });

            logger.info(`[auditor] Application ${application.applicationNumber} rejected`, { applicationId: application.id, actorId: req.user.id });
            return res.json({ success: true, data: updated });
        } catch (error) {
            // C2-03 (audit 2026-06-10): buildTransitionUpdate guard rejections are
            // client/state conditions (bad edge / role / missing comment), not server
            // faults — surface them as 422 INVALID_TRANSITION, matching the sibling
            // handler at line ~152. Only genuine faults stay 500.
            const msg = error?.message || '';
            const isTransitionGuard = /cannot transition|Invalid transition|already in workflow state|Only admin can force|Unknown actor role|Invalid workflow state|requires a comment|REQUIRES_COMMENT/i.test(msg);
            logger.error('[provider] auditor reject-to-auditor failed', { message: msg });
            return res.status(error.status || (isTransitionGuard ? 422 : 500)).json({
                success: false,
                error: isTransitionGuard ? msg : 'Failed to reject',
                code: error.code || (isTransitionGuard ? 'INVALID_TRANSITION' : undefined),
            });
        }
    },
);

module.exports = router;
