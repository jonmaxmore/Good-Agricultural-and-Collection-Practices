/**
 * M1 — the single submit gate: "who submits, in whose name".
 *
 * Every door that moves an application forward (POST /applications/submit,
 * bundle submit, revision-deadline submit, CAR submit) asks this one function
 * before it writes anything. It answers exactly two questions:
 *
 *   1. Does this application row name an entity at all?  No → 400
 *      VALIDATION_ERROR. An application with a null `entityId` has no legal
 *      submitter to check against, and the old behaviour (skip the gate when
 *      the caller sent no active-entity header) made the gate opt-out by
 *      omission (plan D7).
 *   2. May THIS user act for THAT entity?  The answer comes from the
 *      effective-permission engine primitive
 *      `assertEntityActionPermission` (entity-effective-permissions-service.js:403-426),
 *      which is already fail-closed and already applies REVOKE-wins over role
 *      defaults, legacy permission arrays and GRANT rows. No second permission
 *      model is invented here, and the denial keeps the engine's own code
 *      `ENTITY_PERMISSION_DENIED` (plan D5).
 *
 * The entity checked is the one on the APPLICATION ROW — never the
 * `x-active-entity` header. Keying off the header is how a member of entity A
 * could submit a draft belonging to entity B.
 *
 * Every rejection writes an AuditLog FAILURE row through `auditLogger.log()`,
 * which opens its OWN short transaction and takes its own advisory lock
 * (middleware/audit-logger.js:479,505-506). That is deliberate: the rejection
 * row must survive the caller's rollback, and it must NEVER be called from
 * inside another interactive transaction. `log()` swallows its own errors by
 * design (:526-541), so "every throw writes FAILURE" is best-effort — proven
 * on real DB in staging, not by this unit-level contract (plan D10).
 */

'use strict';

const { assertEntityActionPermission } = require('./entity-effective-permissions-service');
const { auditLogger, AuditCategory, AuditSeverity, ResourceType } = require('../middleware/audit-logger');

/** The capability every submit door gates on. */
const SUBMIT_PERMISSION = 'SUBMIT_APPLICATION';
/** Audit action name for a refused submit (category APPLICATION). */
const SUBMIT_DENIED_ACTION = 'APPLICATION_SUBMIT_DENIED';

/** Sentinel for the NOT-NULL audit columns when the caller has no value. */
const UNKNOWN_ACTOR = 'UNKNOWN';

const VALIDATION_ERROR = 'VALIDATION_ERROR';
/** Reused verbatim from the engine — a new synonym would fork the contract. */
const PERMISSION_DENIED = 'ENTITY_PERMISSION_DENIED';

/**
 * Refusal carrying an HTTP shape. `status` is what the plan's contract and the
 * route handlers read; `statusCode`/`httpStatus` mirror it so the shared
 * sendServiceError mapper does not fall back to 500.
 */
class SubmitGuardError extends Error {
    constructor(status, code, message) {
        super(message);
        this.name = 'SubmitGuardError';
        this.status = status;
        this.statusCode = status;
        this.httpStatus = status;
        this.code = code;
    }
}

/**
 * Best-effort FAILURE row. Never throws: an audit outage must not turn a 403
 * into a 500, and must not mask the refusal itself.
 */
async function writeDenialAudit({ userId, application, entityId, auditContext, status, code, reason }) {
    const ctx = auditContext || {};
    try {
        await auditLogger.log({
            category: AuditCategory.APPLICATION,
            action: SUBMIT_DENIED_ACTION,
            severity: AuditSeverity.WARNING,
            // actorId / actorRole / resourceType / resourceId are NOT NULL on
            // AuditLog (prisma/schema/audit.prisma:22,25,28,29) and log()
            // swallows the insert error — a null here would silently DROP the
            // refusal row instead of raising. UNKNOWN is the existing sentinel
            // (routes/api/identity/mfa.js:384).
            actorId: userId || UNKNOWN_ACTOR,
            actorType: ctx.actorType || 'USER',
            actorRole: ctx.actorRole || UNKNOWN_ACTOR,
            resourceType: ResourceType.APPLICATION,
            resourceId: application?.id || UNKNOWN_ACTOR,
            ipAddress: ctx.ipAddress || null,
            userAgent: ctx.userAgent || null,
            organizationId: ctx.organizationId ?? null,
            result: 'FAILURE',
            errorCode: code,
            errorMessage: reason,
            metadata: {
                // The heart of AC3: in whose name was this attempted.
                onBehalfOfEntityId: entityId || null,
                // What the caller CLAIMED to be acting as, when it differs —
                // a header pointing elsewhere is the signature of the
                // cross-entity submit attempt this gate exists to stop.
                activeEntityId: ctx.activeEntityId ?? null,
                permission: SUBMIT_PERMISSION,
                applicationId: application?.id || null,
                route: ctx.route || null,
                httpStatus: status,
                reason: code,
            },
        });
    } catch (auditErr) {
        // auditLogger.log() already console-falls-back internally; this catch
        // only covers a failure of the call itself (e.g. the module missing).
        console.error('[submit-guard] denial audit write failed', {
            applicationId: application?.id || null,
            code,
            error: auditErr?.message,
        });
    }
}

/**
 * The gate.
 *
 * @param {object} args
 * @param {string} args.userId            the human pressing submit
 * @param {object} args.application       the application ROW (needs id + entityId)
 * @param {object} [args.auditContext]    { actorRole, actorType, ipAddress, userAgent, organizationId, activeEntityId, route }
 * @param {object} [args.prisma]          optional client passed through to the engine
 * @returns {Promise<{ entityId: string }>} the entity the submit acts for
 * @throws {SubmitGuardError} 400 VALIDATION_ERROR | 403 ENTITY_PERMISSION_DENIED
 */
async function assertSubmitAllowed({ userId, application, auditContext, prisma } = {}) {
    const app = application || {};
    const entityId = String(app.entityId || '').trim();
    const actorId = String(userId || '').trim();

    if (!entityId) {
        const message = 'คำขอนี้ยังไม่ได้ระบุผู้ยื่นตามกฎหมาย (entity) จึงยื่นไม่ได้';
        await writeDenialAudit({
            userId: actorId, application: app, entityId: null, auditContext,
            status: 400, code: VALIDATION_ERROR, reason: 'application has no entityId',
        });
        throw new SubmitGuardError(400, VALIDATION_ERROR, message);
    }

    if (!actorId) {
        // No identified actor = nobody to check. Fail closed rather than let
        // an anonymous path fall through to the engine's own arg validation.
        await writeDenialAudit({
            userId: null, application: app, entityId, auditContext,
            status: 403, code: PERMISSION_DENIED, reason: 'no actor on the submit request',
        });
        throw new SubmitGuardError(403, PERMISSION_DENIED, 'ไม่มีสิทธิ์ยื่นคำขอในนามนิติบุคคลนี้');
    }

    try {
        await assertEntityActionPermission({
            entityId,
            userId: actorId,
            permission: SUBMIT_PERMISSION,
            prisma,
        });
    } catch (err) {
        // Fail closed on ANY rejection: the engine's canonical denial and an
        // unexpected fault (pool exhaustion, mis-wired mock) both mean "not
        // proven allowed". The code stays the engine's own (plan D5).
        await writeDenialAudit({
            userId: actorId, application: app, entityId, auditContext,
            status: 403, code: PERMISSION_DENIED,
            reason: err?.code === PERMISSION_DENIED
                ? 'effective permission set lacks SUBMIT_APPLICATION'
                : `permission check failed: ${err?.message || 'unknown error'}`,
        });
        throw new SubmitGuardError(403, PERMISSION_DENIED, 'ไม่มีสิทธิ์ยื่นคำขอในนามนิติบุคคลนี้');
    }

    return { entityId };
}

module.exports = {
    assertSubmitAllowed,
    SubmitGuardError,
    SUBMIT_PERMISSION,
    SUBMIT_DENIED_ACTION,
};
