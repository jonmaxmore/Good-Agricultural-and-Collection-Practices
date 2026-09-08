const {
    authenticateProvider,
    logger,
    PERMISSIONS,
    normalizeRole,
    requireCanonicalPermission,
    toInt,
    obj,
    arr,
    dt,
    prisma,
    CANONICAL_ROLES,
    workflowTransitionService,
    getRequestIp,
    auditLogger,
    AuditCategory,
    AuditSeverity,
    ResourceType,
    normalizeInspectionModeInput,
    isValidHttpUrl,
    resolveAuditSchedule,
    hasScheduleCollision,
    getApplicantName,
    resolveUserIdFromHealthId,
    isPhase2PaymentConfirmed,
    isWorkingDay,
} = require('./scheduler-handler-deps');
const { buildWorkflowEvent } = require('../../../../shared/workflow-event-builder');
const { writeApplicationStatus } = require('../../../../services/application-status-writer');
const { createNotification } = require('../../../../services/notification-service');
// One place decides whether a confirmed audit arms the evidence chain — the other
// scheduling door calls the same function, so the rule cannot drift between them.
const { armOnsiteEvidence } = require('../../../../services/audit/arm-onsite-evidence');
// Batch 10 — Prisma bypass cleanup. Scheduler-side application/user reads
// route through application-service + provider-user-service so the projection
// and the ACTIVE/non-deleted filters live at the service boundary. `prisma`
// stays as the transaction handle for writeApplicationStatus only.
const applicationService = require('../../../../services/application-service');
const providerUserService = require('../../../../services/provider-user-service');
// Closing-review NEW-2 (2026-05-15): mask the raw 13-digit identifier before
// writing it into the hash-chained audit row (PDPA Section 27).
const { maskThaiId } = require('../../../../utils/field-encryption');

const schedulerAuditSchedulesPost = [
    authenticateProvider,
    requireCanonicalPermission(PERMISSIONS.APPLICATION_SCHEDULE),
    async (req, res) => {
        try {
            const applicationIdInput = String(req.body?.applicationId || '').trim();
            const auditorId = String(req.body?.auditorId || '').trim();
            const scheduledDate = dt(req.body?.scheduledDate);
            const inspectionMode = normalizeInspectionModeInput(req.body?.inspectionMode || req.body?.auditMode);
            const meetingLink = req.body?.meetingLink || req.body?.meetingUrl || null;
            const mapLink = req.body?.mapLink || null;
            const location = req.body?.location || null;
            const notes = req.body?.notes || null;
            const estimatedDuration = toInt(req.body?.estimatedDuration, 120, 15, 600);

            if (!applicationIdInput || !auditorId || !scheduledDate) {
                return res.status(400).json({ success: false, error: 'applicationId, auditorId, scheduledDate are required' });
            }
            if (!inspectionMode) {
                return res.status(400).json({ success: false, error: 'inspectionMode must be ONSITE or ONLINE_MEET' });
            }
            if (scheduledDate.getTime() <= Date.now()) {
                return res.status(400).json({ success: false, error: 'scheduledDate must be in the future' });
            }
            if (!isWorkingDay(scheduledDate)) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot schedule on weekends or Thai public holidays (ไม่สามารถนัดหมายในวันหยุดราชการหรือวันเสาร์-อาทิตย์ได้)',
                });
            }
            if (inspectionMode === 'ONLINE_MEET' && !meetingLink) {
                return res.status(400).json({ success: false, error: 'meetingLink is required for ONLINE_MEET mode' });
            }
            if (inspectionMode === 'ONLINE_MEET' && !isValidHttpUrl(meetingLink)) {
                return res.status(400).json({ success: false, error: 'meetingLink must be a valid URL' });
            }
            if (inspectionMode === 'ONSITE' && !mapLink && !location) {
                return res.status(400).json({ success: false, error: 'mapLink or location is required for ONSITE mode' });
            }
            if (mapLink && !isValidHttpUrl(mapLink)) {
                return res.status(400).json({ success: false, error: 'mapLink must be a valid URL' });
            }

            // applicationService.findFirstWithWhere — replaces
            // prisma.application.findFirst with the OR(id, applicationNumber)
            // predicate (no visibility filter at this stage — scheduler sees
            // every application in the tenant).
            const app = await applicationService.findFirstWithWhere({
                where: {
                    OR: [{ id: applicationIdInput }, { applicationNumber: applicationIdInput }],
                    isDeleted: false,
                },
                select: {
                    id: true,
                    applicationNumber: true,
                    healthId: true,
                    status: true,
                    phase2Status: true,
                    auditorId: true,
                    scheduledDate: true,
                    formData: true,
                    workflowHistory: true,
                    // Needed by armOnsiteEvidence below: AuditChecklist.organizationId is
                    // required, and this projection did not carry it.
                    organizationId: true,
                },
            });
            if (!app) { return res.status(404).json({ success: false, error: 'Application not found' }); }

            const currentState = workflowTransitionService.resolveStateFromApplication(app);
            if (currentState !== 'AUDIT_FEE_PAID') {
                return res.status(400).json({
                    success: false,
                    error: `Application must be in AUDIT_FEE_PAID before scheduling (current: ${currentState})`,
                });
            }

            const paymentConfirmed = await isPhase2PaymentConfirmed(app);
            if (!paymentConfirmed) {
                return res.status(400).json({
                    success: false,
                    error: 'Phase 2 payment must be confirmed before scheduling',
                });
            }

            // providerUserService.findActiveProviderById — replaces
            // prisma.user.findFirst for the active-provider lookup.
            //
            // X3-FIX-D / SC-TEN-1 (2026-05-18) — pass `organizationId` so the
            // auditor lookup is tenant-scoped. Before this fix a SCHEDULER in
            // tenant A could assign tenant B's auditor (defense-in-depth gap;
            // single-tenant deployment so no live exploit). Mirrors the
            // audits-reassign.js:97-105 pattern that already tenant-scopes
            // BOTH the application and auditor lookups via the same
            // req.user.organizationId resolution. When `organizationId` is
            // unresolvable (legacy actor row), the lookup falls back to the
            // global filter so we don't break existing valid assignments.
            const orgId = req.user?.organizationId || req.tenantContext?.organizationId || null;
            const auditor = await providerUserService.findActiveProviderById(
                orgId ? { id: auditorId, organizationId: orgId } : auditorId,
            );
            if (!auditor) {
                // X3-FIX-D / SC-TEN-1 — return 404 (not 400) when the auditor
                // is invisible because of the tenant filter. 404 is the
                // canonical "anti-enumeration" response that does not leak
                // whether the auditor exists in another tenant.
                return res.status(404).json({ success: false, error: 'Auditor account not found or inactive' });
            }
            if (normalizeRole(auditor.role) !== CANONICAL_ROLES.AUDITOR) {
                return res.status(400).json({ success: false, error: 'auditorId must belong to auditor role' });
            }

            const searchWindowStart = new Date(scheduledDate.getTime() - (12 * 60 * 60 * 1000));
            const searchWindowEnd = new Date(scheduledDate.getTime() + (12 * 60 * 60 * 1000));
            // applicationService.findAuditorScheduleCandidates — replaces
            // prisma.application.findMany for the auditor-collision window.
            const candidateSchedules = await applicationService.findAuditorScheduleCandidates({
                auditorId,
                excludeApplicationId: app.id,
                windowStart: searchWindowStart,
                windowEnd: searchWindowEnd,
            });

            const conflicting = candidateSchedules.find((candidate) => {
                const candidateSchedule = resolveAuditSchedule(candidate);
                return hasScheduleCollision(
                    {
                        start: candidateSchedule.scheduledDate,
                        durationMinutes: candidateSchedule.estimatedDuration,
                    },
                    {
                        start: scheduledDate,
                        durationMinutes: estimatedDuration,
                    },
                );
            });
            if (conflicting) {
                const candidateSchedule = resolveAuditSchedule(conflicting);
                return res.status(409).json({
                    success: false,
                    error: 'Auditor schedule collision detected',
                    data: {
                        conflictingApplicationId: conflicting.id,
                        conflictingApplicationNumber: conflicting.applicationNumber,
                        conflictingScheduledDate: candidateSchedule.scheduledDateISO,
                    },
                });
            }

            const ts = new Date().toISOString();
            const fd = obj(app.formData);
            const wh = arr(app.workflowHistory);
            const previousSchedule = resolveAuditSchedule(app);
            const scheduleAction = previousSchedule.scheduledDate ? 'AUDIT_RESCHEDULED' : 'AUDIT_SCHEDULED';
            const healthUserId = await resolveUserIdFromHealthId(app.healthId);

            await writeApplicationStatus({
                prisma,
                applicationId: app.id,
                fromStatus: app.status,
                toStatus: 'AUDIT_CONFIRMED',
                actorId: req.user.id,
                actorRole: req.user.canonicalRole || req.user.role || null,
                reason: scheduleAction,
                additionalData: {
                    auditorId,
                    scheduledDate,
                    updatedBy: req.user.id,
                    formData: {
                        ...fd,
                        workflowState: 'AUDIT_CONFIRMED',
                        workflowStateUpdatedAt: ts,
                        auditSchedule: {
                            ...obj(fd.auditSchedule),
                            scheduledDate: scheduledDate.toISOString(),
                            auditorId,
                            inspectionMode,
                            meetingLink: inspectionMode === 'ONLINE_MEET' ? meetingLink : null,
                            mapLink: inspectionMode === 'ONSITE' ? (mapLink || null) : null,
                            location: inspectionMode === 'ONSITE' ? (location || null) : null,
                            notes,
                            estimatedDuration,
                            scheduledBy: req.user.id,
                            scheduledAt: ts,
                        },
                    },
                    workflowHistory: [...wh, buildWorkflowEvent({
                        action: scheduleAction,
                        fromState: currentState,
                        toState: 'AUDIT_CONFIRMED',
                        actorId: req.user.id,
                        actorRole: req.user.canonicalRole || req.user.role || null,
                        metadata: {
                            auditorId,
                            inspectionMode,
                            meetingLink: inspectionMode === 'ONLINE_MEET' ? meetingLink : null,
                            mapLink: inspectionMode === 'ONSITE' ? (mapLink || null) : null,
                            location: inspectionMode === 'ONSITE' ? (location || null) : null,
                            previousScheduledDate: previousSchedule.scheduledDateISO,
                            previousAuditorId: app.auditorId || null,
                        },
                    })],
                },
            });
            // Arm the evidence chain. This door reached AUDIT_CONFIRMED without it until
            // 2026-08-25: the onsite evidence gate counts photos and checklist items keyed
            // to an AuditChecklist row, so a scheduler booking through the calendar produced
            // an audit that could be carried out in full and still never issue a
            // certificate, failing at the last state with NO_ONSITE_AUDIT and no earlier
            // sign that anything was wrong.
            //
            // Shared with the /api/audit/scheduling/assign door rather than duplicated —
            // two copies of an evidence rule drift, and this is what drift cost.
            const evidence = await armOnsiteEvidence(prisma, {
                applicationId: app.id,
                auditorId,
                organizationId: app.organizationId,
                createdBy: req.user.id,
                inspectionMode,
            });

            // Re-fetch with select shape (canonical writer doesn't expose select option).
            // applicationService.getById — replaces prisma.application.findUnique
            // for the post-write projection (canonical writer doesn't expose select).
            const updated = await applicationService.getById(app.id, {
                select: {
                    id: true,
                    applicationNumber: true,
                    status: true,
                    auditorId: true,
                    scheduledDate: true,
                    formData: true,
                },
            });

            await Promise.all([
                (healthUserId ? createNotification({
                    userId: healthUserId,
                    type: 'INFO',
                    title: scheduleAction === 'AUDIT_RESCHEDULED' ? 'Audit schedule updated' : 'Audit has been scheduled',
                    message: `Application ${app.applicationNumber} audit is scheduled for ${scheduledDate.toISOString()}`,
                    data: {
                        applicationId: app.id,
                        applicationNumber: app.applicationNumber,
                        scheduledDate: scheduledDate.toISOString(),
                        auditorId,
                        inspectionMode,
                        meetingLink: inspectionMode === 'ONLINE_MEET' ? meetingLink : null,
                        mapLink: inspectionMode === 'ONSITE' ? (mapLink || null) : null,
                        location: inspectionMode === 'ONSITE' ? (location || null) : null,
                    },
                }).catch((notificationError) => logger.warn('[provider] notify health failed:', notificationError.message)) : Promise.resolve()),
                createNotification({
                    userId: auditorId,
                    type: 'INFO',
                    title: scheduleAction === 'AUDIT_RESCHEDULED' ? 'Inspection schedule updated' : 'New inspection assigned',
                    message: `You are assigned to application ${app.applicationNumber}`,
                    data: {
                        applicationId: app.id,
                        applicationNumber: app.applicationNumber,
                        scheduledDate: scheduledDate.toISOString(),
                        inspectionMode,
                        meetingLink: inspectionMode === 'ONLINE_MEET' ? meetingLink : null,
                        mapLink: inspectionMode === 'ONSITE' ? (mapLink || null) : null,
                        location: inspectionMode === 'ONSITE' ? (location || null) : null,
                    },
                }).catch((notificationError) => logger.warn('[provider] notify auditor failed:', notificationError.message)),
            ]);

            try {
                await auditLogger.log({
                    category: AuditCategory.APPLICATION,
                    action: scheduleAction,
                    severity: scheduleAction === 'AUDIT_RESCHEDULED' ? AuditSeverity.WARNING : AuditSeverity.INFO,
                    actorId: req.user.id || 'SYSTEM',
                    actorRole: req.user.canonicalRole || req.user.role || 'UNKNOWN',
                    actorType: 'PROVIDER',
                    resourceType: ResourceType.APPLICATION,
                    resourceId: app.id,
                    ipAddress: getRequestIp(req),
                    userAgent: req.get('user-agent'),
                    metadata: {
                        applicationNumber: app.applicationNumber,
                        scheduledDate: scheduledDate.toISOString(),
                        inspectionMode,
                        meetingLink: inspectionMode === 'ONLINE_MEET' ? meetingLink : null,
                        mapLink: inspectionMode === 'ONSITE' ? (mapLink || null) : null,
                        location: inspectionMode === 'ONSITE' ? (location || null) : null,
                        estimatedDuration,
                        auditorId,
                        auditorName: getApplicantName(auditor),
                        previousScheduledDate: previousSchedule.scheduledDateISO,
                        previousAuditorId: app.auditorId || null,
                        actorIdentity: maskThaiId(req.user.providerId) || maskThaiId(req.user.healthId) || null,
                    },
                });
            } catch (auditError) {
                logger.warn('[provider] schedule audit log failed:', { message: auditError.message, applicationId: app.id });
            }

            // Data sovereignty (PDPA / 2026-07-25 audit) — a third-party calendar
            // export used to run here. It sent the applicant's name, the farm name,
            // the farm's map link/address, both parties' e-mail addresses and the
            // inspection date out of the country, and asked the vendor to e-mail the
            // citizen and the DTAM officer directly. It has been removed for good.
            //
            // Nothing is lost: the schedule itself is the `formData.auditSchedule`
            // record written to Postgres by writeApplicationStatus() above, the
            // hash-chained audit row is written above, and both parties are told
            // in-app (createNotification above) with e-mail/SMS fan-out handled by
            // the notification service. No third party is involved in inspection
            // scheduling — please do not re-add one. If calendar interop is ever
            // requested, attach a locally generated .ics to the existing
            // notification e-mail instead.

            return res.status(201).json({
                success: true,
                data: {
                    ...updated,
                    workflowState: 'AUDIT_CONFIRMED',
                    inspectionMode,
                    // Told at scheduling time, not discovered at issuance: an ONLINE_MEET
                    // audit arms no evidence chain and cannot lead to a certificate.
                    evidenceArmed: evidence.armed,
                    canLeadToCertificate: evidence.canLeadToCertificate,
                    evidenceNote: evidence.reason,
                    meetingLink: inspectionMode === 'ONLINE_MEET' ? meetingLink : null,
                    mapLink: inspectionMode === 'ONSITE' ? (mapLink || null) : null,
                    location: inspectionMode === 'ONSITE' ? (location || null) : null,
                    estimatedDuration,
                    // Retained as constant nulls so the response shape is unchanged
                    // for existing clients — they only ever saw nulls here, because
                    // the export was never configured in any environment.
                    calendarEventId: null,
                    calendarHtmlLink: null,
                },
                message: scheduleAction === 'AUDIT_RESCHEDULED'
                    ? 'Audit rescheduled successfully'
                    : 'Audit scheduled successfully',
            });
        } catch (error) {
            logger.error('[provider] create audit schedule failed:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to schedule audit',
            });
        }
    },
];

module.exports = {
    schedulerAuditSchedulesPost,
};
