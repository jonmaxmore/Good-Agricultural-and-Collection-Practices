/**
 * Application Payload Builders
 *
 * Functions that build API response payloads for application detail,
 * history, tracking, action cards, and deadline display.
 *
 * Extracted from applications.js to comply with ≤ 300 line rule.
 *
 * @module routes/api/helpers/application-payload-builders
 */

const {
    asObject,
    asArray,
    upper,
    TRACKING_STEPS,
    DISPLAY_STATUS_BY_RAW_STATUS,
    STEP_BY_DISPLAY_STATUS,
    TERMINAL_DISPLAY_STATUSES,
    buildStepResponse,
} = require('./application-constants');

// Thai-holiday-aware Asia/Bangkok engine — the SAME one that stamps the
// deadline (#646). The legacy services/working-days-service was holiday-blind
// (sources never seeded), so "เหลือ X วันทำการ" over-counted by one in weeks
// containing a Thai holiday while enforcement (reading the stored stamp) was
// correct.
const {
    countWorkingDaysBetween,
} = require('../../../utils/working-days');

// Workflow SSOT — used to resolve legacy DB status values to a canonical state
// before projecting them to a display bucket.
const { resolveStateFromApplication } = require('../../../services/workflow-transition-service');

// Detail Payload

function buildApplicationDetailPayload(application) {
    const formData = asObject(application?.formData);
    const workflowHistory = asArray(application?.workflowHistory);
    const comments = asArray(application?.comments).map((item) => ({
        id: item.id,
        type: item.type,
        commentText: item.commentText,
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt,
        resolvedBy: item.resolvedBy,
        auditorId: item.auditorId,
        attachments: asArray(item.attachments),
    }));

    return {
        id: application.id,
        applicationId: application.id,
        applicationNumber: application.applicationNumber,
        healthId: application.healthId,
        serviceType: application.serviceType,
        areaType: application.areaType,
        certificationPurpose: application.certificationPurpose || null, // Legacy
        certificationPurposes: Array.isArray(application.certificationPurposes) ? application.certificationPurposes : [], // New
        previousCertNumber: application.previousCertNumber || null,
        consentedPDPA: Boolean(application.consentedPDPA),
        status: application.status,
        workflowState: formData.workflowState || application.status || null,
        workflowStateUpdatedAt: formData.workflowStateUpdatedAt || null,
        submittedAt: formData.submittedAt || null,
        // Canonical phase status — source of truth for "did the user already pay
        // phase 1 / phase 2?". The frontend's resolvePaymentFacts() previously
        // had to guess this from workflow-history text, which fails when an app
        // is in REGISTERED state but phase1 is paid (real prod case 2026-04-28).
        phase1Status: application.phase1Status || null,
        phase1Amount: application.phase1Amount ?? null,
        phase1PaidAt: application.phase1PaidAt || null,
        phase2Status: application.phase2Status || null,
        phase2Amount: application.phase2Amount ?? null,
        phase2PaidAt: application.phase2PaidAt || null,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        steps: buildStepResponse(formData),
        // Hydration-friendly shape for the edit flow.
        //
        // The edit page (apps/web-app/src/app/health/applications/[id]/edit/
        // client-view.tsx) reads `application.formData?.{documents,
        // applicantData, farmData, ...}` to repopulate the wizard store
        // when a user clicks "ดำเนินการต่อ". Without this object the
        // wizard mounts empty — the user reported re-uploading every
        // document despite the DB already holding 29 of them.
        //
        // Whitelist (not the raw formData) so that any fields the
        // wizard doesn't consume (workflow history breadcrumbs, internal
        // flags, debug timestamps) stay out of the response and we don't
        // accidentally leak future internal-only fields.
        formData: {
            plantId: formData.plantId || null,
            serviceType: formData.serviceType || null,
            serviceTypes: asArray(formData.serviceTypes),
            certificationPurpose: formData.certificationPurpose || null,
            certificationPurposes: asArray(formData.certificationPurposes),
            cultivationMethod: formData.cultivationMethod || null,
            cultivationMethods: asArray(formData.cultivationMethods),
            siteTypes: asArray(formData.siteTypes),
            locationType: formData.locationType || null,
            licensePdfUrl: formData.licensePdfUrl || null,
            applicantData: asObject(formData.applicantData),
            generalInfo: asObject(formData.generalInfo),
            farmData: asObject(formData.farmData),
            siteData: asObject(formData.siteData),
            productionData: asObject(formData.productionData),
            harvestData: asObject(formData.harvestData),
            securityData: asObject(formData.securityData),
            cultivationDetails: asObject(formData.cultivationDetails),
            plantTracking: asArray(formData.plantTracking),
            stepDocuments: asArray(formData.stepDocuments),
            plots: asArray(formData.plots),
            lots: asArray(formData.lots),
            documents: asArray(formData.documents),
            youtubeUrl: formData.youtubeUrl || '',
            qrCount: formData.qrCount || 0,
            estimatedQRCost: formData.estimatedQRCost || 0,
            consentedPDPA: Boolean(formData.consentedPDPA),
            acknowledgedStandards: Boolean(formData.acknowledgedStandards),
            // Used by the wizard's edit-mode banner to show the reviewer's
            // last revision-request comment.
            _lastReviewComment: formData._lastReviewComment || null,
        },
        metadata: {
            lastDraftStep: formData.lastDraftStep || null,
            lastDraftSavedAt: formData.lastDraftSavedAt || null,
            revisionDueAt: formData.revisionDueAt || formData.revision_due_at || null,
            carDueAt: formData.carDueAt || formData.car_due_at || null,
            workflowHistoryCount: workflowHistory.length,
            commentsCount: comments.length,
        },
        comments,
    };
}

// History Payload

function buildApplicationHistoryPayload(application) {
    const formData = asObject(application?.formData);
    const workflowHistory = asArray(application?.workflowHistory).map((entry, index) => {
        const event = asObject(entry);
        return {
            index: index + 1,
            timestamp: event.timestamp || null,
            action: event.action || null,
            fromStatus: event.fromStatus || null,
            toStatus: event.toStatus || null,
            actorId: event.actorId || null,
            actorRole: event.actorRole || null,
            step: event.step ?? null,
            reason: event.reason || null,
            comment: event.comment || null,
        };
    });
    const comments = asArray(application?.comments).map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        type: item.type,
        commentText: item.commentText,
        auditorId: item.auditorId,
        resolvedAt: item.resolvedAt,
        resolvedBy: item.resolvedBy,
    }));
    const revisionHistory = asArray(formData._revisionHistory);
    const rejectionHistory = asArray(formData._rejectionHistory);

    return {
        applicationId: application.id,
        applicationNumber: application.applicationNumber,
        status: application.status,
        workflowHistory,
        comments,
        revisions: revisionHistory,
        rejections: rejectionHistory,
    };
}

// Display Status & Action Card

function resolveDisplayStatus(application) {
    const status = upper(application?.status);
    const direct = DISPLAY_STATUS_BY_RAW_STATUS[status];
    if (direct) {
        return direct;
    }

    // No `|| status` fallthrough — leaking the raw enum key is how "EXPIRED"
    // reached a farmer's screen untranslated. The column holds canonical states
    // only (PR 2b + 2c), so ask the SSOT — which also handles the case where
    // formData.workflowState leads the status column — and project that.
    // Falling straight to DRAFT would tell someone mid-flow to finish a draft.
    const canonicalState = resolveStateFromApplication(application);
    return DISPLAY_STATUS_BY_RAW_STATUS[canonicalState] || 'DRAFT';
}

function isTerminalDisplayStatus(displayStatus) {
    return TERMINAL_DISPLAY_STATUSES.has(displayStatus);
}

function resolveDeadlinePayload(displayStatus, formData, now) {
    let deadlineAt = null;
    let type = null;

    if (displayStatus === 'REVISION_REQUESTED') {
        deadlineAt = formData.revisionDueAt || formData.revision_due_at || null;
        type = 'REVISION';
    } else if (displayStatus === 'CAR_PENDING') {
        deadlineAt = formData.carDueAt || formData.car_due_at || null;
        type = 'CAR';
    }

    const dueDate = deadlineAt ? new Date(String(deadlineAt)) : null;
    if (!dueDate || !Number.isFinite(dueDate.getTime())) {
        return null;
    }

    const remainingMs = dueDate.getTime() - now.getTime();
    const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
    const remainingWorkingDays = remainingMs <= 0
        ? 0
        : Math.max(0, countWorkingDaysBetween(now, dueDate));

    return {
        type,
        dueAt: dueDate.toISOString(),
        remainingHours,
        remainingWorkingDays,
        isOverdue: remainingMs < 0,
    };
}

function buildActionCard(displayStatus) {
    switch (displayStatus) {
        case 'DRAFT':
            return { key: 'CONTINUE_DRAFT', title: 'Continue draft', enabled: true };
        case 'PENDING_DOC_FEE':
            return { key: 'PAY_DOC_FEE', title: 'Pay 5,535 THB', enabled: true };
        // The applicant has already transferred; showing a "pay" CTA here
        // invites a second transfer for the same invoice.
            return { key: 'WAIT_SLIP_REVIEW', title: 'Payment slip under review', enabled: false };
        case 'REVISION_REQUESTED':
            return { key: 'SUBMIT_REVISION', title: 'Submit revision within 5 working days', enabled: true };
        case 'PENDING_AUDIT_FEE':
            return { key: 'PAY_AUDIT_FEE', title: 'Pay 27,675 THB', enabled: true };
        case 'AUDIT_SCHEDULING':
            return { key: 'WAIT_SCHEDULE', title: 'Waiting for coordinator schedule', enabled: false };
        case 'CAR_PENDING':
            return { key: 'SUBMIT_CAR_EVIDENCE', title: 'Submit CAR evidence', enabled: true };
        case 'CERTIFIED':
            return { key: 'DOWNLOAD_CERTIFICATE', title: 'Download certificate', enabled: true };
        // Terminal — the file is closed and the only way forward is a new
        // application. Falling through to the 'WAITING' default told a
        // rejected applicant to keep waiting for a step that will never come.
        case 'REJECTED':
        case 'EXPIRED':
        case 'CANCEL_EXPIRED':
            return { key: 'REAPPLY', title: 'Reapply required', enabled: true };
        default:
            return { key: 'WAITING', title: 'Waiting for next workflow step', enabled: false };
    }
}

function buildTrackingPayload(application, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const formData = asObject(application?.formData);
    const rawStatus = upper(application?.status);
    const displayStatus = resolveDisplayStatus(application);
    // resolveDisplayStatus only ever returns a key of DISPLAY_STATUS_BY_RAW_STATUS,
    // and assertDisplayMapsAreTotal() guarantees every such value has a step —
    // so this lookup is total and needs no `|| 0` fallback. The `?? 0` is a
    // belt-and-braces coercion, not a fallthrough path.
    const currentStep = STEP_BY_DISPLAY_STATUS[displayStatus] ?? 0;
    const terminal = isTerminalDisplayStatus(displayStatus);

    return {
        applicationId: application.id,
        applicationNumber: application.applicationNumber,
        status: rawStatus || 'DRAFT',
        displayStatus,
        tracking: {
            currentStep,
            totalSteps: TRACKING_STEPS.length,
            // DRAFT and the terminal states share step 0. Without this flag the
            // ladder renders identically for "not started" and "closed", so the
            // UI must branch on `terminal`, never on `currentStep === 0`.
            terminal,
            steps: TRACKING_STEPS.map((step) => ({
                ...step,
                active: !terminal && step.step === currentStep,
                completed: !terminal && step.step < currentStep,
            })),
        },
        actionCard: buildActionCard(displayStatus),
        deadline: resolveDeadlinePayload(displayStatus, formData, now),
        payment: {
            phase1Status: upper(application?.phase1Status || 'PENDING'),
            phase2Status: upper(application?.phase2Status || 'PENDING'),
        },
    };
}

module.exports = {
    buildApplicationDetailPayload,
    buildApplicationHistoryPayload,
    resolveDisplayStatus,
    isTerminalDisplayStatus,
    resolveDeadlinePayload,
    buildActionCard,
    buildTrackingPayload,
};
