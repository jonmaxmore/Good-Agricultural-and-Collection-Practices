'use strict';

/**
 * Round-2 (field-inspection fee) payment gate for on-site audit scheduling.
 *
 * Business rule: a field inspection may not be queued until the round-2 fee is
 * recorded as received. In GACP Lite that record is one FeePayment row written
 * by the auditor (routes/api/fees/fee-payments.js); ROLE_TRANSITIONS grants the
 * PENDING_AUDIT_FEE -> AUDIT_FEE_PAID edge to that role alone, so "state is
 * AUDIT_FEE_PAID" is itself the proof, and the FeePayment row is the second,
 * independent layer — it names the officer who said so.
 *
 * This module exists because the rule had been enforced on one write path and
 * not on its twin. `PATCH /api/audits/:id/schedule` writes the same two
 * columns as the canonical scheduler handler (`scheduledDate`, `auditorId`)
 * and carried neither check, so a SCHEDULER could assign an auditor and an
 * inspection date to an application still in PENDING_AUDIT_FEE. Keeping the
 * predicate in one place is what stops the next writer of those columns from
 * inheriting the same gap.
 *
 * Guarded by __tests__/unit/audits-patch-schedule-phase2-gate.test.js.
 */

const { prisma } = require('../services/prisma-database');
const workflowTransitionService = require('../services/workflow-transition-service');

// The columns the gate needs to reach a verdict. A tenancy lookup that selects
// only `id` cannot gate anything — that narrowing is what disabled the check
// on the PATCH path in the first place, so both call sites share this
// projection rather than hand-rolling one.
const SCHEDULE_GATE_SELECT = Object.freeze({
    id: true,
    status: true,
    phase2Status: true,
    formData: true,
});

const SCHEDULABLE_STATE = 'AUDIT_FEE_PAID';

async function isPhase2PaymentConfirmed(application) {
    if (!application?.id) {
        return false;
    }

    // Two independent readings, and either one is enough — the column can be
    // set by a status write, the row can only be created by the officer's own
    // confirmation. Requiring both would let a repaired column block a real
    // payment; requiring neither is the gap this module exists to close.
    if (String(application?.phase2Status || '').toUpperCase() === 'PAID') {
        return true;
    }
    const confirmed = await prisma.feePayment.findFirst({
        where: { applicationId: application.id, phase: 'PHASE_2' },
        select: { id: true },
    });
    return Boolean(confirmed);
}

/**
 * Resolve whether an on-site inspection may be scheduled for this application.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, error }` rather than
 * throwing, so each route keeps its own response shape and status code.
 */
async function checkSchedulingAllowed(application) {
    if (!application?.id) {
        return { allowed: false, error: 'Application not found' };
    }

    const currentState = workflowTransitionService.resolveStateFromApplication(application);
    if (currentState !== SCHEDULABLE_STATE) {
        return {
            allowed: false,
            error: `Application must be in ${SCHEDULABLE_STATE} before scheduling (current: ${currentState})`,
        };
    }

    if (!(await isPhase2PaymentConfirmed(application))) {
        return { allowed: false, error: 'Phase 2 payment must be confirmed before scheduling' };
    }

    return { allowed: true };
}

module.exports = {
    SCHEDULE_GATE_SELECT,
    SCHEDULABLE_STATE,
    isPhase2PaymentConfirmed,
    checkSchedulingAllowed,
};
