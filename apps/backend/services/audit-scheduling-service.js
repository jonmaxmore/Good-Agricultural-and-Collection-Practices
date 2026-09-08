/**
 * Audit Scheduling Service — Iter 25 (2026-05-16).
 *
 * Bridges the AUDIT_FEE_PAID → AUDIT_CONFIRMED segment of the canonical
 * GACP workflow (workflow-transition-service.js).
 *
 *      AUDIT_FEE_PAID  ──── SCHEDULER assigns auditor + date ───►  AUDIT_CONFIRMED
 *           │                                                       │
 *           │  ◄── HEALTH applicant requests reschedule ────────────┘
 *           │       (RESCHEDULE_REQUESTED in Audit.metadata)
 *           │
 *           └──► SCHEDULER approves reschedule → date updated, status stays
 *                AUDIT_CONFIRMED
 *
 * Cited Thai workflow conventions:
 *   - GACP master workflow per workflow-transition-service.js (states +
 *     allowed transitions). Only SCHEDULER / ADMIN may transition
 *     AUDIT_FEE_PAID → AUDIT_CONFIRMED (ROLE_TRANSITIONS contract).
 *   - Working-day rule (ไม่นัดวันเสาร์-อาทิตย์/วันหยุดราชการ) per
 *     utils/working-days.isWorkingDay.
 *   - Notification of farmer + auditor per Iter 23 fanout layer
 *     (notification-fanout-service.AUDIT_SCHEDULED template).
 *   - Conflict detection (no overlap, max 2 audits/day cap) per
 *     Bureau of Audit operational guideline 2566/2.4.
 *
 * Storage: reschedule requests + scheduling metadata are stored on
 * Application.formData.auditSchedule.* and Application.formData.rescheduleRequests[]
 * to avoid a Prisma migration. Future schema iteration MAY promote
 * RescheduleRequest to a first-class model — this layer is forward-compatible
 * because all JSON keys survive a migration to typed columns.
 *
 * @module services/audit-scheduling-service
 */

'use strict';

const { randomUUID } = require('crypto');
const logger = require('../shared/logger');
const { normalizeRole, CANONICAL_ROLES } = require('../shared/canonical-rbac');
const workflowTransitionService = require('./workflow-transition-service');
const { writeApplicationStatus } = require('./application-status-writer');
const notificationFanoutService = require('./notification-fanout-service');
// One place decides whether a confirmed audit arms the evidence chain — both scheduling
// doors call it, so the rule cannot drift between them. See the module header.
const { armOnsiteEvidence } = require('./audit/arm-onsite-evidence');
const { auditLogger, AuditCategory, AuditSeverity, ResourceType } = require('../middleware/audit-logger');
const { isWorkingDay } = require('../utils/working-days');
const { recordAssignment } = require('./assignment-ledger-service');

let prismaModule;
try {
    prismaModule = require('./prisma-database');
} catch (_e) {
    prismaModule = { prisma: null };
}

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Maximum audits an auditor may have on a single calendar date. Bureau of
 * Audit operational cap per 2566/2.4 guideline (1 morning + 1 afternoon).
 * Override via env if a region needs to lower the cap (raising requires
 * a written deviation per the same guideline).
 */
const AUDITOR_MAX_PER_DAY = Number.isFinite(Number(process.env.AUDITOR_MAX_PER_DAY))
    ? Math.max(1, Math.min(8, Number.parseInt(process.env.AUDITOR_MAX_PER_DAY, 10)))
    : 2;

const SCHEDULER_ROLES = new Set([
    CANONICAL_ROLES.SCHEDULER,
    CANONICAL_ROLES.ADMIN,
]);

const APPLICANT_ROLES = new Set([
    CANONICAL_ROLES.HEALTH,
]);

const RESCHEDULE_STATUS = Object.freeze({
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
});

// ── Errors ─────────────────────────────────────────────────────────────────

function makeError(code, message, statusCode = 400, extra) {
    const err = new Error(message);
    err.code = code;
    err.statusCode = statusCode;
    if (extra) {err.data = extra;}
    return err;
}

function resolvePrisma() {
    return prismaModule && prismaModule.prisma ? prismaModule.prisma : null;
}

// ── Role helpers ───────────────────────────────────────────────────────────

function assertSchedulerRole(actor) {
    const role = normalizeRole(actor?.canonicalRole || actor?.role);
    if (!role || !SCHEDULER_ROLES.has(role)) {
        throw makeError(
            'FORBIDDEN_ROLE',
            'SCHEDULER or ADMIN role required',
            403,
        );
    }
    return role;
}

function assertApplicantRole(actor) {
    const role = normalizeRole(actor?.canonicalRole || actor?.role);
    if (!role || !APPLICANT_ROLES.has(role)) {
        throw makeError(
            'FORBIDDEN_ROLE',
            'HEALTH (applicant) role required to request reschedule',
            403,
        );
    }
    return role;
}

// ── Date validation ────────────────────────────────────────────────────────

function _coerceDate(input) {
    if (!input) {return null;}
    if (input instanceof Date) {return Number.isFinite(input.getTime()) ? input : null;}
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Combine `scheduledDate` (YYYY-MM-DD or ISO) with optional `scheduledTime`
 * (HH:mm, 24-hour). When `scheduledTime` is omitted the time portion of
 * `scheduledDate` is honoured. Returns a Date in the local timezone.
 *
 * For Thai users we treat the server clock as Asia/Bangkok (UTC+7) — the
 * Express runtime is configured to TZ=Asia/Bangkok by deployment manifest;
 * this function does not re-zone.
 */
function _resolveScheduledAt(scheduledDate, scheduledTime) {
    const d = _coerceDate(scheduledDate);
    if (!d) {return null;}
    if (!scheduledTime || typeof scheduledTime !== 'string') {return d;}
    const m = scheduledTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {return d;}
    const hours = Number.parseInt(m[1], 10);
    const minutes = Number.parseInt(m[2], 10);
    if (hours > 23 || minutes > 59) {return d;}
    const next = new Date(d);
    next.setHours(hours, minutes, 0, 0);
    return next;
}

function _isFutureDate(d, nowMs = Date.now()) {
    if (!d) {return false;}
    return d.getTime() > nowMs;
}

// ── Conflict detection ─────────────────────────────────────────────────────

/**
 * Find existing AUDIT_CONFIRMED / in-flight applications assigned to the
 * given auditor on the same calendar date. Cancelled, rejected and
 * completed applications are excluded.
 */
async function _findAuditorBusyOnDate(prisma, { auditorId, scheduledAt, excludeApplicationId } = {}) {
    if (!prisma || !auditorId || !scheduledAt) {return [];}
    const dayStart = new Date(scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setHours(23, 59, 59, 999);

    return prisma.application.findMany({
        where: {
            isDeleted: false,
            auditorId,
            scheduledDate: { gte: dayStart, lte: dayEnd },
            status: {
                notIn: ['REJECTED', 'CANCELLED', 'CANCEL_EXPIRED', 'APPROVED', 'CERTIFIED'],
            },
            ...(excludeApplicationId ? { id: { not: excludeApplicationId } } : {}),
        },
        select: {
            id: true,
            applicationNumber: true,
            scheduledDate: true,
            status: true,
        },
    });
}

/**
 * Validates the slot. Returns `{ ok: true }` or throws with structured
 * `AUDITOR_BUSY` / `AUDITOR_OVER_CAP` errors carrying conflict metadata.
 */
async function _assertSlotAvailable(prisma, {
    auditorId, scheduledAt, excludeApplicationId, durationMinutes = 120,
} = {}) {
    const busy = await _findAuditorBusyOnDate(prisma, { auditorId, scheduledAt, excludeApplicationId });

    if (busy.length >= AUDITOR_MAX_PER_DAY) {
        throw makeError(
            'AUDITOR_OVER_CAP',
            `Auditor already has ${busy.length} audits on ${scheduledAt.toISOString().slice(0, 10)} (cap: ${AUDITOR_MAX_PER_DAY})`,
            409,
            { conflictCount: busy.length, cap: AUDITOR_MAX_PER_DAY, conflicts: busy },
        );
    }

    const windowMs = durationMinutes * 60 * 1000;
    const requestedStart = scheduledAt.getTime();
    const requestedEnd = requestedStart + windowMs;
    const conflicting = busy.find((row) => {
        const existing = row.scheduledDate ? new Date(row.scheduledDate).getTime() : null;
        if (!existing) {return false;}
        const existingEnd = existing + windowMs;
        return existing < requestedEnd && requestedStart < existingEnd;
    });

    if (conflicting) {
        throw makeError(
            'AUDITOR_BUSY',
            `Auditor has overlapping audit at ${new Date(conflicting.scheduledDate).toISOString()} `
                + `(application ${conflicting.applicationNumber})`,
            409,
            { conflictingApplicationId: conflicting.id, conflictingApplicationNumber: conflicting.applicationNumber, conflictingScheduledDate: conflicting.scheduledDate },
        );
    }
}

// ── Audit logging helper ───────────────────────────────────────────────────

async function _safeAudit(action, severity, actor, applicationId, metadata) {
    try {
        await auditLogger.log({
            category: AuditCategory.APPLICATION,
            action,
            severity,
            actorId: actor?.id || 'SYSTEM',
            actorEmail: actor?.email || null,
            actorRole: actor?.canonicalRole || actor?.role || 'UNKNOWN',
            actorType: actor?.providerId ? 'PROVIDER' : 'USER',
            resourceType: ResourceType.APPLICATION,
            resourceId: applicationId,
            organizationId: actor?.organizationId || null,
            metadata: metadata || {},
        });
    } catch (err) {
        logger.warn(`[audit-scheduling] audit log failed (non-fatal): ${err?.message}`);
    }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * The state an application sits in while it waits for a site visit to be
 * scheduled. Named because two other things now have to agree with it:
 * assignAuditor below refuses any other state, and renewal-service places a
 * renewal one settled payment away from it (W12, operator ruling 2026-08-22).
 * Exported so those callers and their tests read this rather than re-spelling
 * the string, which is how the two would drift apart.
 */
const SCHEDULING_QUEUE_STATUS = 'AUDIT_FEE_PAID';

/**
 * Get the scheduling queue — applications in AUDIT_FEE_PAID waiting for
 * SCHEDULER to assign an auditor + date.
 *
 * @param {object} args
 * @param {string} [args.organizationId] — tenant filter
 * @param {string} [args.status]         — defaults to 'AUDIT_FEE_PAID'
 * @returns {Promise<Array>} queue rows for the scheduler UI
 */
async function getSchedulingQueue({ organizationId, status } = {}) {
    const prisma = resolvePrisma();
    if (!prisma) {
        throw makeError('DB_UNAVAILABLE', 'Prisma client unavailable', 503);
    }
    const where = {
        isDeleted: false,
        status: status || SCHEDULING_QUEUE_STATUS,
    };
    if (organizationId) {where.organizationId = organizationId;}

    const rows = await prisma.application.findMany({
        where,
        select: {
            id: true,
            applicationNumber: true,
            status: true,
            organizationId: true,
            auditorId: true,
            scheduledDate: true,
            formData: true,
            phase2Status: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { updatedAt: 'asc' },
        take: 500,
    });

    // H1 contract fix: the FE (scheduler/queue) + AssignAuditorModal read
    // { items, summary } with `applicationId` (getRowKey + the assign POST),
    // `applicantNameMasked`, `region`, and `ageDays`. Previously this returned a
    // BARE ARRAY with `id`/`province` and no summary → the queue rendered empty
    // and every summary tile showed "—". Map to the SchedulingQueueItem shape.
    const now = Date.now();
    const items = rows.map((row) => {
        const applicantName = row.formData && (row.formData.firstName || row.formData.lastName)
            ? `${row.formData.firstName || ''} ${row.formData.lastName || ''}`.trim()
            : '-';
        const region = row.formData?.farmProvince || row.formData?.province || null;
        // Queue-wait proxy: days since the row last changed. While an application
        // sits in AUDIT_FEE_PAID awaiting scheduling nothing else mutates it, so
        // updatedAt ≈ when it entered the queue. (An exact audit-fee paid date would
        // need an invoice join — left for a follow-up; paymentDate stays absent → '-'.)
        const ageDays = row.updatedAt
            ? Math.max(0, Math.floor((now - new Date(row.updatedAt).getTime()) / 86400000))
            : 0;
        return {
            applicationId: row.id,
            applicationNumber: row.applicationNumber,
            status: row.status,
            applicantName,
            // The scheduler is authorised staff assigning auditors and needs the
            // applicant name; the FE renders applicantNameMasked ?? applicantName.
            applicantNameMasked: applicantName,
            region: region || undefined,
            ageDays,
            // Extras the AssignAuditorModal / parity rely on (harmless to the table).
            organizationId: row.organizationId,
            auditorId: row.auditorId,
            scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString() : null,
            phase2Paid: String(row.phase2Status || '').toUpperCase() === 'PAID',
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    });

    const byRegionMap = new Map();
    for (const it of items) {
        const key = it.region || 'ไม่ระบุ';
        byRegionMap.set(key, (byRegionMap.get(key) || 0) + 1);
    }
    const summary = {
        totalPending: items.length,
        byRegion: Array.from(byRegionMap, ([region, count]) => ({ region, count })),
        oldestPendingDays: items.reduce((max, it) => Math.max(max, it.ageDays || 0), 0),
    };

    return { items, summary };
}

/**
 * Assign an auditor + date to an application in AUDIT_FEE_PAID, transitioning
 * it atomically to AUDIT_CONFIRMED.
 *
 * Atomic flow inside one $transaction:
 *   1. validate role + application state + auditor identity
 *   2. assert future-date + working-day
 *   3. assert no auditor conflict + per-day cap
 *   4. writeApplicationStatus(AUDIT_FEE_PAID → AUDIT_CONFIRMED) with auditSchedule
 *      written into formData and `auditorId`+`scheduledDate` written onto the row
 *
 * Outside the transaction (best effort):
 *   - notification-fanout-service.send(AUDIT_SCHEDULED) to applicant
 *
 * @param {object} args
 * @param {string} args.applicationId   — Application.id OR applicationNumber
 * @param {string} args.auditorId       — auditor User.id (must hold AUDITOR role)
 * @param {string|Date} args.scheduledDate — YYYY-MM-DD or ISO timestamp
 * @param {string} [args.scheduledTime] — HH:mm (optional). Merged into scheduledDate
 * @param {string} [args.location]      — onsite address (free text)
 * @param {string} [args.notes]
 * @param {string} [args.inspectionMode] — 'ONSITE' (default) or 'ONLINE_MEET'
 * @param {number} [args.estimatedDuration] — minutes (15–600, default 120)
 * @param {string} args.actorId         — scheduler User.id
 * @param {object} [args.actor]         — full actor (preferred over actorId)
 * @returns {Promise<{ auditId, scheduledAt, auditor, applicationId, workflowState }>}
 */
async function assignAuditor({
    applicationId,
    auditorId,
    scheduledDate,
    scheduledTime,
    location,
    notes,
    inspectionMode,
    estimatedDuration,
    actorId,
    actor,
} = {}) {
    const effectiveActor = actor || (actorId ? { id: actorId, role: CANONICAL_ROLES.SCHEDULER } : null);
    if (!effectiveActor) {
        throw makeError('VALIDATION_ERROR', 'actor or actorId is required');
    }
    assertSchedulerRole(effectiveActor);

    if (!applicationId) {throw makeError('VALIDATION_ERROR', 'applicationId is required');}
    if (!auditorId) {throw makeError('VALIDATION_ERROR', 'auditorId is required');}
    if (!scheduledDate) {throw makeError('VALIDATION_ERROR', 'scheduledDate is required');}

    const scheduledAt = _resolveScheduledAt(scheduledDate, scheduledTime);
    if (!scheduledAt) {
        throw makeError('VALIDATION_ERROR', 'scheduledDate must be a valid date');
    }
    if (!_isFutureDate(scheduledAt)) {
        throw makeError('VALIDATION_ERROR', 'scheduledDate must be in the future', 400);
    }
    if (!isWorkingDay(scheduledAt)) {
        throw makeError(
            'NON_WORKING_DAY',
            'Cannot schedule on weekends or Thai public holidays '
                + '(ไม่สามารถนัดหมายในวันหยุดราชการหรือวันเสาร์-อาทิตย์ได้)',
        );
    }

    const duration = Number.isFinite(Number(estimatedDuration))
        ? Math.min(600, Math.max(15, Number.parseInt(estimatedDuration, 10)))
        : 120;
    const mode = (inspectionMode || 'ONSITE').toUpperCase() === 'ONLINE_MEET'
        ? 'ONLINE_MEET'
        : 'ONSITE';

    const prisma = resolvePrisma();
    if (!prisma) {
        throw makeError('DB_UNAVAILABLE', 'Prisma client unavailable', 503);
    }

    const app = await prisma.application.findFirst({
        where: {
            isDeleted: false,
            OR: [{ id: applicationId }, { applicationNumber: applicationId }],
        },
        select: {
            id: true,
            applicationNumber: true,
            status: true,
            healthId: true,
            organizationId: true,
            auditorId: true,
            scheduledDate: true,
            formData: true,
            workflowHistory: true,
        },
    });
    if (!app) {throw makeError('APPLICATION_NOT_FOUND', `Application ${applicationId} not found`, 404);}

    // Tenant guard (audit 2.5): the application lookup above is by id/number and
    // is NOT org-scoped, so a scheduler in tenant A could schedule an audit on
    // tenant B's application. Reject a cross-tenant app as not-found (anti-
    // enumeration). The auditor lookup below is already org-scoped (X3-FIX-D);
    // this uses the same fail-open-when-no-actor-org convention.
    const schedulerOrgId = effectiveActor?.organizationId || null;
    if (schedulerOrgId && app.organizationId && app.organizationId !== schedulerOrgId) {
        throw makeError('APPLICATION_NOT_FOUND', `Application ${applicationId} not found`, 404);
    }

    const currentState = workflowTransitionService.resolveStateFromApplication(app);
    if (currentState !== SCHEDULING_QUEUE_STATUS) {
        throw makeError(
            'INVALID_STATE',
            `Application must be in ${SCHEDULING_QUEUE_STATUS} before scheduling (current: ${currentState})`,
            409,
        );
    }

    // X3-FIX-D / SC-TEN-1 (2026-05-18) — tenant-scope the auditor lookup
    // when the actor carries an organizationId. Before this fix a SCHEDULER
    // in tenant A could assign tenant B's auditor (defense-in-depth gap;
    // single-tenant deployment so no live exploit). Mirrors the
    // audits-reassign.js:97-105 pattern. When the actor has no
    // organizationId (legacy/system caller), fall back to the global filter
    // so we don't break existing valid assignments.
    const actorOrgId = effectiveActor?.organizationId || null;
    // Phase D+E reviewer note (orchestrator, 2026-05-18): the User Prisma model has
    // `status String` and `isDeleted Boolean` — NOT `isActive`. X3-FIX-D copied the
    // wrong field name; some Prisma versions silently ignore unknown filters which
    // would have let inactive auditors through. Aligned with the audits-reassign.js
    // post-fetch check that asserts `String(user.status).toUpperCase() === 'ACTIVE'`.
    const auditorWhere = { id: auditorId, status: 'ACTIVE', isDeleted: false };
    if (actorOrgId) {auditorWhere.organizationId = actorOrgId;}
    const auditor = await prisma.user.findFirst({
        where: auditorWhere,
        // User has NO `canonicalRole` column (only `role`) — selecting it threw
        // PrismaClientValidationError, swallowed by .catch → null → AUDITOR_NOT_FOUND
        // 404 on EVERY assign (blocked AUDIT_FEE_PAID→AUDIT_CONFIRMED). canonicalRole
        // is a JWT-layer concept; the fallback below already uses role.
        select: { id: true, role: true, firstName: true, lastName: true, email: true, status: true },
    }).catch(() => null);
    if (!auditor) {
        // 404 (not 400) is the canonical "anti-enumeration" response: it
        // does not leak whether the auditor exists in another tenant.
        throw makeError('AUDITOR_NOT_FOUND', `Auditor ${auditorId} not found or inactive`, 404);
    }
    // `canonicalRole` is a JWT/req.user concept, not a User column (the select
    // above only fetches `role`). The old `auditor.canonicalRole ||` fallback was
    // always undefined → dead. Read `role` and canonicalise it directly.
    const auditorRole = normalizeRole(auditor.role);
    if (auditorRole !== CANONICAL_ROLES.AUDITOR) {
        throw makeError(
            'AUDITOR_INVALID_ROLE',
            `User ${auditorId} does not hold AUDITOR role (got ${auditorRole || 'unknown'})`,
            400,
        );
    }

    // Pre-transaction fast-fail: a cheap availability probe that returns the
    // rich AUDITOR_BUSY / AUDITOR_OVER_CAP errors without paying for a
    // serializable transaction in the common "slot already full" case.
    await _assertSlotAvailable(prisma, {
        auditorId,
        scheduledAt,
        excludeApplicationId: app.id,
        durationMinutes: duration,
    });

    const auditId = randomUUID();
    const ts = new Date().toISOString();
    const fd = (app.formData && typeof app.formData === 'object') ? app.formData : {};
    const auditSchedule = {
        auditId,
        scheduledDate: scheduledAt.toISOString(),
        auditorId,
        auditorName: [auditor.firstName, auditor.lastName].filter(Boolean).join(' ').trim() || null,
        inspectionMode: mode,
        location: mode === 'ONSITE' ? (location || null) : null,
        notes: notes || null,
        estimatedDuration: duration,
        scheduledBy: effectiveActor.id || actorId || null,
        scheduledAt: ts,
    };

    try {
        await prisma.$transaction(async (tx) => {
            // Re-assert availability INSIDE the transaction. The pre-tx probe
            // above is a TOCTOU read: two SCHEDULERs assigning the same auditor
            // on the same day can both pass it, then both write — double-booking
            // past AUDITOR_MAX_PER_DAY. Under Serializable isolation the two
            // (read busy-set → write AUDIT_CONFIRMED row) sequences form a
            // read/write dependency cycle that PostgreSQL aborts with P2034, so
            // only one assignment commits. (Same isolationLevel idiom as
            // receipt-numbering-service.js:241 / invoice-service.js:384.)
            await _assertSlotAvailable(tx, {
                auditorId,
                scheduledAt,
                excludeApplicationId: app.id,
                durationMinutes: duration,
            });
            await writeApplicationStatus({
                prisma: tx,
                applicationId: app.id,
                fromStatus: app.status,
                toStatus: 'AUDIT_CONFIRMED',
                actorId: effectiveActor.id || actorId,
                actorRole: effectiveActor.canonicalRole || effectiveActor.role || CANONICAL_ROLES.SCHEDULER,
                reason: 'AUDIT_SCHEDULED',
                additionalData: {
                    auditorId,
                    scheduledDate: scheduledAt,
                    formData: {
                        ...fd,
                        workflowState: 'AUDIT_CONFIRMED',
                        workflowStateUpdatedAt: ts,
                        auditSchedule,
                    },
                },
            });

            // cert-integrity follow-up (onsite evidence, 2026-08-17): the onsite evidence
            // gate counts photos + checklist items keyed to an AuditChecklist row, but
            // nothing created it — every real app resolved to null.
            //
            // Moved into services/audit/arm-onsite-evidence.js on 2026-08-25 because a
            // SECOND door reaches AUDIT_CONFIRMED (the /provider/calendar handler) and did
            // not do this at all, so a scheduler booking through the calendar produced an
            // audit that could never issue a certificate. Copying the block there would
            // have left two copies of an evidence rule free to drift; one function is the
            // point.
            await armOnsiteEvidence(tx, {
                applicationId: app.id,
                auditorId,
                organizationId: app.organizationId,
                createdBy: effectiveActor.id || actorId || null,
                inspectionMode: mode,
            });
        }, { isolationLevel: 'Serializable' });
    } catch (txErr) {
        // P2034 = serialization failure: a concurrent assignment touched the
        // same auditor/day slot. Surface as a retriable 409 (not a 500) so the
        // caller can simply re-submit the assignment.
        if (txErr?.code === 'P2034') {
            throw makeError(
                'AUDITOR_SLOT_CONFLICT',
                'Concurrent scheduling detected for this auditor/date — please retry',
                409,
                { auditorId, scheduledAt: scheduledAt.toISOString() },
            );
        }
        throw txErr;
    }

    // Notify applicant via fanout (best effort — failures must not roll back the transition).
    let notification = null;
    try {
        const healthUser = await prisma.user.findFirst({
            // Detokenize STAGE 0 (RFC breaker 2, data-state-agnostic): app.healthId
            // is the Application.healthId FK value pointing at User.canonicalId,
            // not User.healthId. Query by canonicalId so the applicant
            // notification still resolves after the STAGE-A re-key. Both states.
            where: { canonicalId: app.healthId },
            select: { id: true },
        }).catch(() => null);
        if (healthUser?.id) {
            notification = await notificationFanoutService.send({
                userId: healthUser.id,
                type: 'AUDIT_SCHEDULED',
                payload: {
                    applicationId: app.id,
                    applicationNumber: app.applicationNumber,
                    date: scheduledAt.toISOString(),
                    auditorName: auditSchedule.auditorName,
                },
            });
        }
    } catch (err) {
        logger.warn(`[audit-scheduling] notification fanout failed (non-fatal): ${err?.message}`);
    }

    await _safeAudit('AUDIT_SCHEDULED', AuditSeverity.INFO, effectiveActor, app.id, {
        applicationNumber: app.applicationNumber,
        auditId,
        auditorId,
        scheduledAt: scheduledAt.toISOString(),
        inspectionMode: mode,
    });

    // Work-distribution ledger (best-effort, AFTER the tx commits so a ledger
    // failure can never roll back the assignment): scheduler pushed this auditor.
    await recordAssignment({
        prisma,
        entityType: 'APPLICATION',
        entityId: app.id,
        action: 'ASSIGN',
        assigneeUserId: auditorId,
        assignedByUserId: effectiveActor?.id || actorId || null,
        role: CANONICAL_ROLES.AUDITOR,
        source: 'SCHEDULER',
        reason: `Auditor scheduled (${app.status} → AUDIT_CONFIRMED)`,
        organizationId: actorOrgId || app.organizationId,
    });

    return {
        auditId,
        scheduledAt: scheduledAt.toISOString(),
        auditor: {
            id: auditor.id,
            name: auditSchedule.auditorName,
            email: auditor.email,
        },
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        workflowState: 'AUDIT_CONFIRMED',
        notification,
    };
}

/**
 * Applicant-initiated reschedule request. Creates a PENDING entry inside
 * Application.formData.rescheduleRequests[] and notifies the scheduler.
 *
 * Does NOT change application status; the schedule stays in place until
 * approveReschedule(...) lands.
 *
 * @param {object} args
 * @param {string} args.applicationId   — Application.id OR applicationNumber
 * @param {string|Date} args.requestedDate
 * @param {string} args.reason          — Thai-language free-text, ≥3 chars
 * @param {string} args.actorId         — applicant User.id (HEALTH role)
 * @param {object} [args.actor]
 * @returns {Promise<{ rescheduleId, status, applicationId }>}
 */
async function requestReschedule({ applicationId, requestedDate, reason, actorId, actor } = {}) {
    const effectiveActor = actor || (actorId ? { id: actorId, role: CANONICAL_ROLES.HEALTH } : null);
    if (!effectiveActor) {throw makeError('VALIDATION_ERROR', 'actor or actorId is required');}
    assertApplicantRole(effectiveActor);

    if (!applicationId) {throw makeError('VALIDATION_ERROR', 'applicationId is required');}
    const requestedAt = _coerceDate(requestedDate);
    if (!requestedAt) {throw makeError('VALIDATION_ERROR', 'requestedDate must be a valid date');}
    if (!_isFutureDate(requestedAt)) {
        throw makeError('VALIDATION_ERROR', 'requestedDate must be in the future');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw makeError('VALIDATION_ERROR', 'reason is required (Thai free-text ≥3 chars)');
    }

    const prisma = resolvePrisma();
    if (!prisma) {throw makeError('DB_UNAVAILABLE', 'Prisma client unavailable', 503);}

    const app = await prisma.application.findFirst({
        where: {
            isDeleted: false,
            OR: [{ id: applicationId }, { applicationNumber: applicationId }],
        },
        select: {
            id: true,
            applicationNumber: true,
            status: true,
            healthId: true,
            organizationId: true,
            formData: true,
            scheduledDate: true,
            auditorId: true,
        },
    });
    if (!app) {throw makeError('APPLICATION_NOT_FOUND', `Application ${applicationId} not found`, 404);}

    // Ownership: applicant must own this application. FAIL CLOSED — a missing
    // value on EITHER side is a refusal, not a pass.
    //
    // The previous form required both sides to be present before it compared
    // them, so every case where an owner key was absent read as "ownership not
    // applicable" and let the caller through. Three real ways that happened:
    //   • healthId is no longer in the JWT (Sprint 6 B-C1); auth-middleware
    //     reads it per request and DELIBERATELY keeps HEALTH sessions alive with
    //     null identity fields when that read fails. A sound availability
    //     choice for authentication, but it silently disabled this check during
    //     a pool timeout.
    //   • effectiveActor falls back to `{ id: actorId, role: HEALTH }`, which
    //     has no owner key at all — and this module's docstring advertises
    //     exactly that calling shape for CLI/cron.
    //   • an application row with a null healthId skipped the check for everyone.
    //
    // canonicalId is accepted too: Application.healthId is an FK to
    // User.canonicalId, and the HTTP layer reads `canonicalId || healthId`.
    const actorOwnerKey = effectiveActor.canonicalId || effectiveActor.healthId || null;
    if (!actorOwnerKey || !app.healthId || actorOwnerKey !== app.healthId) {
        throw makeError('FORBIDDEN_OWNER', 'Applicant does not own this application', 403);
    }

    // Application must be AUDIT_CONFIRMED (only point a reschedule is meaningful).
    const currentState = workflowTransitionService.resolveStateFromApplication(app);
    if (currentState !== 'AUDIT_CONFIRMED') {
        throw makeError(
            'INVALID_STATE',
            `Reschedule allowed only when application is AUDIT_CONFIRMED (current: ${currentState})`,
            409,
        );
    }

    const rescheduleId = randomUUID();
    const ts = new Date().toISOString();
    const fd = (app.formData && typeof app.formData === 'object') ? app.formData : {};
    const requests = Array.isArray(fd.rescheduleRequests) ? fd.rescheduleRequests : [];
    const newRequest = {
        id: rescheduleId,
        requestedDate: requestedAt.toISOString(),
        reason: reason.trim(),
        requestedBy: effectiveActor.id || actorId || null,
        requestedAt: ts,
        status: RESCHEDULE_STATUS.PENDING,
        previousScheduledDate: app.scheduledDate ? app.scheduledDate.toISOString() : null,
        previousAuditorId: app.auditorId || null,
    };

    await prisma.application.update({
        where: { id: app.id },
        data: {
            formData: {
                ...fd,
                rescheduleRequests: [...requests, newRequest],
            },
            updatedAt: new Date(),
        },
    });

    // Notify scheduler(s) — best effort. The fanout layer is bypassed here
    // since SCHEDULER is a provider role without an in-app/email template
    // for RESCHEDULE_REQUESTED; we emit an audit-log entry which the
    // scheduler dashboard polls. The fanout layer can be wired in later
    // once a RESCHEDULE_REQUESTED template lands in notification-fanout-service.
    await _safeAudit('AUDIT_RESCHEDULE_REQUESTED', AuditSeverity.WARNING, effectiveActor, app.id, {
        applicationNumber: app.applicationNumber,
        rescheduleId,
        requestedDate: requestedAt.toISOString(),
        reason: reason.trim(),
    });

    return {
        rescheduleId,
        status: RESCHEDULE_STATUS.PENDING,
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
    };
}

/**
 * Approve a PENDING reschedule request. Updates the audit schedule (date and
 * optionally auditor) and marks the request APPROVED. Application status
 * stays AUDIT_CONFIRMED — the only mutation is the schedule itself.
 *
 * @param {string} rescheduleId
 * @param {object} args
 * @param {string|Date} args.newDate
 * @param {string} [args.newAuditor] — optional auditor reassignment
 * @param {string} args.actorId      — scheduler User.id
 * @param {object} [args.actor]
 */
async function approveReschedule(rescheduleId, { newDate, newAuditor, actorId, actor } = {}) {
    const effectiveActor = actor || (actorId ? { id: actorId, role: CANONICAL_ROLES.SCHEDULER } : null);
    if (!effectiveActor) {throw makeError('VALIDATION_ERROR', 'actor or actorId is required');}
    assertSchedulerRole(effectiveActor);

    if (!rescheduleId) {throw makeError('VALIDATION_ERROR', 'rescheduleId is required');}
    const newAt = _coerceDate(newDate);
    if (!newAt) {throw makeError('VALIDATION_ERROR', 'newDate must be a valid date');}
    if (!_isFutureDate(newAt)) {throw makeError('VALIDATION_ERROR', 'newDate must be in the future');}
    if (!isWorkingDay(newAt)) {
        throw makeError(
            'NON_WORKING_DAY',
            'Cannot reschedule onto weekends or Thai public holidays',
        );
    }

    const prisma = resolvePrisma();
    if (!prisma) {throw makeError('DB_UNAVAILABLE', 'Prisma client unavailable', 503);}

    // Locate the application containing this reschedule id.
    // Because the request lives in formData JSON we cannot index it; we scan
    // applications in AUDIT_CONFIRMED with any rescheduleRequests in formData.
    // Tenant guard (audit 2.5): scope the cross-application scan to the actor's
    // org so a scheduler in tenant A can't approve a reschedule on tenant B's
    // application. Fail-open when the actor carries no org (legacy/system caller).
    const actorOrgId = effectiveActor?.organizationId || null;
    const candidateWhere = { isDeleted: false, status: 'AUDIT_CONFIRMED' };
    if (actorOrgId) {candidateWhere.organizationId = actorOrgId;}
    const candidates = await prisma.application.findMany({
        where: candidateWhere,
        select: {
            id: true,
            applicationNumber: true,
            healthId: true,
            auditorId: true,
            scheduledDate: true,
            formData: true,
            organizationId: true,
        },
        take: 2000,
    });

    let app = null;
    let request = null;
    for (const candidate of candidates) {
        const requests = Array.isArray(candidate.formData?.rescheduleRequests)
            ? candidate.formData.rescheduleRequests
            : [];
        const found = requests.find((r) => r && r.id === rescheduleId);
        if (found) {
            app = candidate;
            request = found;
            break;
        }
    }
    if (!app || !request) {
        throw makeError('RESCHEDULE_NOT_FOUND', `Reschedule ${rescheduleId} not found`, 404);
    }
    if (request.status !== RESCHEDULE_STATUS.PENDING) {
        throw makeError(
            'RESCHEDULE_NOT_PENDING',
            `Reschedule is ${request.status} — only PENDING requests may be approved`,
            409,
        );
    }

    const finalAuditorId = newAuditor || app.auditorId;
    if (!finalAuditorId) {throw makeError('VALIDATION_ERROR', 'auditor cannot be empty after reschedule');}

    // If auditor changes, validate new auditor exists + AUDITOR role
    if (newAuditor && newAuditor !== app.auditorId) {
        // Tenant guard (audit 2.5): scope the reassignment auditor to the actor's
        // org (mirrors assignAuditor's auditorWhere). Fail-open when no actor org.
        const newAuditorWhere = { id: newAuditor, status: 'ACTIVE', isDeleted: false };
        if (actorOrgId) {newAuditorWhere.organizationId = actorOrgId;}
        const auditor = await prisma.user.findFirst({
            // User has no `isActive` column — it uses `status` ('ACTIVE') + isDeleted.
            // `isActive` threw (swallowed by .catch → null) → reschedule-with-
            // reassignment always 404'd. Mirrors assignAuditor (status:'ACTIVE').
            where: newAuditorWhere,
            // canonicalRole is NOT a User column (same bug as assignAuditor above) —
            // it threw, was swallowed, and reschedule-with-reassignment always 404'd.
            select: { id: true, role: true },
        }).catch(() => null);
        if (!auditor) {throw makeError('AUDITOR_NOT_FOUND', `Auditor ${newAuditor} not found or inactive`, 404);}
        // canonicalRole is not a User column (select fetches `role` only) — the
        // old `auditor.canonicalRole ||` was always undefined / dead. Read `role`.
        const r = normalizeRole(auditor.role);
        if (r !== CANONICAL_ROLES.AUDITOR) {
            throw makeError('AUDITOR_INVALID_ROLE', `User ${newAuditor} not AUDITOR (got ${r || 'unknown'})`, 400);
        }
    }

    await _assertSlotAvailable(prisma, {
        auditorId: finalAuditorId,
        scheduledAt: newAt,
        excludeApplicationId: app.id,
        durationMinutes: app.formData?.auditSchedule?.estimatedDuration || 120,
    });

    const ts = new Date().toISOString();
    const fd = app.formData || {};
    const existingSchedule = (fd.auditSchedule && typeof fd.auditSchedule === 'object') ? fd.auditSchedule : {};
    const updatedSchedule = {
        ...existingSchedule,
        scheduledDate: newAt.toISOString(),
        auditorId: finalAuditorId,
        rescheduledAt: ts,
        rescheduledBy: effectiveActor.id || actorId || null,
    };
    const updatedRequests = (fd.rescheduleRequests || []).map((r) => (r && r.id === rescheduleId
        ? {
            ...r,
            status: RESCHEDULE_STATUS.APPROVED,
            approvedAt: ts,
            approvedBy: effectiveActor.id || actorId || null,
            approvedNewDate: newAt.toISOString(),
            approvedNewAuditor: finalAuditorId,
        }
        : r));

    await prisma.application.update({
        where: { id: app.id },
        data: {
            auditorId: finalAuditorId,
            scheduledDate: newAt,
            formData: {
                ...fd,
                auditSchedule: updatedSchedule,
                rescheduleRequests: updatedRequests,
            },
            updatedAt: new Date(),
        },
    });

    // Best-effort fanout to applicant (re-uses AUDIT_SCHEDULED template).
    try {
        const healthUser = await prisma.user.findFirst({
            // Detokenize STAGE 0 (RFC breaker 2, data-state-agnostic): app.healthId
            // is the Application.healthId FK value pointing at User.canonicalId,
            // not User.healthId. Query by canonicalId so the applicant
            // notification still resolves after the STAGE-A re-key. Both states.
            where: { canonicalId: app.healthId },
            select: { id: true },
        }).catch(() => null);
        if (healthUser?.id) {
            await notificationFanoutService.send({
                userId: healthUser.id,
                type: 'AUDIT_SCHEDULED',
                payload: {
                    applicationId: app.id,
                    applicationNumber: app.applicationNumber,
                    date: newAt.toISOString(),
                    auditorName: existingSchedule.auditorName,
                },
            });
        }
    } catch (err) {
        logger.warn(`[audit-scheduling] reschedule fanout failed (non-fatal): ${err?.message}`);
    }

    await _safeAudit('AUDIT_RESCHEDULED', AuditSeverity.WARNING, effectiveActor, app.id, {
        applicationNumber: app.applicationNumber,
        rescheduleId,
        newDate: newAt.toISOString(),
        previousDate: request.previousScheduledDate,
        newAuditor: finalAuditorId,
        previousAuditor: app.auditorId,
    });

    return {
        rescheduleId,
        status: RESCHEDULE_STATUS.APPROVED,
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        scheduledDate: newAt.toISOString(),
        auditorId: finalAuditorId,
    };
}

/**
 * Auditor availability over a date range — returns the busy slots that already
 * have AUDIT_CONFIRMED audits assigned. Powers the scheduler UI calendar.
 *
 * @param {object} args
 * @param {string} args.auditorId
 * @param {object} args.dateRange — { from, to } ISO strings or Dates
 * @returns {Promise<{ auditorId, dateRange, busySlots, cap }>}
 */
async function getAuditorAvailability({ auditorId, dateRange } = {}) {
    if (!auditorId) {throw makeError('VALIDATION_ERROR', 'auditorId is required');}
    const from = _coerceDate(dateRange?.from);
    const to = _coerceDate(dateRange?.to);
    if (!from || !to) {throw makeError('VALIDATION_ERROR', 'dateRange.from and dateRange.to are required');}
    if (to.getTime() < from.getTime()) {
        throw makeError('VALIDATION_ERROR', 'dateRange.to must be ≥ dateRange.from');
    }

    const prisma = resolvePrisma();
    if (!prisma) {throw makeError('DB_UNAVAILABLE', 'Prisma client unavailable', 503);}

    const rows = await prisma.application.findMany({
        where: {
            isDeleted: false,
            auditorId,
            scheduledDate: { gte: from, lte: to },
            status: { notIn: ['REJECTED', 'CANCELLED', 'CANCEL_EXPIRED', 'APPROVED', 'CERTIFIED'] },
        },
        select: {
            id: true,
            applicationNumber: true,
            status: true,
            scheduledDate: true,
            formData: true,
        },
        orderBy: { scheduledDate: 'asc' },
    });

    const busySlots = rows.map((r) => ({
        applicationId: r.id,
        applicationNumber: r.applicationNumber,
        status: r.status,
        scheduledDate: r.scheduledDate ? r.scheduledDate.toISOString() : null,
        estimatedDuration: r.formData?.auditSchedule?.estimatedDuration || 120,
    }));

    // Aggregate per-day load to surface OVER_CAP days in the UI.
    const perDay = new Map();
    for (const slot of busySlots) {
        if (!slot.scheduledDate) {continue;}
        const dayKey = slot.scheduledDate.slice(0, 10);
        perDay.set(dayKey, (perDay.get(dayKey) || 0) + 1);
    }
    const overCapDays = Array.from(perDay.entries())
        .filter(([, count]) => count >= AUDITOR_MAX_PER_DAY)
        .map(([day, count]) => ({ day, count }));

    return {
        auditorId,
        dateRange: { from: from.toISOString(), to: to.toISOString() },
        busySlots,
        cap: AUDITOR_MAX_PER_DAY,
        overCapDays,
    };
}

module.exports = {
    AUDITOR_MAX_PER_DAY,
    SCHEDULING_QUEUE_STATUS,
    RESCHEDULE_STATUS,
    getSchedulingQueue,
    assignAuditor,
    requestReschedule,
    approveReschedule,
    getAuditorAvailability,
    _internals: {
        _resolveScheduledAt,
        _isFutureDate,
        _findAuditorBusyOnDate,
        _assertSlotAvailable,
        assertSchedulerRole,
        assertApplicantRole,
    },
};
