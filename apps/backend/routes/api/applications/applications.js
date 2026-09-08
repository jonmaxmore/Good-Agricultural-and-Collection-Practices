/**
 * @swagger
 * tags:
 *   name: Applications
 *   description: Application submission and management
 */

/**
 * Application Routes (Refactored)
 *
 * This file was split from a 1,814-line monolith into focused modules:
 *
 * - helpers/application-constants.js — Constants, step definitions, pure utils
 * - helpers/application-payload-builders.js — API response payload builders
 * - helpers/applications-helpers.js — Health scope / actor identity helpers
 *
 * All API endpoints remain at their original paths. No breaking changes.
 *
 * @module routes/api/applications
 */

const express = require('express');
const { respondError } = require('../../../shared/api-response');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
// B3 — the draft-document DELETE removes the uploaded bytes, not just the rows.
const fsPromises = require('fs/promises');
const applicationService = require('../../../services/application-service');
const { authenticateHealth: _authenticateHealthOnly, authenticateProvider: _authenticateProvider, authenticateAny: authenticateHealth } = require('../../../middleware/auth-middleware');
// Batch 11 (2026-05-16) — direct `prisma.X.method(...)` calls were
// migrated to applicationService methods. The `prisma` client is now
// imported only as a transaction handle for `writeApplicationStatus`
// (see ./applications-car.js for the canonical exception note).
const { prisma } = require('../../../services/prisma-database');
const _feeService = require('../../../services/fee-calculation');
const storageService = require('../../../services/storage-service');
// F-G4-08 — the slots used to accept anything, including a 70-byte 1x1 PNG in a
// slot whose label says "รองรับ .pdf". This guard reads what is actually in the
// file; the rules it applies live in @gacp/validation/upload-rules, which the
// browser wizard imports as well so the two can never disagree.
const uploadContentGuard = require('../../../services/upload-content-guard');
const { MAX_UPLOAD_BYTES, tooLargeRefusal } = require('@gacp/validation/upload-rules');
const applicationDocumentSync = require('../../../services/application-document-sync');
const { getCanonicalSlotId } = require('./validation-slot-utils');
const { writeApplicationStatus } = require('../../../services/application-status-writer');
// R2 M7 (D-6) — append-only per-round snapshot of the submitted formData.
const { snapshotCorrectionSubmission } = require('../../../services/correction-submission-version-service');
// Bug 6.5 — shared 5-working-day revision-deadline guard. The primary /submit
// RESUBMIT path previously skipped the deadline check that submitRevision
// enforces, letting an overdue applicant resubmit through the front door.
const { assertRevisionNotExpired } = require('../../../services/application-service/revision-deadline-guard');
// Tier 18 / B18-A (2026-05-16): on the initial SUBMITTED transition the
// application's quotation is issued. F-G4-64 R3 replaced the fire-and-forget
// call that used to live here with a quotation issuer, which
// awaits, audits and reports the outcome; it is required at the call site
// because it is the only place in this file that needs it. The status writer is
// still on the no-touch list, so issuance still runs outside its transaction —
// the service is idempotent on (applicationId, issuerType), so a retry or
// replay returns the existing row rather than duplicating.
const { createNotification } = require('../../../services/notification-service');
const logger = require('../../../shared/logger');
const { normalizeRole, isProviderRole, CANONICAL_ROLES } = require('../../../shared/canonical-rbac');
// AUTH-09: PDPA ม.16 — consent must precede personal-data processing. The
// runtime gate (defined in consent-manager, fail-open, provider-bypassed) was
// previously wired to ZERO routes. Enforce it at the processing-entry point:
// application SUBMIT. Consent is captured at registration, so this passes for
// every properly-registered applicant and only blocks a consent-withdrawn user.
const { requireConsent } = require('../../../middleware/consent-manager');
// M1 (2026-08-15) — the certificate belongs to the farm, so the submit door
// asks whose farm this is. One guard for all four submit doors; it keys off the
// APPLICATION ROW's entityId (never the x-active-entity header) and writes its
// own AuditLog FAILURE row on every refusal (plan D5/D7/D10).
const { assertSubmitAllowed, SubmitGuardError } = require('../../../services/application-submit-guard');
// M2a (2026-08-15) — the mandatory-document law is DATA (operator ruling G2).
// This door asks it after the authority question and before any write: rights
// first, completeness second.
const {
    assertRequiredDocumentsPresent,
    buildRequirementSnapshot,
    isSubmitGateRefusal,
    respondSubmitGateRefusal,
    MODE_FIRST_SUBMIT,
    MODE_RESUBMIT,
} = require('../../../services/application-document-requirements');
const {
    resolveDeclarationsAcceptance,
    DECLARATIONS_REQUIRED,
} = require('../../../services/application-declarations-gate');
const { auditLogger, AuditCategory, AuditSeverity, ResourceType } = require('../../../middleware/audit-logger');

/**
 * V1-D D2 — explicit HEALTH-role gate.
 *
 * Five applicant-only routes (POST /draft, POST /submit, POST /prepare,
 * POST /draft-documents, DELETE /draft/:id) historically mounted the
 * `authenticateAny` middleware aliased as `authenticateHealth`. The alias
 * accepts BOTH provider and health tokens so staff can read shared
 * endpoints elsewhere, but for these five routes a provider token must
 * be rejected — they mutate applicant-owned drafts and would let an
 * admin/reviewer create/delete drafts in their own name.
 *
 * Pattern mirrors application-listing-handlers.js:57 — return 403 + a
 * machine-readable `code` so the frontend can branch on it. We log a
 * warn so the security team can see denied attempts in audit, but we do
 * NOT write to auditLog from the route per instinct I-003 (audit-log
 * calls must be in-transaction via auditLogger.logWithin; the service
 * layer covers that for successful writes).
 *
 * @param {object} req  Express request — req.user populated by authenticateAny
 * @param {object} res  Express response — 403 written when not health
 * @returns {boolean}   true if the request was rejected (caller must stop)
 */
function rejectIfNotHealthRole(req, res) {
    const rawRole = req.user?.canonicalRole || req.user?.role;
    const canonicalRole = normalizeRole(rawRole);
    if (canonicalRole === CANONICAL_ROLES.HEALTH) {
        return false;
    }
    // Provider role explicitly denied — log loud, return 403 with the
    // dedicated code so the UI / log-analyser can differentiate this
    // from a missing-token 401.
    logger.warn(
        `[Applications RBAC] HEALTH_ROLE_REQUIRED — denied ${req.method} ${req.originalUrl} ` +
        `for role=${canonicalRole || rawRole || 'UNKNOWN'} userId=${req.user?.id || 'unknown'} ` +
        `providerRole=${isProviderRole(rawRole)}`,
    );
    res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'HEALTH_ROLE_REQUIRED',
        message: 'Only applicants (HEALTH role) can perform this action',
    });
    return true;
}
const { buildWorkflowEvent } = require('../../../shared/workflow-event-builder');
const { stripServerOwnedKeys } = require('../../../shared/form-data-ownership');
// Blocker F cleanup: the `_addWorkingDays`/`_loadHolidaySet` destructure of
// services/working-days-service was dead (those property names never existed
// in its exports); deadline WRITES now live on utils/working-days.
const {
    _mapHealthApplication,
    getHealthScopeOptions,
    _getActorIdentity,
} = require('../helpers/applications-helpers');

// Extracted modules
const {
    MASTER_STEPS,
    _AUDITOR_ROLES,
    _REJECTABLE_STATUSES,
    _REVISION_DECISION_TYPES,
    asObject,
    asArray,
    upper,
    ensureApplicationNumber,
    _isMissingApplicationCommentsTableError,
    mergeMasterSteps,
    pickWizardOwnedFormData,
} = require('../helpers/application-constants');
// F-APPV2-02 — the checked channel for the two law dimensions the allowlist may not carry.
const { resolveLawDimensions } = require('../../../services/application-law-dimensions');

const {
    _buildApplicationDetailPayload,
    _buildApplicationHistoryPayload,
    _buildTrackingPayload,
} = require('../helpers/application-payload-builders');

const {
    validateStep,
} = require('../../../validation/application-schemas');

// C2 fix — canonical submit validation. The legacy-vs-canonical decision
// (validateAllSteps vs validateCanonicalSubmission) and both validator calls
// now live in ONE shared function so the revision door
// (application-review-revision-methods.js) runs the identical gate instead
// of a second copy (Ruling 7, task-3 fix round 1) — see
// validation/application-submission-validator.js for the full rationale.
const {
    validateSubmissionPayload,
} = require('../../../validation/application-submission-validator');

// F-QA-06 — a certificate names the place it certifies by reading the FARM row, so a
// filing that reaches the department without one walks the whole line and is refused at
// the last gate (422 CERTIFICATE_FARM_LOCATION_MISSING). The field map that turns a
// filing's own answers into that row lives in ONE module, shared with the v1 wizard door.
const {
    materializeFarmForFiling,
} = require('../../../services/application-service/application-farm-materialization');
// Which era wrote this filing — read off the filing itself, the same marker the submit
// validator uses to choose which law judges it.
const { isKatorlor1Filing } = require('../../../validation/canonical-application-validator');
// ด่านจ่ายเงินที่คำขอไปหยุดรอ — ต่ออายุข้ามด่านตรวจเอกสาร (มติ operator 2026-09-07)
const { entryStateForSubmission } = require('../../../services/application-service/submission-entry-state');

// F-G4-11 (2026-08-26) — the wizard's step-exit bar, server side. The address
// bar is one door into step N; these routes are the other, and until now only
// the browser had an opinion about which step a farmer had earned.
const {
    evaluateStepClaim,
    stepPrerequisiteMessage,
    LAST_FLOW_STEP,
} = require('../../../validation/wizard-step-prerequisites');

const draftDocumentUpload = storageService.createUploader(
    'application-drafts',
    ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    // The ceiling is one number shared with the browser (F-G4-08 layer 3) —
    // multer aborts the write here, upload-content-guard refuses the same size
    // afterwards, and the wizard tells the farmer before either happens.
    MAX_UPLOAD_BYTES / (1024 * 1024),
);

/**
 * Receive the multipart body, and answer multer's own refusals properly.
 *
 * Multer aborts an oversize upload mid-write and calls next(err). This route
 * mounts the uploader as inline middleware with no 4-arg error handler between
 * it and Express's default one, so a farmer who picked a 25 MB scan of a land
 * title got HTTP 500 and the English words "File too large" (measured
 * 2026-08-26). That is layer 3 of F-G4-08 announcing itself as a server crash.
 *
 * The size limit is a rule a farmer can act on, so it is answered like every
 * other refusal: 400, in Thai, naming the cause and the next action. Multer
 * reports neither the original filename nor the real size for an aborted write,
 * which is why the shared module has a builder that needs neither.
 */
function receiveDraftDocument(req, res, next) {
    draftDocumentUpload.single('file')(req, res, (err) => {
        if (!err) {
            return next();
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
            const refusal = tooLargeRefusal();
            return res.status(400).json({
                success: false,
                error: refusal.message,
                code: refusal.code,
                message: refusal.message,
            });
        }
        return next(err);
    });
}

// F-G4-11 — Wizard step-prerequisite helpers
//
// A draft-save payload can carry wizard data in two shapes:
//   CANONICAL  — `formData: { plantId, applicantData, farmData, … }`, the whole
//                store, which is what the live wizard's autosave posts.
//   LEGACY     — `steps: { "7": {…} }`, or `step: 7` + `stepData: {…}`, data
//                scoped to one numbered step (mergeMasterSteps reads both).
// The two are refused differently and `legacyWrittenSteps` is what tells them
// apart: see the block inside POST /draft for why.

/**
 * The step numbers a payload writes step-SCOPED data into.
 * @param {object} payloadInput request body
 * @returns {number[]} master-step numbers, ascending
 */
function legacyWrittenSteps(payloadInput) {
    const payload = asObject(payloadInput);
    const written = new Set();

    for (const [stepKey, stepValue] of Object.entries(asObject(payload.steps))) {
        const stepNumber = Number.parseInt(String(stepKey).trim(), 10);
        if (Number.isFinite(stepNumber) && Object.keys(asObject(stepValue)).length > 0) {
            written.add(stepNumber);
        }
    }

    const explicitStep = Number.parseInt(String(payload.step || ''), 10);
    const stepData = asObject(payload.stepData || payload.data);
    if (Number.isFinite(explicitStep) && MASTER_STEPS.includes(explicitStep) && Object.keys(stepData).length > 0) {
        written.add(explicitStep);
    }

    return [...written].sort((a, b) => a - b);
}

/**
 * The wizard data a caller is holding: what the server has stored, with the
 * caller's own canonical blob laid over it.
 *
 * Reading the caller's blob is deliberate. POST /draft does not persist
 * `payload.formData` (only POST /prepare does), so the stored copy shows every
 * mid-wizard applicant as empty; judging a step claim by that alone would
 * refuse everyone. What the caller sends is not proof — it can lie — but a
 * caller who lies has to send a COMPLETE application to do it, which is no
 * longer skipping the wizard, and POST /submit still judges that data on its
 * own terms before anything is filed.
 *
 * @param {object} storedFormData application.formData
 * @param {object} payloadInput   request body
 * @returns {object} canonical formData to judge against
 */
function claimedWizardData(storedFormData, payloadInput) {
    const payload = asObject(payloadInput);
    return { ...asObject(storedFormData), ...asObject(payload.formData) };
}

/** The one refusal shape for a step whose prerequisites are unmet. */
function respondStepPrerequisiteUnmet(res, { requestedStep, allowedStep }) {
    return res.status(422).json({
        success: false,
        error: 'STEP_PREREQUISITE_UNMET',
        code: 'STEP_PREREQUISITE_UNMET',
        message: stepPrerequisiteMessage(requestedStep, allowedStep),
        requestedStep,
        allowedStep,
    });
}

// Shared DB Helpers

// Wave B Phase 68 — every health user has a personal INDIVIDUAL Entity
// (created at registration in Phase 67, or backfilled in Phase 62/66 for
// existing users). Find it once at draft-creation/find time so the new
// `entityId` and `submitterId` columns added in Phase 66 stay populated.
// Batch 11 (2026-05-16) — moved into application-service so the route no
// longer reaches into prisma.entity directly.
async function findUserPersonalEntity(healthIdentity) {
    return applicationService.findPersonalEntityForHealthIdentity(healthIdentity);
}

// Bug 2.3 — only these statuses may have their formData overwritten by the
// applicant-facing /prepare, /draft (autosave), and draft-document routes.
// findApplicationByIdForHealth carries NO status filter, so an owner could POST
// {applicationId} for an ASSIGNED_FOR_REVIEW (or any downstream) app and blank
// reviewer-facing data via a shallow formData spread while the status column
// stayed put. Gating the explicit-id resolve here protects all three routes
// uniformly. Canonical strings per workflow-transition-service WORKFLOW_STATES.
const EDITABLE_STATUSES = new Set(['DRAFT', 'REVISION_REQUESTED', 'CAR_PENDING']);

async function findOrCreateApplicationForHealth(healthIdentity, reqUser, options = {}, activeEntity = null) {
    const opts = asObject(options);
    const requestedId = String(opts.applicationId || opts.draftId || '').trim();
    const serviceType = String(opts.serviceType || 'new_application').trim() || 'new_application';
    const areaType = String(opts.areaType || 'OUTDOOR').trim() || 'OUTDOOR';

    let application = null;
    if (requestedId) {
        application = await applicationService.findApplicationByIdForHealth(requestedId, healthIdentity.healthId);
        // Bug 2.3 guard: when the caller pinned an EXPLICIT id and that row
        // resolved, refuse to edit it unless it's in an applicant-editable
        // status. Do NOT fall through to findLatestOpenDraftForHealth (which
        // would silently redirect the write to a different row) and do NOT let
        // the caller overwrite the non-editable row's formData.
        if (application && !EDITABLE_STATUSES.has(String(application.status || '').toUpperCase())) {
            const err = new Error(
                `Application ${application.applicationNumber || requestedId} is not editable in status ${application.status}`,
            );
            err.statusCode = 409;
            err.code = 'APPLICATION_NOT_EDITABLE';
            throw err;
        }
    }

    if (!application) {
        application = await applicationService.findLatestOpenDraftForHealth(healthIdentity.healthId);
    }

    // Auto-heal: a row that pre-dates Phase 66 (or somehow slipped through
    // the backfill) gets `entityId`/`submitterId` populated lazily on the
    // first read after this code lands. Cheap (one indexed lookup), and
    // the alternative is forever-null columns.
    if (application && (!application.entityId || !application.submitterId)) {
        const personalEntity = await findUserPersonalEntity(healthIdentity);
        if (personalEntity) {
            application = await applicationService.healDraftEntityColumns(application.id, {
                entityId: application.entityId || personalEntity.id,
                submitterId: application.submitterId || healthIdentity.userId,
            });
        }
    }

    if (application) {
        return application;
    }

    // New draft — wire entityId + submitterId from the start. Wave C PR-5:
    // prefer the active-entity context (set by the workspace switcher) so
    // a draft created while "acting as ABC Co. Ltd." gets ABC Co. as its
    // entityId from second one. Falls back to the personal INDIVIDUAL
    // entity for clients that haven't shipped the picker yet.
    const personalEntity = await findUserPersonalEntity(healthIdentity);
    const seedEntityId = activeEntity?.entityId || personalEntity?.id || null;
    // M1 (2026-08-15) — a draft with no entity is a draft nobody can submit:
    // the submit guard would refuse it at the end of the wizard, after the
    // applicant filled nine steps. Refuse at creation, where it is cheap and
    // the cause is still visible. Same error idiom as the not-editable guard
    // above (statusCode + machine-readable code → respondError maps it).
    //
    // W4 2026-08-22 — the code was a bare VALIDATION_ERROR, and respondError's
    // explicit-4xx branch keeps the CALLER's generic fallback message
    // ("Failed to upload draft document") while safeErrorMessage scrubs the
    // Thai one above (its allowlist is English-only). The whole wire response
    // was therefore `400 VALIDATION_ERROR / ข้อมูลไม่ถูกต้อง` — a message that
    // names neither the cause nor the fix, on a route where nothing the client
    // sent was actually invalid. That is what turned a one-line data defect
    // into a full Playwright walk. The CODE is the one field respondError
    // passes through untouched, so it is where the cause has to live.
    if (!seedEntityId) {
        const err = new Error('ไม่พบผู้ยื่นตามกฎหมาย (entity) ของบัญชีนี้ จึงสร้างคำขอไม่ได้');
        err.statusCode = 400;
        err.code = 'APPLICANT_ENTITY_MISSING';
        throw err;
    }
    return applicationService.createDraftForHealth({
        applicationNumber: ensureApplicationNumber('APP'),
        healthId: healthIdentity.healthId,
        entityId: seedEntityId,
        submitterId: healthIdentity.userId || null,
        serviceType,
        areaType,
        status: 'DRAFT',
        formData: {
            steps: {},
            workflowState: 'DRAFT',
        },
        workflowHistory: [
            buildWorkflowEvent({
                action: 'APPLICATION_DRAFT_CREATED',
                toStatus: 'DRAFT',
                toState: 'DRAFT',
                actorId: healthIdentity.userId,
                actorRole: reqUser?.canonicalRole || reqUser?.role || 'health',
            }),
        ],
    });
}

// M1 — the context the submit guard stamps onto its audit rows. `activeEntityId`
// is recorded ALONGSIDE the entity actually checked: when the two differ, the
// row shows a caller who claimed to act for one workspace while submitting
// another's application, which is precisely the attempt the guard exists to stop.
function buildSubmitAuditContext(req) {
    return {
        actorType: 'USER',
        actorRole: req.user?.canonicalRole || req.user?.role || null,
        ipAddress: req.ip || null,
        userAgent: typeof req.get === 'function' ? req.get('user-agent') : null,
        organizationId: req.user?.organizationId || null,
        activeEntityId: req.activeEntity?.entityId || null,
        route: `${req.method} ${req.baseUrl || ''}${req.path || ''}`,
    };
}

// M1 (review M2) — /submit resolves its row through `findDraftForSubmit`, which
// has NO lazy-heal; the heal above lives only on /draft and /prepare. A row that
// pre-dates Phase 66 whose owner never re-opened the wizard would therefore be
// hard-400 forever once the guard starts requiring an entityId. Heal first with
// the SAME mechanism, then let the guard decide.
async function healApplicationEntityId(application, healthIdentity) {
    if (!application || application.entityId) { return application; }
    const personalEntity = await findUserPersonalEntity(healthIdentity);
    if (!personalEntity?.id) { return application; }
    const healed = await applicationService.healDraftEntityColumns(application.id, {
        entityId: personalEntity.id,
        submitterId: application.submitterId || healthIdentity?.userId || null,
    });
    // Merge rather than replace: the healer's projection is narrower than the
    // row the caller is holding (formData / workflowHistory must survive).
    return {
        ...application,
        entityId: healed?.entityId || personalEntity.id,
        submitterId: healed?.submitterId || application.submitterId || healthIdentity?.userId || null,
    };
}

// M1 AC3 — a submit that is ACCEPTED says in whose name it was made.
//
// The canonical status-transition row cannot carry it: `writeApplicationStatus`
// builds its audit envelope from a fixed six-field shape
// (application-status-writer.js:817-824) and takes no caller metadata, and that
// file is on the no-touch list. So the "in whose name" record is emitted here,
// AFTER the business transaction commits, through the same standalone
// `auditLogger.log()` the guard uses for refusals (own tx + own advisory lock —
// audit-logger.js:479,505-506). Emitting it inside the caller's transaction
// would risk a failed audit INSERT poisoning that transaction (Postgres 25P02)
// and turning an audit hiccup into a rolled-back submit. Best-effort by design:
// log() swallows its own errors (:526-541).
async function logSubmitAccepted({ req, applicationId, entityId, actorId, action, extraMetadata = {} }) {
    const ctx = buildSubmitAuditContext(req);
    try {
        await auditLogger.log({
            category: AuditCategory.APPLICATION,
            action,
            severity: AuditSeverity.INFO,
            actorId: actorId || 'UNKNOWN',
            actorType: ctx.actorType,
            actorRole: ctx.actorRole || 'UNKNOWN',
            resourceType: ResourceType.APPLICATION,
            resourceId: applicationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            organizationId: ctx.organizationId,
            result: 'SUCCESS',
            metadata: {
                onBehalfOfEntityId: entityId || null,
                activeEntityId: ctx.activeEntityId,
                permission: 'SUBMIT_APPLICATION',
                applicationId,
                route: ctx.route,
                ...extraMetadata,
            },
        });
    } catch (auditErr) {
        logger.warn(`[Applications Submit] accepted-audit write failed (non-fatal): ${auditErr?.message}`);
    }
}

function toUploadedFileUrl(file) {
    if (!file) { return null; }
    const fullPath = String(file.path || '').trim();
    if (!fullPath) { return null; }
    return `/uploads/application-drafts/${path.basename(fullPath)}`;
}

/**
 * B3 — delete the bytes behind one `draftDocuments[]` entry.
 *
 * The entry only stores the served `fileUrl` (`/uploads/<...>`), so the disk
 * path is derived from it and then handed to storage-service's ONE containment
 * check, which is what refuses a `..`-poisoned record. Nothing outside the
 * uploads root is ever unlinked; a refusal is logged, not silently swallowed.
 *
 * Never throws: the records are already gone by the time this runs, so a missing
 * or already-unlinked file must not turn a successful delete into a 500.
 */
async function unlinkStoredDraftDocument(doc, applicationId, documentId) {
    const fileUrl = String(doc?.fileUrl || '').trim();
    if (!fileUrl.startsWith('/uploads/')) {
        if (fileUrl) {
            logger.warn(
                `[Applications Draft Documents Delete] Not an /uploads path — refusing to unlink `
                + `(application=${applicationId}, documentId=${documentId}).`,
            );
        }
        return;
    }
    const candidate = path.join(storageService.BASE_UPLOAD_DIR, fileUrl.slice('/uploads/'.length));
    const safePath = storageService.resolveWithinUploads(candidate);
    if (!safePath) {
        logger.warn(
            `[Applications Draft Documents Delete] Refusing to unlink a path outside the uploads root `
            + `(application=${applicationId}, documentId=${documentId}).`,
        );
        return;
    }
    try {
        await fsPromises.unlink(safePath);
    } catch (err) {
        if (err?.code !== 'ENOENT') {
            logger.warn(`[Applications Draft Documents Delete] unlink failed (non-fatal): ${err?.message}`);
        }
    }
}

// READINESS & CONFIG

router.get('/readiness', authenticateHealth, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Establishment + Document aren't actual Prisma models in the
        // current schema (verified 2026-05-03 via grep — no `model
        // Establishment` or `model Document` exists). The applicant
        // readiness snapshot defensively wraps those in optional access
        // (see application-service applicant-query methods).
        // Application.healthId FK references User.canonicalId — JWT no
        // longer carries `healthId` (closed batch 3, PDPA Phase D prep).
        const {
            user,
            farms,
            establishments,
            documents,
        } = await applicationService.getApplicantReadinessSnapshot(userId, {
            canonicalHealthId: req.user.canonicalId,
        });

        const items = [];
        items.push({ id: 'profile', label: 'ข้อมูลโปรไฟล์ครบถ้วน', description: 'ชื่อ-นามสกุล, เลขบัตรประชาชน, ที่อยู่', ready: !!(user?.firstName && user?.lastName), actionHref: '/health/profile', actionLabel: 'แก้ไขโปรไฟล์' });
        items.push({ id: 'establishment', label: 'ลงทะเบียนสถานประกอบการ', description: 'มีข้อมูลสถานประกอบการและพิกัดที่ตั้ง', ready: establishments.length > 0, actionHref: '/health/establishments/new', actionLabel: 'ลงทะเบียนสถานประกอบการ' });
        items.push({ id: 'farm', label: 'ลงทะเบียนฟาร์ม/แปลงปลูก', description: 'มีข้อมูลฟาร์มและแปลงปลูกสมุนไพร', ready: farms.length > 0, actionHref: '/health/planting', actionLabel: 'ลงทะเบียนแปลงปลูก' });

        const sopDocs = Array.isArray(documents) ? documents.filter(d => d.type && d.type.toUpperCase().includes('SOP')) : [];
        items.push({ id: 'sop', label: 'เตรียม SOP (มาตรฐานการปฏิบัติงาน)', description: 'จัดทำ SOP การปลูก, เก็บเกี่ยว, ตากแห้ง, สุขลักษณะ', ready: sopDocs.length > 0, actionHref: '/health/sop-templates', actionLabel: 'ดาวน์โหลดแบบฟอร์ม SOP' });

        const generalDocs = Array.isArray(documents) ? documents.filter(d => !d.type?.toUpperCase().includes('SOP')) : [];
        items.push({ id: 'documents', label: 'เอกสารประกอบ', description: 'สำเนาบัตรประชาชน, ทะเบียนบ้าน, แผนที่สถานที่ปลูก', ready: generalDocs.length >= 2, actionHref: '/health/documents', actionLabel: 'จัดการเอกสาร' });

        const waterTestDocs = Array.isArray(documents) ? documents.filter(d => d.type && d.type.toUpperCase().includes('WATER')) : [];
        items.push({ id: 'water_test', label: 'ผลตรวจคุณภาพน้ำ', description: 'รายงานผลตรวจน้ำจากห้องปฏิบัติการที่ได้รับการรับรอง', ready: waterTestDocs.length > 0, actionHref: '/health/documents', actionLabel: 'อัปโหลดผลตรวจ' });

        const readyCount = items.filter(i => i.ready).length;
        return res.json({ success: true, data: { ready: readyCount === items.length, items, readyCount, totalCount: items.length } });
    } catch (error) {
        logger.error('[Readiness] Error:', error);
        return respondError(res, req, error, { message: 'Failed to check readiness' });
    }
});

router.get('/config', authenticateHealth, async (_req, res) => {
    return res.json({ success: true, data: { totalSteps: MASTER_STEPS.length, steps: MASTER_STEPS } });
});

// DRAFT CRUD

/**
 * @swagger
 * /api/applications/draft:
 *   post:
 *     tags: [Applications]
 *     summary: Create or upsert a DRAFT application (HEALTH role only)
 *     description: |
 *       Saves a wizard step payload onto the applicant's open draft, creating
 *       a fresh DRAFT row when one does not already exist. Provider tokens
 *       are rejected with HEALTH_ROLE_REQUIRED (V1-D D2 gate).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applicationId:
 *                 type: string
 *                 description: Existing draft id to upsert into
 *               serviceType:
 *                 type: string
 *                 example: new_application
 *               areaType:
 *                 type: string
 *                 example: OUTDOOR
 *               step:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 9
 *                 description: 1-9 master step being persisted
 *               certificationPurpose:
 *                 type: string
 *               certificationPurposes:
 *                 type: array
 *                 items:
 *                   type: string
 *               previousCertNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Draft saved; returns draftId + applicationNumber + per-step validation summary
 *       401:
 *         description: AUTH_ERROR — missing or invalid token
 *       403:
 *         description: HEALTH_ROLE_REQUIRED — provider tokens are rejected
 *       500:
 *         description: Failed to save application
 */
router.post('/draft', authenticateHealth, async (req, res) => {
    try {
        // V1-D D2: explicit HEALTH-role gate. The auth middleware is the
        // permissive `authenticateAny` alias; without this check a
        // provider token would create drafts as if it were an applicant.
        if (rejectIfNotHealthRole(req, res)) { return; }
        const healthIdentity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const payload = asObject(req.body);
        const serviceType = String(payload.serviceType || 'new_application').trim() || 'new_application';
        const areaType = String(payload.areaType || 'OUTDOOR').trim() || 'OUTDOOR';
        let application = await findOrCreateApplicationForHealth(healthIdentity, req.user, { ...payload, serviceType, areaType }, req.activeEntity);

        const mergedSteps = mergeMasterSteps(application.formData, payload);
        const submittedStep = Number.parseInt(String(payload.step || ''), 10);
        const formData = asObject(application.formData);

        // F-G4-11 — the API door. `step` is a claim about progress; a claim
        // that runs ahead of the data is not honoured. Two different refusals,
        // and the difference is deliberate:
        //
        //  - Step-SCOPED legacy data for an unearned step is REJECTED. That
        //    shape carries data belonging to one numbered step, so refusing it
        //    costs nothing that belongs to any other step.
        //  - The step CLAIM on a canonical whole-store save is CLAMPED, never
        //    rejected. The autosave posts the entire wizard on a 3-second
        //    debounce; rejecting it to punish a wrong number would throw away
        //    a farmer's typing. The data is written either way and
        //    `lastDraftStep` records only what was earned — so a resume can
        //    never be sent to a step the applicant has not reached, which is
        //    the harm a forged claim was worth.
        const stepClaim = evaluateStepClaim(claimedWizardData(formData, payload), payload.step);
        const unearnedLegacyStep = legacyWrittenSteps(payload).find((step) => step > stepClaim.allowedStep);
        if (unearnedLegacyStep !== undefined) {
            return respondStepPrerequisiteUnmet(res, {
                requestedStep: unearnedLegacyStep,
                allowedStep: stepClaim.allowedStep,
            });
        }
        const earnedStep = Number.isFinite(submittedStep)
            ? Math.min(submittedStep, stepClaim.allowedStep)
            : null;

        // F-G4-14 — the autosave's payload is the application. It posts the
        // whole wizard store under `formData` every few seconds; this handler
        // used to read only `payload.steps`, so a farmer who filled eleven
        // document slots and reloaded found all of them empty. What the client
        // sends is written now — but through an ALLOWLIST, never a spread:
        // `formData` is one blob shared with the server's own facts (fees are
        // derived from it, and workflowState / audit outcome / assignment /
        // deadlines live in it), so a spread would let an applicant price and
        // advance their own application. pickWizardOwnedFormData names the
        // wizard's keys and drops everything else — see the list's header for
        // what governs it and where to add a new wizard field.
        //
        // Order matters: stored blob first, the applicant's own keys over it,
        // then the server's stamps last so nothing the client sent can shadow
        // them. Every key NOT on the allowlist keeps its stored value because
        // it never enters the spread at all.
        // F-APPV2-02 — the two answers step 1 asks that the allowlist may NOT carry.
        // `requestType` and `certScope` are server-owned because both can REMOVE
        // requirements, so they do not travel through pickWizardOwnedFormData; they go
        // through a resolver that CHECKS the claim first (a renewal or a replacement has
        // to name a live certificate this platform issued to this caller). It never
        // throws: an unproven claim resolves to NEW — the longer document list — with a
        // Thai notice, because the autosave fires every few seconds and a half-typed
        // certificate number must not cost the applicant their draft.
        const law = await resolveLawDimensions({
            prisma,
            actorUserId: healthIdentity.userId,
            claimed: asObject(payload.formData),
            stored: formData,
        });

        const mergedFormData = {
            ...formData,
            ...pickWizardOwnedFormData(payload.formData),
            steps: mergedSteps,
            lastDraftStep: earnedStep !== null ? earnedStep : formData.lastDraftStep || null,
            lastDraftSavedAt: new Date().toISOString(),
            // After the allowlist on purpose — nothing the client sent may shadow the
            // dimension the server just decided.
            ...law.dimensions,
        };
        const workflowHistory = asArray(application.workflowHistory);
        const updateEvent = buildWorkflowEvent({
            action: 'APPLICATION_DRAFT_SAVED',
            actorId: healthIdentity.userId,
            actorRole: req.user.canonicalRole || req.user.role || 'health',
            // The history records the step that was EARNED, not the one that was
            // asked for, so the audit trail and `lastDraftStep` cannot disagree.
            metadata: { step: earnedStep },
        });

        const fd = asObject(mergedFormData);
        // Legacy single-purpose (kept for backward compat with existing queries/reports)
        const certPurpose = String(fd.certificationPurpose || payload.purpose || '').trim() || null;
        // New multi-select array: the first NON-EMPTY of payload / merged /
        // stored wins, then the legacy single is wrapped.
        // Bug 8.2: the old check was `Array.isArray(payload.certificationPurposes)`,
        // which treats an empty [] as "provided" and preferred it — so a draft-save
        // from a step that doesn't touch purposes (sending []) WIPED the applicant's
        // saved selection. A draft must not lose data.
        // F-G4-14 adds the STORED tier: now that `payload.formData` is written,
        // that same empty array can arrive INSIDE formData and reach `fd`, so
        // without this tier the fixed bug would come back through the new door.
        const purposeCandidates = [payload.certificationPurposes, fd.certificationPurposes, formData.certificationPurposes];
        const savedPurposes = purposeCandidates.find((entry) => Array.isArray(entry) && entry.length > 0);
        const certPurposes = savedPurposes || (certPurpose ? [certPurpose] : []);
        const prevCert = String(fd.previousCertNumber || '').trim() || null;
        const pdpaConsent = Boolean(fd.consentedPDPA);

        // Note: this endpoint patches form fields without changing application.status,
        // so we deliberately omit `status` from the data payload (the previous
        // `status: application.status` line was a no-op that triggered the
        // gacp/no-direct-application-status-write rule unnecessarily).
        application = await applicationService.updateApplicantDraftColumns(application.id, {
            serviceType: application.serviceType || serviceType,
            areaType: String(payload.areaType || application.areaType || areaType).trim() || areaType,
            certificationPurpose: certPurpose,
            certificationPurposes: certPurposes,
            previousCertNumber: prevCert,
            consentedPDPA: pdpaConsent,
            formData: { ...mergedFormData, certificationPurposes: certPurposes },
            workflowHistory: [...workflowHistory, updateEvent],
            updatedBy: healthIdentity.userId,
        });
        // Zod validation for submitted step (non-blocking warnings)
        let stepValidation = null;
        if (Number.isFinite(submittedStep) && submittedStep >= 1 && submittedStep <= 9) {
            const stepData = asObject(mergedSteps[String(submittedStep)]);
            stepValidation = validateStep(submittedStep, stepData);
        }

        res.json({
            success: true,
            data: {
                id: application.id,
                draftId: application.id,
                applicationNumber: application.applicationNumber,
                status: application.status,
                // F-G4-11 — what was actually recorded, plus the frontier the
                // server judged, so a client that asked for too much learns it
                // instead of silently believing the save agreed with it.
                savedStep: earnedStep,
                allowedStep: stepClaim.allowedStep,
                stepClamped: earnedStep !== null && Number.isFinite(submittedStep) && earnedStep !== submittedStep,
                stepsSaved: Object.keys(mergedSteps).length,
                // Non-blocking: the draft SAVED. This says whether the applicant's
                // ประเภทคำขอ answer was granted, and if not, what to fix before submitting.
                lawNotice: law.notice,
                requestType: mergedFormData.requestType || 'NEW',
                certScope: mergedFormData.certScope || 'PLANTING',
                validation: stepValidation ? {
                    step: submittedStep,
                    valid: stepValidation.success,
                    errors: stepValidation.errors || [],
                } : null,
            },
        });
    } catch (error) {
        logger.error('[Applications Draft] Error:', error);
        // AppAudit AC4 (2026-05-15): never echo raw error.message — it may contain
        // PII (Prisma unique-constraint violations name the column AND value).
        return respondError(res, req, error, { message: 'Failed to save application' });
    }
});

/**
 * @swagger
 * /api/applications/submit:
 *   post:
 *     tags: [Applications]
 *     summary: Submit a DRAFT for review (HEALTH role only)
 *     description: |
 *       Transitions the applicant's draft into the canonical review workflow.
 *       Supports the three resubmit paths: DRAFT → PENDING_DOC_FEE,
 *       REVISION_REQUESTED → ASSIGNED_FOR_REVIEW, CAR_PENDING → CAR_REVIEWING.
 *       Workspace capability SUBMIT_APPLICATION is enforced when an active
 *       entity is on the request.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applicationId:
 *                 type: string
 *               draftId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submitted (or already in a submitted state); returns id + applicationNumber + status + nextRequiredAction
 *       403:
 *         description: HEALTH_ROLE_REQUIRED or CAPABILITY_DENIED
 *       404:
 *         description: Application draft not found
 *       409:
 *         description: INVALID_STATUS_FOR_SUBMIT — current status cannot submit
 *       422:
 *         description: APPLICATION_INCOMPLETE — required wizard fields missing
 *       500:
 *         description: Failed to submit application
 */
router.post('/submit', authenticateHealth, requireConsent, async (req, res) => {
    try {
        // V1-D D2: HEALTH-role gate — providers must not submit.
        if (rejectIfNotHealthRole(req, res)) { return; }
        const healthIdentity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const payload = asObject(req.body);
        const requestedId = String(payload.applicationId || payload.draftId || '').trim();

        let draft = await applicationService.findDraftForSubmit({
            applicationId: requestedId || null,
            healthId: healthIdentity.healthId,
        });
        if (!draft) { return res.status(404).json({ success: false, error: 'Application draft not found' }); }

        // M1.5 H4 — one door, one judge (spec 2026-08-15-m1.5-hardening-design.md
        // §H4). The role-in-the-header gate that used to stand here is deleted:
        // it could not see GRANT rows, so it refused real grant holders. Heal a
        // pre-Phase-66 null entityId first (review M2), then let the effective-
        // permission engine decide alone.
        draft = await healApplicationEntityId(draft, healthIdentity);
        let onBehalfOfEntityId = null;
        try {
            ({ entityId: onBehalfOfEntityId } = await assertSubmitAllowed({
                userId: healthIdentity.userId,
                application: draft,
                auditContext: buildSubmitAuditContext(req),
            }));
        } catch (guardErr) {
            if (guardErr instanceof SubmitGuardError) {
                return respondError(res, req, guardErr, { message: guardErr.message });
            }
            throw guardErr;
        }

        const currentStatus = upper(draft.status);
        if (currentStatus === 'PENDING_DOC_FEE') {
            // True no-op echo — the DB already holds this status, nothing to
            // write, nothing to audit.
            return res.json({ success: true, data: { id: draft.id, applicationNumber: draft.applicationNumber, status: 'PENDING_DOC_FEE' }, nextRequiredAction: 'PAY_PHASE_1' });
        }
        if (currentStatus === 'SUBMITTED') {
            // F-SUBMIT-ECHO-LIES fix (task-3, 2026-08-18) — Fix round 1 (Ruling 6):
            // this branch used to hardcode-echo status:'PENDING_DOC_FEE'/
            // nextRequiredAction:'PAY_PHASE_1' without writing anything — the DB
            // row stayed SUBMITTED and zero audit rows were produced (found by a
            // real-DB walk). The FIRST fix (self-heal: auto-advance to
            // PENDING_DOC_FEE here) was WRONG and has been reverted: the bundle
            // submit door (application-bundles.js:523-556) legitimately parks
            // member applications at bare SUBMITTED BY DESIGN — no hop 2, no
            // per-member quotations, because a bundle bills once, not per member.
            // The applicant id-lookup this route uses (findDraftForSubmit /
            // application-applicant-query-methods.js:196-215) carries no status
            // filter and cannot distinguish "stray front-door SUBMITTED" from "a
            // legitimate bundle member" — an auto-advance here would silently
            // pull a bundled member out of its bundle's billing model and mint it
            // an individual (unissued) PENDING_DOC_FEE with no back-edge
            // (workflow-transition-service.js ALLOWED_TRANSITIONS.PENDING_DOC_FEE
            // has no path home to SUBMITTED, :52) — irreversible bundle/member
            // divergence. The lie was the bug; the advance was never required.
            // Perform NO transition — answer with the REAL status this request
            // read from the DB, and an honest nextRequiredAction meaning
            // "still being processed", never a fabricated PAY_PHASE_1.
            return res.json({
                success: true,
                data: { id: draft.id, applicationNumber: draft.applicationNumber, status: 'SUBMITTED' },
                nextRequiredAction: 'WAIT_PROCESSING',
            });
        }

        // Resubmit support — Wave E.1-B (2026-05-03).
        //
        // The original whitelist `['REGISTERED', 'DRAFT']` rejected the
        // two legitimate resubmit paths the state machine allows:
        //   - REVISION_REQUESTED → ASSIGNED_FOR_REVIEW (applicant fixed
        //     issues flagged by document reviewer; goes back to reviewer
        //     queue, no re-payment needed)
        //   - CAR_PENDING → CAR_REVIEWING (applicant submits CAR; goes
        //     back to auditor for review)
        //
        // ALLOWED_TRANSITIONS in workflow-transition-service.js already
        // defines both edges. Without this fix, applicants who got a
        // revision request couldn't re-submit at all — they'd hit the
        // wizard, edit, click Submit, and get an opaque 409 with no
        // recovery path. Production-blocking UX gap.
        //
        // Map: currentStatus → { toStatus, action, message, nextAction }
        const RESUBMIT_TARGET = {
            DRAFT:               { toStatus: 'PENDING_DOC_FEE',     action: 'APPLICATION_SUBMITTED',  reason: 'APPLICATION_SUBMITTED → DOC_FEE_PAYMENT_REQUIRED', nextAction: 'PAY_PHASE_1',     msgTitle: '✅ ส่งคำขอสำเร็จ',       msgBody: 'ถูกส่งเข้าระบบแล้ว กรุณาชำระค่าธรรมเนียมงวดที่ 1' },
            REVISION_REQUESTED:  { toStatus: 'ASSIGNED_FOR_REVIEW', action: 'REVISION_RESUBMITTED',   reason: 'RESUBMIT_AFTER_REVISION',                          nextAction: 'WAIT_FOR_REVIEW', msgTitle: '✅ ส่งคำขอแก้ไขสำเร็จ',  msgBody: 'รอผู้ตรวจเอกสารพิจารณา' },
            CAR_PENDING:         { toStatus: 'CAR_REVIEWING',       action: 'CAR_RESUBMITTED',        reason: 'RESUBMIT_AFTER_CAR',                               nextAction: 'WAIT_FOR_REVIEW', msgTitle: '✅ ส่ง CAR สำเร็จ',     msgBody: 'รอผู้ตรวจสถานที่พิจารณา' },
        };
        const resubmitConfig = RESUBMIT_TARGET[currentStatus];
        if (!resubmitConfig) {
            return res.status(409).json({
                success: false,
                error: 'INVALID_STATUS_FOR_SUBMIT',
                message: `Cannot submit application from status ${draft.status}`,
                messageTh: `ไม่สามารถส่งคำขอจากสถานะ ${draft.status}`,
            });
        }

        // Bug 6.5: a REVISION_REQUESTED / CAR_PENDING resubmit must respect the
        // 5-working-day revision deadline (same rule submitRevision enforces).
        // Past the deadline the application EXPIRES here and the resubmit is
        // rejected — otherwise this front-door /submit path let overdue
        // applicants slip past the window submitRevision guards.
        if (currentStatus === 'REVISION_REQUESTED' || currentStatus === 'CAR_PENDING') {
            const { expired } = await assertRevisionNotExpired(draft, {
                prisma,
                actorUserId: healthIdentity.userId,
                actorRole: req.user.canonicalRole || req.user.role || 'health',
            });
            if (expired) {
                return res.status(400).json({
                    success: false,
                    error: 'Revision deadline exceeded. Application expired.',
                    code: 'REVISION_DEADLINE_EXCEEDED',
                });
            }
        }

        const currentFormData = asObject(draft.formData);
        const mergedSteps = mergeMasterSteps(currentFormData, payload);

        // C2 — validation is gated on the PAYLOAD SHAPE, not run blindly.
        // Ruling 7 (task-3 fix round 1): the legacy-vs-canonical decision and
        // both validator calls live in validateSubmissionPayload — the exact
        // gate the revision door's DRAFT leg now also runs, so an incomplete
        // filing cannot reach PENDING_DOC_FEE (and mint quotations) through
        // that door either. Both failure shapes still return the same
        // { errorsByStep } envelope the FE consumes.
        const validation = validateSubmissionPayload({ currentFormData, payload, application: draft });
        if (!validation.isValid) {
            return res.status(422).json({
                success: false,
                error: 'APPLICATION_INCOMPLETE',
                message: 'กรุณากรอกข้อมูลให้ครบถ้วนก่อนส่งคำขอ',
                errorsByStep: validation.errorsByStep,
                ...(validation.missingFields ? { missingFields: validation.missingFields } : {}),
            });
        }

        const nowIso = new Date().toISOString();
        const workflowHistory = asArray(draft.workflowHistory);

        // For DRAFT, the application passes through SUBMITTED before
        // landing in PENDING_DOC_FEE. The state machine defines this as TWO legal
        // edges (DRAFT→SUBMITTED, SUBMITTED→PENDING_DOC_FEE) and the frontend
        // status-mapping treats SUBMITTED ("ยื่นแล้ว, รอแจ้งชำระ") and
        // PENDING_DOC_FEE ("ชำระค่าธรรมเนียม") as distinct stages. WF-F5: the
        // status COLUMN must walk both hops too — previously it jumped straight
        // to PENDING_DOC_FEE (an illegal DRAFT→PENDING_DOC_FEE edge that only
        // survived because the writer doesn't assert transitions) while the
        // history already recorded the 2-event path, leaving column and history
        // inconsistent. For REVISION_REQUESTED / CAR_PENDING it stays a single
        // direct transition.
        const isInitialSubmit = currentStatus === 'DRAFT';

        // M2a — the document law (spec §3, AC1-3). This door is MIXED: the same
        // URL is the first filing and the two correction resubmits, so the mode
        // is taken from the predicate above rather than guessed from a status
        // inside the service (review H1).
        //
        //   DRAFT               → 'first-submit': read the rules in force NOW,
        //                         refuse what is missing, and stamp the set that
        //                         judged this filing onto formData below.
        //   REVISION_REQUESTED  → 'resubmit': judged by that stamp. A rule the
        //   CAR_PENDING           ministry files tomorrow must not 422 an
        //                         application that was compliant when filed (M-9).
        //
        // Placement: after the idempotent early return (an already-submitted
        // application answers 200 and is never re-judged), after the resubmit
        // target resolves, and before every write in this handler.
        let requirementStamp = null;
        try {
            const { appliedRules } = await assertRequiredDocumentsPresent({
                application: draft,
                mode: isInitialSubmit ? MODE_FIRST_SUBMIT : MODE_RESUBMIT,
            });
            if (isInitialSubmit) {
                requirementStamp = buildRequirementSnapshot(appliedRules);
            }
        } catch (docErr) {
            if (isSubmitGateRefusal(docErr)) {
                return respondSubmitGateRefusal(res, docErr);
            }
            throw docErr;
        }

        // กทล.๑ ส่วนที่ ๔ — nobody's filing is submitted without their certification,
        // and the platform writes the time itself. The client says only "accepted".
        // Placed AFTER the document gate on purpose: a filing missing papers should
        // hear about the papers first, since that is the longer piece of work.
        let declarationsAcceptedAt;
        try {
            ({ acceptedAt: declarationsAcceptedAt } = resolveDeclarationsAcceptance({
                formData: currentFormData,
                payload,
                isFirstSubmit: isInitialSubmit,
            }));
        } catch (declErr) {
            if (declErr && declErr.code === DECLARATIONS_REQUIRED) {
                return res.status(422).json({
                    success: false,
                    error: DECLARATIONS_REQUIRED,
                    code: DECLARATIONS_REQUIRED,
                    message: declErr.message,
                    // `message` is a reserved envelope key and is stripped from every
                    // non-2xx body by the browser client; messageTh survives.
                    messageTh: declErr.messageTh,
                });
            }
            throw declErr;
        }

        if (isInitialSubmit) {
            // A0 / PR-A0-2 — the two hops below are ONE business act ("the
            // applicant submitted"), so they get ONE transaction.
            //
            // Before this, each hop ran on the bare client and therefore in its
            // own implicit transaction (post-PR-A0-1 the writer opens a short
            // internal one so its UPDATE and its canonical audit row stay atomic
            // WITH EACH OTHER — application-status-writer.js:796-816). That fixed
            // the audit hole but not the pair: a failure on hop 2 committed hop 1,
            // parking the application in SUBMITTED with a committed
            // DRAFT→SUBMITTED audit row and no doc-fee leg — a state no reviewer
            // queue polls and the applicant cannot leave.
            //
            // WHAT THIS TRANSACTION DOES AND DOES NOT GUARANTEE — the honest
            // version (PR-A0-2 audit round 1, F4; an earlier revision of this
            // comment claimed everything below "lands or vanishes together",
            // which is false for the audit rows):
            //
            //   ATOMIC — either every one of these commits, or none does:
            //     • the two status UPDATEs (DRAFT→SUBMITTED, SUBMITTED→PENDING_DOC_FEE)
            //     • whatever work-activity rows the writer's fenced block manages
            //       to write (application-status-writer.js:1151+); they join this
            //       transaction and are discarded with it if it rolls back
            //
            //   BEST-EFFORT, NOT ATOMIC — can be absent while the hops commit:
            //     • the two canonical APPLICATION_STATUS_TRANSITION rows. The
            //       writer emits them behind a SAVEPOINT fence that is
            //       deliberately fail-OPEN (`runFencedBestEffort`): if an audit
            //       INSERT fails, the fence unwinds JUST that row and the status
            //       write still commits. So a committed hop with NO canonical row
            //       is a reachable state, by design, until the fail-closed flip
            //       that design-decision.md §2 schedules for the contract PR.
            //       (This is recorded as AMBIGUOUS A6 in design-decision.md —
            //       it is in tension with INVARIANT A0 clause (1) "+1 พอดี".)
            //     • the same is true of the work-activity rows: fenced, so a
            //       failure costs the rows, not the hops.
            //
            // Deliberately OUTSIDE this tx: the quotation issuance below — it is
            // fire-and-forget and idempotent by (applicationId, issuerType), so
            // pulling it in would trade a documented retry for a longer tx.
            //
            // ALSO IN THIS TRANSACTION, and deliberately: the Farm row (F-QA-06). It is
            // written FIRST so both hops can stamp the pointer to it, and it is
            // FAIL-CLOSED — if the farm write fails, the whole submit rolls back, the
            // filing stays DRAFT, and the farmer presses ยื่นคำขอ again. The alternative
            // (best-effort, submit stands without a farm) is exactly the state this fix
            // exists to end: a filing that satisfies documents, both payments,
            // scheduling, photographs and the 24-item checklist, and is then refused at
            // the certificate. Neither branch can leave a half-submitted filing: the two
            // hops are atomic with each other and with this write.
            let materializedFarmId = null;
            await prisma.$transaction(async (tx) => {
                // The farm this filing is about. Only for filings the six-step กทล.๑
                // wizard wrote — a boundary, not a migration (the W14 lesson, one flow
                // over): a legacy-shaped filing states its site in the PREVIOUS
                // wizard's vocabulary, which certificate issuance already reads and
                // mints from (resolveFarmForCertificate), so minting one here would
                // change the meaning of filings already in flight to fix nothing.
                if (isKatorlor1Filing(currentFormData)) {
                    ({ farmId: materializedFarmId } = await materializeFarmForFiling({
                        client: tx,
                        formData: currentFormData,
                        ownerId: healthIdentity.userId,
                        // The application's own dimensions — healApplicationEntityId has
                        // already run, and organizationId is NOT NULL on the row.
                        entityId: draft.entityId ?? null,
                        organizationId: draft.organizationId,
                    }));
                }

                // Hop 1 — DRAFT → SUBMITTED. Carries the full form payload
                // so a reader observing SUBMITTED sees the finalized steps.
                await writeApplicationStatus({
                    prisma: tx,
                    applicationId: draft.id,
                    fromStatus: draft.status,
                    toStatus: 'SUBMITTED',
                    actorId: healthIdentity.userId,
                    actorRole: req.user.canonicalRole || req.user.role || 'health',
                    reason: 'APPLICATION_SUBMITTED',
                    additionalData: {
                        formData: {
                            ...currentFormData,
                            steps: mergedSteps,
                            // M2a — the law that judged this filing, stamped
                            // into the applicant's own blob (spread first, so
                            // nothing of theirs is lost) under a key listed in
                            // SERVER_OWNED_FORM_DATA_KEYS.
                            serverRequirementSnapshot: requirementStamp,
                            declarationsAcceptedAt,
                            // F-QA-06 — the farm this filing is about. The first thing
                            // certificate-service.resolveFarmForCertificate reads, and
                            // the reason a certificate can name where it applies.
                            ...(materializedFarmId ? { farmId: materializedFarmId } : {}),
                            workflowState: 'SUBMITTED',
                            workflowStateUpdatedAt: nowIso,
                            submittedAt: nowIso,
                        },
                        workflowHistory: [
                            ...workflowHistory,
                            buildWorkflowEvent({ action: 'APPLICATION_SUBMITTED', fromStatus: draft.status, toStatus: 'SUBMITTED', actorId: healthIdentity.userId, actorRole: req.user.canonicalRole || req.user.role || 'health' }),
                        ],
                    },
                });

                // Hop 2 — SUBMITTED → PENDING_DOC_FEE (doc-fee payment required).
                // WF-F4: this hop is an automatic system advance into phase-1
                // billing, not a user action — the canonical dictionary §1.3 owns
                // SUBMITTED->PENDING_DOC_FEE under `system`. actorId keeps the
                // triggering applicant for traceability; actorRole is `system` so
                // the audit trail (and any future strict-mode validation) reflects
                // that the platform, not the applicant, performed the advance.
                // ต่ออายุไปรอค่าตรวจพื้นที่โดยตรง ไม่ผ่านด่านตรวจเอกสาร (มติ operator 2026-09-07)
                const entryState = entryStateForSubmission(currentFormData);
                const entryReason = entryState === 'PENDING_AUDIT_FEE'
                    ? 'APPLICATION_SUBMITTED → AUDIT_FEE_PAYMENT_REQUIRED (renewal skips document review)'
                    : 'APPLICATION_SUBMITTED → DOC_FEE_PAYMENT_REQUIRED';
                await writeApplicationStatus({
                    prisma: tx,
                    applicationId: draft.id,
                    fromStatus: 'SUBMITTED',
                    toStatus: entryState,
                    actorId: healthIdentity.userId,
                    actorRole: 'system',
                    reason: entryReason,
                    additionalData: {
                        formData: {
                            ...currentFormData,
                            steps: mergedSteps,
                            // Repeated, not redundant: this hop rebuilds
                            // formData from the PRE-submit copy, so a stamp
                            // written only on hop 1 would be erased by the very
                            // next statement in the same transaction.
                            serverRequirementSnapshot: requirementStamp,
                            declarationsAcceptedAt,
                            // Repeated for the same reason the requirement stamp above
                            // is: this hop rebuilds formData from the PRE-submit copy,
                            // so a key written only on hop 1 would be erased by the very
                            // next statement in the same transaction.
                            ...(materializedFarmId ? { farmId: materializedFarmId } : {}),
                            workflowState: entryState,
                            workflowStateUpdatedAt: nowIso,
                            submittedAt: nowIso,
                        },
                        workflowHistory: [
                            ...workflowHistory,
                            buildWorkflowEvent({ action: 'APPLICATION_SUBMITTED', fromStatus: draft.status, toStatus: 'SUBMITTED', actorId: healthIdentity.userId, actorRole: req.user.canonicalRole || req.user.role || 'health' }),
                            buildWorkflowEvent({
                                action: entryState === 'PENDING_AUDIT_FEE' ? 'AUDIT_FEE_PAYMENT_REQUIRED' : 'DOC_FEE_PAYMENT_REQUIRED',
                                fromStatus: 'SUBMITTED', toStatus: entryState,
                                actorId: healthIdentity.userId, actorRole: 'system',
                            }),
                        ],
                    },
                });
            });
        } else {
            // R2 M7 (D-6): the correction resubmit OVERWRITES Application.formData
            // (EXPAND — the column still holds the latest working copy). In the
            // SAME transaction we ALSO append an immutable
            // CorrectionSubmissionVersion so this round's submitted formData
            // survives the overwrite (keyed off the M3 round ledger). A duplicate
            // round submission (P2002) rolls the whole tx back — the previous
            // version is protected. This is the only correction resubmit branch;
            // the DRAFT initial-submit path above is left untouched.
            const resubmitFormData = {
                ...currentFormData,
                steps: mergedSteps,
                // Carried, not re-stamped: a resubmit stands on the acceptance
                // already recorded, and the gate above returns that same value.
                declarationsAcceptedAt,
                workflowState: resubmitConfig.toStatus,
                workflowStateUpdatedAt: nowIso,
            };
            await prisma.$transaction(async (tx) => {
                await writeApplicationStatus({
                    prisma: tx,
                    applicationId: draft.id,
                    fromStatus: draft.status,
                    toStatus: resubmitConfig.toStatus,
                    actorId: healthIdentity.userId,
                    actorRole: req.user.canonicalRole || req.user.role || 'health',
                    reason: resubmitConfig.reason,
                    additionalData: {
                        formData: resubmitFormData,
                        workflowHistory: [
                            ...workflowHistory,
                            buildWorkflowEvent({ action: resubmitConfig.action, fromStatus: draft.status, toStatus: resubmitConfig.toStatus, actorId: healthIdentity.userId, actorRole: req.user.canonicalRole || req.user.role || 'health' }),
                        ],
                    },
                });
                await snapshotCorrectionSubmission({
                    prisma: tx,
                    applicationId: draft.id,
                    fromStatus: currentStatus,
                    formDataSnapshot: resubmitFormData,
                });
            });
        }
        const updated = await applicationService.getApplicationSlice(draft.id, {
            // `organizationId` is selected for the quotation-failure audit row
            // below. Without it the row falls back to tenant-context /
            // default-org resolution (middleware/audit-logger.js), so the one
            // record that says "this applicant cannot pay" would be filed under
            // the wrong tenant — on the door whose whole point is to be found.
            select: {
                id: true, applicationNumber: true, status: true, organizationId: true,
            },
        });

        // AC3 — the accepted act, and the entity it was made for.
        await logSubmitAccepted({
            req,
            applicationId: draft.id,
            entityId: onBehalfOfEntityId,
            actorId: healthIdentity.userId,
            action: 'APPLICATION_SUBMIT_ACCEPTED',
            extraMetadata: { fromStatus: currentStatus, toStatus: resubmitConfig.toStatus },
        });

        // ระบบเต็มออกใบเสนอราคาให้อัตโนมัติตรงนี้ แล้วผู้ยื่นจ่ายผ่าน Stripe
        // GACP Lite ไม่ออกเอกสารการเงินและไม่รับเงิน — ราคาสองงวดถูกคำนวณและเก็บไว้
        // บนคำขอแล้ว (phase1Amount / phase2Amount) ตั้งแต่ตอนสร้าง และเจ้าหน้าที่จะ
        // เป็นผู้บันทึกว่ารับเงินแล้วที่ POST /api/fees/:id/PHASE_1/confirm
        // สถานะยังเดิน SUBMITTED → PENDING_DOC_FEE เหมือนเดิม เพราะขั้นค่าธรรมเนียม
        // ยังอยู่ — สิ่งที่หายไปคือช่องทางรับเงิน ไม่ใช่ขั้นตอน

        // Applicant-facing notification — message + nextAction differ by
        // resubmit path. Routed through createNotification() so user
        // notification-channel preferences (email/SMS fanout) apply and
        // organizationId is resolved consistently regardless of caller
        // tenant context.
        await createNotification({
            userId: healthIdentity.userId,
            type: 'INFO',
            title: resubmitConfig.msgTitle,
            message: `คำขอเลขที่ ${updated.applicationNumber} ${resubmitConfig.msgBody}`,
            data: {
                applicationId: updated.id,
                applicationNumber: updated.applicationNumber,
                action: resubmitConfig.action,
                nextRequiredAction: resubmitConfig.nextAction,
                fromStatus: currentStatus,
                toStatus: resubmitConfig.toStatus,
            },
        }).catch((notifyErr) => {
            logger.warn('[Applications Submit] notification failed:', notifyErr.message);
        });

        // `fees` เป็นราคาที่ตรึงไว้บนคำขอแล้ว ไม่ใช่ใบเสนอราคา — หน้าจอเอาไปแสดงว่า
        // ต้องชำระเท่าไร ส่วนการรับเงินอยู่นอกระบบนี้
        return res.json({
            success: true,
            data: updated,
            nextRequiredAction: resubmitConfig.nextAction,
            fees: {
                phase1Amount: updated.phase1Amount,
                phase2Amount: updated.phase2Amount,
                currency: 'THB',
            },
        });
    } catch (error) {
        logger.error('[Applications Submit] Error:', error);
        return respondError(res, req, error, { message: 'Failed to submit application' });
    }
});

router.post('/prepare', authenticateHealth, async (req, res) => {
    try {
        // V1-D D2: HEALTH-role gate — provider tokens denied.
        if (rejectIfNotHealthRole(req, res)) { return; }
        const healthIdentity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const payload = asObject(req.body);
        const application = await findOrCreateApplicationForHealth(healthIdentity, req.user, payload, req.activeEntity);
        const existingFormData = asObject(application.formData);
        const mergedSteps = mergeMasterSteps(existingFormData, payload);

        // F-G4-11 — /prepare accepts step-SCOPED legacy data (mergeMasterSteps
        // reads `steps: { "7": … }` here exactly as POST /draft does), so it is
        // a per-step door and gets the same refusal.
        //
        // What it deliberately does NOT do is refuse an INCOMPLETE application.
        // Completeness at this end of the wizard already has an owner: POST
        // /submit judges the whole canonical filing against a strictly higher
        // bar (validateCanonicalSubmission + the mandatory-document law) and
        // 422s with per-step errors. A second, looser completeness gate here
        // would be the same decision written twice (CLAUDE.md L4), and it would
        // change what this route accepts: `applications-prepare-active-entity`
        // and `applications-prepare-server-owned-fields` both exercise it with
        // deliberately partial payloads, because saving part of an application
        // is what it is for. Nothing is filed by preparing.
        const preparedFormData = { ...existingFormData, ...stripServerOwnedKeys(payload) };
        const prepareClaim = evaluateStepClaim(preparedFormData, LAST_FLOW_STEP);
        const unearnedPreparedStep = legacyWrittenSteps(payload).find((step) => step > prepareClaim.allowedStep);
        if (unearnedPreparedStep !== undefined) {
            return respondStepPrerequisiteUnmet(res, {
                requestedStep: unearnedPreparedStep,
                allowedStep: prepareClaim.allowedStep,
            });
        }

        const nowIso = new Date().toISOString();
        const workflowHistory = asArray(application.workflowHistory);

        // Wave C PR-5 — primary source of truth for Application.entityId is
        // the active-entity context (set by the picker via x-active-entity-id
        // header → middleware → req.activeEntity). The wizard no longer
        // re-types company info on every submission; it derives applicantType
        // from the active workspace.
        //
        // M1.5 H1 — the legacy materialise fallback that stood here is GONE.
        // It rebuilt an org Entity out of whatever registration number
        // the request body carried and made the caller its OWNER, and by
        // construction it only fired when req.activeEntity was absent, i.e. when
        // the active-entity middleware had fail-opened. Workspaces are created
        // through POST /api/entities only. Spec §H1.
        //
        // Remaining fallback: pre-Phase-66 rows whose entityId is still null —
        // keep the existing application's value as last-resort default.
        const nextEntityId = req.activeEntity?.entityId || application.entityId;

        const updated = await applicationService.updateApplicantDraftColumns(application.id, {
            entityId: nextEntityId,
            // stripServerOwnedKeys: formData is one blob shared by the wizard and
            // by staff/server writers, so spreading the raw body let an applicant
            // write the audit outcome, their own auditor assignment, their own CAR
            // and revision deadlines, and adminOverrides on their own application.
            // certificate-service reads formData.auditResult + auditedAt as proof
            // of a passing audit, so that pair in particular was a forgeable gate.
            // Stripping at the edge means existingFormData's server-owned values
            // survive the spread untouched.
            formData: { ...existingFormData, ...stripServerOwnedKeys(payload), steps: mergedSteps, lastPreparedAt: nowIso, workflowState: existingFormData.workflowState || application.status || 'DRAFT' },
            workflowHistory: [...workflowHistory, buildWorkflowEvent({ action: 'APPLICATION_PREPARED', actorId: healthIdentity.userId, actorRole: req.user.canonicalRole || req.user.role || 'health' })],
            updatedBy: healthIdentity.userId,
        }, {
            select: { id: true, applicationNumber: true, status: true },
        });

        return res.json({ success: true, data: updated });
    } catch (error) {
        logger.error('[Applications Prepare] Error:', error);
        return respondError(res, req, error, { message: 'Failed to prepare application' });
    }
});

router.post('/draft-documents', authenticateHealth, receiveDraftDocument, async (req, res) => {
    try {
        // V1-D D2: HEALTH-role gate — only applicants upload their own
        // draft documents.
        if (rejectIfNotHealthRole(req, res)) { return; }
        const payload = asObject(req.body);
        const slotId = String(payload.slotId || '').trim() || null;
        const uploadedFile = req.file;
        if (!uploadedFile) {
            // storage-service fileFilter rejects a spoofed/dangerous file via
            // cb(null,false) + a stashed reason (NOT a throw) so this returns a clean
            // 400 with the specific Thai reason instead of a 500 (drill fast-follow).
            if (req.uploadRejectionReason) {
                return res.status(400).json({ success: false, error: req.uploadRejectionCode || 'UPLOAD_REJECTED', message: req.uploadRejectionReason });
            }
            return res.status(400).json({ success: false, error: 'FILE_REQUIRED' });
        }

        // F-G4-08 — read what is actually in the file, and judge it against what
        // THIS slot accepts, before anything is created that would point at it.
        // The mimetype and the filename extension the fileFilter above checked
        // are both written by the sender; the leading bytes are not. A refused
        // file is unlinked, so a rejection leaves nothing behind.
        //
        // The Thai sentence goes in BOTH `error` and `message`: api-client reads
        // `error` for what it shows the user, and a farmer who somehow reaches
        // this door past the browser check must still be told the cause and the
        // next action, not "อัปโหลดไม่สำเร็จ".
        const contentVerdict = await uploadContentGuard.inspectStoredUpload(uploadedFile, slotId);
        if (!contentVerdict.ok) {
            await uploadContentGuard.discardRejectedUpload(uploadedFile);
            return res.status(400).json({
                success: false,
                error: contentVerdict.message,
                code: contentVerdict.code,
                message: contentVerdict.message,
            });
        }

        const healthIdentity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const application = await findOrCreateApplicationForHealth(healthIdentity, req.user, payload, req.activeEntity);

        const fileUrl = toUploadedFileUrl(uploadedFile);
        // multer decodes multipart filenames as latin1 → Thai filenames arrive
        // mojibake; recover the UTF-8 name before persisting/returning it (the
        // applicant sees this name back on the preview page).
        const safeFileName = storageService.decodeMultipartFilename(uploadedFile.originalname);
        const documentId = crypto.randomUUID();
        const stepKey = String(payload.stepKey || '').trim() || null;
        const nowIso = new Date().toISOString();
        const formData = asObject(application.formData);
        const existingDocs = asArray(formData.draftDocuments);
        // F-G4-15 — a slot holds one document, so a re-upload REPLACES the
        // entry that is there. Both sides go through the alias table
        // (validation-slot-utils): 'LICENSE_PT11' and 'license_pt11' are one
        // slot everywhere else in the system — in the mandatory-document
        // check, in the requirement snapshot, in application_documents — so a
        // raw string compare here was the one place where two spellings of
        // ภท.11 could sit in a farmer's list at the same time.
        //
        // An upload with no slotId replaces nothing: it belongs to no slot.
        const canonicalSlotId = slotId ? getCanonicalSlotId(slotId) : null;
        const filtered = canonicalSlotId
            ? existingDocs.filter((item) => getCanonicalSlotId(String(item?.slotId || '').trim()) !== canonicalSlotId)
            : existingDocs;

        await applicationService.updateApplicantDraftColumns(application.id, {
            formData: { ...formData, draftDocuments: [...filtered, { documentId, fileName: safeFileName, fileUrl, mimeType: uploadedFile.mimetype, size: uploadedFile.size, slotId, stepKey, uploadedAt: nowIso }], lastDraftSavedAt: nowIso },
            updatedBy: healthIdentity.userId,
        });

        // Best-effort dual-write into the relational application_documents store
        // (the fraud-detection scan reads it). Never blocks the upload on failure.
        await applicationDocumentSync.syncApplicationDocument(prisma, {
            applicationId: application.id, documentId, slotId, stepKey,
            fileName: safeFileName, fileUrl, fileSize: uploadedFile.size,
            mimeType: uploadedFile.mimetype, uploadedBy: healthIdentity.userId,
            absolutePath: uploadedFile.path,
        });

        return res.json({ success: true, data: { applicationId: application.id, draftId: application.id, documentId, fileName: safeFileName, fileUrl, mimeType: uploadedFile.mimetype, size: uploadedFile.size } });
    } catch (error) {
        // multer เขียนไฟล์ลงดิสก์ไปแล้วก่อนที่ handler จะเริ่มทำงาน · ถ้าเราปฏิเสธทีหลัง
        // ไฟล์นั้นจะค้างอยู่โดยไม่มีแถวในฐานข้อมูล ไม่มีเจ้าของ ไม่มีนาฬิกาเก็บรักษา และ
        // คำขอลบตาม PDPA หามันไม่เจอ
        //
        // วัดจริง 2026-09-09: อัปโหลดล้มเหลว 2 ครั้ง เหลือไฟล์กำพร้า 2 ไฟล์ ไฟล์ละ 2,430
        // ไบต์ · บนระบบจริงที่ผู้ยื่นอัปบัตรประชาชนหรือโฉนดผิดสถานะ นั่นคือเอกสารส่วนบุคคล
        // ค้างบนดิสก์ที่ไม่มีใครรู้ว่ามีอยู่
        //
        // ลบแบบ best-effort: ถ้าลบไม่ได้ก็บันทึกไว้ แต่ยังตอบผู้ใช้ด้วยเหตุผลจริงของ
        // ความล้มเหลวเดิม ไม่ใช่เหตุผลของการเก็บกวาด
        if (req.file?.path) {
            try {
                await fsPromises.unlink(req.file.path);
            } catch (cleanupError) {
                if (cleanupError?.code !== 'ENOENT') {
                    logger.warn('[Applications Draft Documents Upload] ลบไฟล์ที่อัปโหลดค้างไม่สำเร็จ', {
                        path: req.file.path, reason: cleanupError?.message,
                    });
                }
            }
        }
        logger.error('[Applications Draft Documents Upload] Error:', error);
        return respondError(res, req, error, { message: 'Failed to upload draft document' });
    }
});

router.get('/draft-documents', authenticateHealth, async (req, res) => {
    try {
        const healthIdentity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const application = await findOrCreateApplicationForHealth(healthIdentity, req.user, asObject(req.query), req.activeEntity);
        const formData = asObject(application.formData);
        return res.json({ success: true, data: { applicationId: application.id, documents: asArray(formData.draftDocuments) } });
    } catch (error) {
        logger.error('[Applications Draft Documents List] Error:', error);
        return respondError(res, req, error, { message: 'Failed to list draft documents' });
    }
});

router.delete('/draft-documents/:documentId', authenticateHealth, async (req, res) => {
    try {
        const healthIdentity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const application = await findOrCreateApplicationForHealth(healthIdentity, req.user, asObject(req.query), req.activeEntity);
        const formData = asObject(application.formData);
        const existingDocs = asArray(formData.draftDocuments);
        const documentId = String(req.params.documentId || '').trim();
        const removedDocs = existingDocs.filter((item) => String(item?.documentId || '').trim() === documentId);
        const filtered = existingDocs.filter((item) => String(item?.documentId || '').trim() !== documentId);

        await applicationService.updateApplicantDraftColumns(application.id, {
            formData: { ...formData, draftDocuments: filtered, lastDraftSavedAt: new Date().toISOString() },
            updatedBy: healthIdentity.userId,
        });

        // Keep the relational fraud-scan store in sync (best-effort).
        await applicationDocumentSync.removeApplicationDocument(prisma, application.id, documentId);

        // B3 — and remove the BYTES. Dropping the two records while leaving the
        // file on disk did not merely fail to delete it: the
        // `application_documents` row deleted above is the owner record
        // /uploads/application-drafts/* is authorized against, so the orphan it
        // left was readable by any logged-in user. The gate now fails closed
        // (middleware/uploads-access.js), but an applicant who presses delete on
        // a mis-attached ID-card scan is asking for the file to be gone, so
        // delete it. Same confinement as the wizard delete
        // (controllers/wizard-controller.js): the path is derived from the
        // stored fileUrl and proved to live under the uploads root first, so a
        // poisoned record cannot turn this into an arbitrary file delete.
        await Promise.all(removedDocs.map((doc) => unlinkStoredDraftDocument(doc, application.id, documentId)));

        return res.json({ success: true, data: { applicationId: application.id, documentId, deleted: existingDocs.length !== filtered.length } });
    } catch (error) {
        logger.error('[Applications Draft Documents Delete] Error:', error);
        return respondError(res, req, error, { message: 'Failed to delete draft document' });
    }
});

/**
 * @swagger
 * /api/applications/draft:
 *   get:
 *     tags: [Applications]
 *     summary: Fetch the applicant's latest open DRAFT (HEALTH role)
 *     description: Returns the most recent open draft for the authenticated HEALTH user, or null when none exists.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Draft payload (data is null when no open draft exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     draftId:
 *                       type: string
 *                     applicationNumber:
 *                       type: string
 *                     areaType:
 *                       type: string
 *                     serviceType:
 *                       type: string
 *                     status:
 *                       type: string
 *                     formData:
 *                       type: object
 *                     steps:
 *                       type: object
 *       401:
 *         description: AUTH_ERROR — missing or invalid token
 *       500:
 *         description: Failed to fetch draft
 */
router.get('/draft', authenticateHealth, async (req, res) => {
    try {
        const healthIdentity = await applicationService.resolveHealthIdentity(req.user.id, getHealthScopeOptions(req.user));
        const draft = await applicationService.getLatestOpenDraftForApplicant(healthIdentity.healthId);
        if (!draft) { return res.json({ success: true, data: null }); }

        const formData = asObject(draft.formData);
        res.json({ success: true, data: { id: draft.id, draftId: draft.id, applicationNumber: draft.applicationNumber, areaType: draft.areaType, serviceType: draft.serviceType, formData, steps: asObject(formData.steps), status: draft.status, createdAt: draft.createdAt, updatedAt: draft.updatedAt } });
    } catch (error) {
        logger.error('[Applications Draft GET] Error:', error);
        return respondError(res, req, error, { message: 'Failed to fetch draft' });
    }
});

router.delete('/draft/:id', authenticateHealth, async (req, res) => {
    try {
        // V1-D D2: HEALTH-role gate — provider tokens denied.
        if (rejectIfNotHealthRole(req, res)) { return; }
        const deleted = await applicationService.deleteDraft(req.user.id, req.params.id, getHealthScopeOptions(req.user));
        return res.json({ success: true, data: { deleted: Boolean(deleted), draftId: deleted?.id || String(req.params.id || '').trim() || null } });
    } catch (error) {
        logger.error('[Applications Draft DELETE] Error:', error);
        return respondError(res, req, error, { message: 'Failed to delete draft' });
    }
});

// LISTING & TRACKING (extracted to application-listing-handlers.js)

const listingHandlers = require('./application-listing-handlers');
router.use('/', listingHandlers);

// WORKFLOW: REJECT, GET BY ID, REVISION, PDF (extracted to application-workflow-handlers.js)

const workflowHandlers = require('./application-workflow-handlers');
router.use('/', workflowHandlers);

// REQUIREMENTS: the one lens every surface reads (extracted to requirements.js)

const requirementsHandlers = require('./requirements');
router.use('/', requirementsHandlers);

module.exports = router;
