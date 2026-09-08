const { normalizeHealthDashboardStage } = require('../../../shared/health-dashboard-stage');

function mapHealthApplication(app) {
    const certificateCount = Array.isArray(app?.certificates) ? app.certificates.length : 0;
    const hasCertificate = certificateCount > 0;
    const dashboardStage = normalizeHealthDashboardStage({
        status: app?.status,
        phase1Status: app?.phase1Status,
        phase2Status: app?.phase2Status,
        workflowState: app?.formData?.workflowState || null,
        formData: app?.formData,
        hasCertificate,
        certificateCount,
    }, { hasCertificate, certificateCount });

    return {
        id: app.id,
        applicationNumber: app.applicationNumber,
        plantName: app.plantName || (app.formData?.plantName),
        serviceType: app.serviceType,
        status: app.status,
        workflowState: app.formData?.workflowState || null,
        phase1Status: app.phase1Status || null,
        phase2Status: app.phase2Status || null,
        estimatedFee: app.estimatedFee,
        createdAt: app.createdAt,
        submittedAt: app.submittedAt,
        dashboardStage,
        hasCertificate,
        // 2026-04-30 — surface the revision deadline so the list view can
        // show a countdown badge for REVISION_REQUESTED without an extra
        // round-trip per row. ISO string or null.
        revisionDueAt: app.formData?.revisionDueAt || null,
        // CAR deadline (Corrective Action Report) — same purpose, different
        // formData key. Camel + snake-case fallback because both shapes
        // exist in the DB depending on which provider handler wrote it.
        carDueAt: app.formData?.carDueAt || app.formData?.car_due_at || null,
    };
}

function getHealthScopeOptions(user) {
    const healthId = String(user?.healthId || '').trim();
    if (healthId) {
        return { healthId, strictHealthId: true };
    }
    return { strictHealthId: true };
}

function getActorIdentity(user) {
    const providerId = String(user?.providerId || '').trim();
    if (providerId) {
        return providerId;
    }

    const healthId = String(user?.healthId || '').trim();
    if (healthId) {
        return healthId;
    }

    return String(user?.id || '').trim() || null;
}

module.exports = {
    mapHealthApplication,
    getHealthScopeOptions,
    getActorIdentity,
};
