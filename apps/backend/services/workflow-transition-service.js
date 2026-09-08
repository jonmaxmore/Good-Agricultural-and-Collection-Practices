const { normalizeRole, CANONICAL_ROLES } = require('../shared/canonical-rbac');

/**
 * The whole life of a GACP filing, as states.
 *
 * DRAFT → SUBMITTED → PENDING_DOC_FEE → DOC_FEE_PAID → ASSIGNED_FOR_REVIEW
 *       → (DOC_APPROVED | REVISION_REQUESTED ↔ ASSIGNED_FOR_REVIEW)
 *       → PENDING_AUDIT_FEE → AUDIT_FEE_PAID → AUDIT_CONFIRMED
 *       → (AUDIT_PASSED | CAR_PENDING → CAR_REVIEWING | REJECTED)
 *       → APPROVED → CERTIFIED
 *
 * The full platform had two more states, PHASE_1_SLIP_UNDER_REVIEW and
 * PHASE_2_SLIP_UNDER_REVIEW: the applicant uploaded a bank slip and an
 * accountant judged it. Lite has no slip upload and no accountant, so a state
 * meaning "someone is looking at the slip" would never be true. The officer
 * records the fee as received and the filing moves in one step.
 */
const WORKFLOW_STATES = Object.freeze([
  'DRAFT',
  'SUBMITTED',
  'PENDING_DOC_FEE',
  'DOC_FEE_PAID',
  'ASSIGNED_FOR_REVIEW',
  'REVISION_REQUESTED',
  'DOC_APPROVED',
  'PENDING_AUDIT_FEE',
  'AUDIT_FEE_PAID',
  'AUDIT_CONFIRMED',
  'CAR_PENDING',
  'CAR_REVIEWING',
  'AUDIT_PASSED',
  'APPROVED',
  'CERTIFIED',
  'REJECTED',
  'EXPIRED',
  'CANCEL_EXPIRED',
]);


/**
 * Every move the filing is allowed to make. A transition absent from this table
 * cannot happen, whoever asks — see canTransition().
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: new Set(['SUBMITTED']),
  SUBMITTED: new Set(['PENDING_DOC_FEE']),
  // Wave 2 (Stripe-only mandate): the DIRECT edge to the paid state — the
  // verified payment_intent.succeeded webhook settles with no slip-review
  // interlude. The slip edge stays beside it for the drain window (D2) and
  // retires with the slip pipeline.
  // R2 M5 (payment-abandonment cron): an unpaid Phase-1 checkout that sits past
  // its dueDate long enough (config threshold) AND has been fully reminded is
  // auto-closed to EXPIRED. SYSTEM-only edge (see ROLE_TRANSITIONS) — the cron
  // is the sole walker; no human role owns it. Mirrors the deadline-cron
  // EXPIRED edges (REVISION_REQUESTED/CAR_PENDING) established for M4/WF-F4.
  PENDING_DOC_FEE: new Set(['DOC_FEE_PAID', 'EXPIRED']),
  DOC_FEE_PAID: new Set(['ASSIGNED_FOR_REVIEW']),
  // Allow reviewer to approve or request revision directly
  ASSIGNED_FOR_REVIEW: new Set(['DOC_APPROVED', 'REVISION_REQUESTED']),
  REVISION_REQUESTED: new Set(['ASSIGNED_FOR_REVIEW', 'EXPIRED']),
  DOC_APPROVED: new Set(['PENDING_AUDIT_FEE']),
  // Wave 2: direct Stripe-settle edge; slip edge stays for the drain window.
  // R2 M5: the Phase-2 payment-gate twin of the PENDING_DOC_FEE->EXPIRED edge
  // above. SYSTEM-only; same payment-abandonment auto-close.
  PENDING_AUDIT_FEE: new Set(['AUDIT_FEE_PAID', 'EXPIRED']),
  AUDIT_FEE_PAID: new Set(['AUDIT_CONFIRMED']),
  AUDIT_CONFIRMED: new Set(['AUDIT_PASSED', 'CAR_PENDING', 'REJECTED']),
  CAR_PENDING: new Set(['CAR_REVIEWING', 'EXPIRED']),
  CAR_REVIEWING: new Set(['AUDIT_PASSED', 'CAR_PENDING']),
  AUDIT_PASSED: new Set(['APPROVED', 'CAR_REVIEWING']),
  APPROVED: new Set(['CERTIFIED']),
  CERTIFIED: new Set(),
  REJECTED: new Set(),
  // Waiver-reopen (owner ruling 2026-07-08): EXPIRED is no longer a dead end.
  // A once-per-application, DTAM-side-accountant-approved special case reopens
  // the application BACK to the exact state it expired from (server-derived
  // snapshot — never caller-chosen: revision-expired → CAR_PENDING would skip
  // the unpaid Phase-2 gate straight toward cert issuance). The edges are
  // owned by SYSTEM only (see ROLE_TRANSITIONS) — no human role can walk them
  // directly; execution happens inside waiver-reopen-service after the
  // DTAM-side approval. docs/handoffs/waiver-reopen-decision-2026-07-08.md.
  EXPIRED: new Set(['REVISION_REQUESTED', 'CAR_PENDING']),
  // Deprecated terminal — deadline-expiry now resolves to EXPIRED. Retained as a
  // valid terminal for legacy records but no code path writes it anymore.
  CANCEL_EXPIRED: new Set(),
});

/**
 * Role-based transition permissions
 * Format: "FROM_STATE->TO_STATE"
 * Admin can do anything (checked separately).
 * System/webhook transitions are also checked separately.
 */
const ROLE_TRANSITIONS = Object.freeze({
  [CANONICAL_ROLES.HEALTH]: new Set([
    'DRAFT->SUBMITTED',
    'REVISION_REQUESTED->ASSIGNED_FOR_REVIEW',
    'CAR_PENDING->CAR_REVIEWING',
  ]),
  // Lite has no accountant and no scheduler. The officer who owns the next step
  // is the one who records that its fee arrived — operator ruling 2026-09-08,
  // "เจ้าหน้าที่กดยืนยันเอง". Phase 1 belongs to the document reviewer, phase 2
  // to the field auditor, so neither can move the other's half of the pipeline.
  [CANONICAL_ROLES.DOCUMENT_REVIEWER]: new Set([
    'PENDING_DOC_FEE->DOC_FEE_PAID',
    'DOC_FEE_PAID->ASSIGNED_FOR_REVIEW',
    'ASSIGNED_FOR_REVIEW->DOC_APPROVED',
    'ASSIGNED_FOR_REVIEW->REVISION_REQUESTED',
  ]),
  [CANONICAL_ROLES.AUDITOR]: new Set([
    'PENDING_AUDIT_FEE->AUDIT_FEE_PAID',
    'AUDIT_FEE_PAID->AUDIT_CONFIRMED',
    'ASSIGNED_FOR_REVIEW->DOC_APPROVED',
    'ASSIGNED_FOR_REVIEW->REVISION_REQUESTED',
    'AUDIT_CONFIRMED->AUDIT_PASSED',
    'AUDIT_CONFIRMED->CAR_PENDING',
    'AUDIT_CONFIRMED->REJECTED',
    'CAR_REVIEWING->AUDIT_PASSED',
    'CAR_REVIEWING->CAR_PENDING',
    'AUDIT_PASSED->APPROVED', // Consolidated from HEAD_AUDITOR
    'AUDIT_PASSED->CAR_REVIEWING', // auditor reverses a premature pass; voids the issued cert
    // Product decision (2026-06-05): single-auditor auto-issue. The on-site auditor
    // who records the PASS issues the certificate directly — the cert is auto-minted
    // on the AUDIT_PASSED write (see application-status-writer.js cert hook). The
    // former two-person ISO/IEC 17065 §7.6 SoD gate on AUDIT_PASSED->APPROVED was
    // REMOVED: APPROVED + CERTIFIED are ordinary auditor-owned edges — NO second
    // auditor and NO approver≠evaluator constraint (admin is not in the workflow).
    'APPROVED->CERTIFIED',
  ]),
  // HEAD_AUDITOR transitions removed — consolidated into AUDITOR above
  //
  // WF-F4: SYSTEM is the non-human actor for automatic advances (post-submit
  // billing chain) and cron-driven expiry. The canonical workflow dictionary
  // (docs/architecture/2026-05-04-canonical-workflow-status-dictionary.md §1.3)
  // documents these as system-owned. Encoding them here makes ROLE_TRANSITIONS
  // the single source of truth for EVERY actor — so strict-mode validation
  // (assertTransition / buildTransitionUpdate) narrows system to exactly these
  // edges instead of either rejecting it or letting it perform any edge-legal
  // move. APPROVED->CERTIFIED is now owned by the AUDITOR role (the certification
  // body issues the certificate; admin is NOT part of the workflow) — see the
  // auditor grant above. CANCEL_EXPIRED is omitted too (deprecated terminal,
  // no live incoming edge in ALLOWED_TRANSITIONS).
  [CANONICAL_ROLES.SYSTEM]: new Set([
    'SUBMITTED->PENDING_DOC_FEE',       // submit hop-2 auto-advance (phase-1 billing)
    'DOC_APPROVED->PENDING_AUDIT_FEE',  // auto-chain after doc approval (phase-2 billing)
    // The two payment gates are exited by an OFFICER in Lite, not by a webhook —
    // there is no gateway to send one. See the DOCUMENT_REVIEWER / AUDITOR rows.
    'REVISION_REQUESTED->EXPIRED',      // revision-deadline cron expiry
    'CAR_PENDING->EXPIRED',             // CAR-deadline cron expiry
    // R2 M5 — payment-abandonment cron (jobs/payment-closure-job.js). SYSTEM
    // auto-closes an unpaid checkout that is >config-threshold calendar days
    // past due AND fully reminded (3 PaymentReminderLog types). Marker
    // closedReason=PAYMENT_ABANDONED; NOT reopen-eligible (reopen unbuilt).
    'PENDING_DOC_FEE->EXPIRED',         // Phase-1 checkout abandoned
    'PENDING_AUDIT_FEE->EXPIRED',       // Phase-2 checkout abandoned
    // Waiver-reopen execution (owner ruling 2026-07-08) — SYSTEM-only by
    // design: the human decisions (inspector request + DTAM-side accountant
    // approval) are recorded on the WaiverReopenRequest row and in the
    // AuditLog; the state walk itself is performed by the service as SYSTEM
    // (mirrors #532 where ACCOUNT approves a slip and SYSTEM advances the
    // phase). Granting these edges to ACCOUNT would expand its workflow
    // powers beyond the 4 slip edges (P0-E drift class).
    'EXPIRED->REVISION_REQUESTED',      // waiver-reopen (revision-expired)
    'EXPIRED->CAR_PENDING',             // waiver-reopen (CAR-expired)
  ]),
});

// Statuses that require mandatory comment when transitioning TO them.
const REQUIRES_COMMENT_TARGETS = new Set([
  'REVISION_REQUESTED',
  'CAR_PENDING',
  'REJECTED',
]);

// Statuses where user (health) can edit form/upload documents.
const EDITABLE_STATUSES = new Set([
  'DRAFT',
  'REVISION_REQUESTED',
  'CAR_PENDING',
]);

// Revision/CAR loops are UNLIMITED — the only constraint is the 5-working-day
// revision deadline.  If the deadline expires the application moves to EXPIRED
// and the applicant must start a new application with a new Phase 1 payment.
// (Loop limits removed per business rule change 2026-03-22)

// Import shared utilities from the shared layer (not routes — fixes dependency inversion)
const { safeObject, safeArray } = require('../shared/safe-coerce');
const { buildWorkflowEvent } = require('../shared/workflow-event-builder');

/**
 * Resolve caller input to a canonical workflow state, or null.
 *
 * Fail-closed. Two alias tables used to sit between the input and this
 * answer — STATE_INPUT_ALIASES (16 legacy spellings plus 18 canonical
 * lowercase entries that toUpperCase already handles) and
 * STATE_BY_LEGACY_STATUS (27 legacy spellings plus the same 20 identity
 * entries again). They existed because writers kept producing values the
 * state machine could not name; PR 2b stopped that, so a value that is not
 * canonical is now a defect rather than history, and resolving it to
 * "something" would only hide the defect.
 */
function normalizeWorkflowStateInput(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const upper = raw.toUpperCase();
  return WORKFLOW_STATES.includes(upper) ? upper : null;
}

/**
 * Expand states to the raw `status` values a query must match.
 *
 * Identity now: the column holds canonical states only, so a state matches
 * exactly itself. Retained as a named function because callers read better
 * for it and because it is the seam where a future compatibility need would
 * go — but it no longer fans a state out to a dozen historical spellings,
 * several of which no row ever held.
 */
function resolveRawStatusesForStates(values) {
  const requestedStates = Array.isArray(values) ? values : [values];
  return Array.from(new Set(
    requestedStates.map((value) => normalizeWorkflowStateInput(value)).filter(Boolean),
  ));
}

function resolveStateFromApplication(application) {
  const formData = safeObject(application?.formData);
  const stored = normalizeWorkflowStateInput(formData.workflowState);
  if (stored) {
    return stored;
  }
  return normalizeWorkflowStateInput(application?.status) || 'DRAFT';
}

function canTransition(fromState, toState, opts = undefined) {
  const allowed = ALLOWED_TRANSITIONS[fromState];
  if (!allowed || !allowed.has(toState)) {
    return false;
  }
  // WF-F4: optional role check. Backward compatible — callers that pass only
  // (from, to) get the edge-legality answer exactly as before. When an
  // `actorRole` is supplied (the strict-mode writer does this), the move must
  // ALSO be permitted for that role per ROLE_TRANSITIONS. As of the SYSTEM
  // grant, `system` is a first-class entry in ROLE_TRANSITIONS and is narrowed
  // to its documented automatic/cron edges. ADMIN is the only privileged actor
  // that still falls through here (it has NO ROLE_TRANSITIONS entry and is
  // gated by the `force` flag in buildTransitionUpdate instead); genuinely
  // unknown roles also fall through on edge legality.
  if (opts && opts.actorRole) {
    const canonicalRole = normalizeRole(opts.actorRole);
    // Only enforce the role gate for roles that participate in ROLE_TRANSITIONS
    // (now including system). Admin / unknown roles fall through on edge legality.
    if (canonicalRole && ROLE_TRANSITIONS[canonicalRole]) {
      return canRoleTransition(canonicalRole, fromState, toState);
    }
  }
  return true;
}

function canRoleTransition(role, fromState, toState) {
  const canonicalRole = normalizeRole(role);
  if (!canonicalRole) {
    return false;
  }
  const permissions = ROLE_TRANSITIONS[canonicalRole];
  if (!permissions) {
    return false;
  }
  return permissions.has(`${fromState}->${toState}`);
}

/**
 * Check if an application form is editable given its current status
 * @param {string} status - Current application status
 * @returns {boolean}
 */
function isApplicationEditable(status) {
  return EDITABLE_STATUSES.has(normalizeWorkflowStateInput(status));
}

function buildTransitionUpdate({
  application,
  toState,
  actorId,
  actorRole,
  reasonCode = null,
  comment = null,
  metadata = null,
  force = false,
}) {
  const nextState = normalizeWorkflowStateInput(toState);
  if (!nextState) {
    throw new Error(`Invalid workflow state: ${toState}`);
  }

  const fromState = resolveStateFromApplication(application);
  if (fromState === nextState) {
    throw new Error(`Application already in workflow state ${nextState}`);
  }

  const canonicalRole = normalizeRole(actorRole);
  if (!canonicalRole) {
    throw new Error('Unknown actor role');
  }

  if (force && canonicalRole !== CANONICAL_ROLES.ADMIN) {
    throw new Error('Only admin can force workflow transition');
  }

  if (!force && !canTransition(fromState, nextState)) {
    throw new Error(`Invalid transition ${fromState} -> ${nextState}`);
  }

  if (!force && !canRoleTransition(canonicalRole, fromState, nextState)) {
    throw new Error(`Role ${canonicalRole} cannot transition ${fromState} -> ${nextState}`);
  }

  // Product decision 2026-06-05: the former two-person certification gate
  // (ISO/IEC 17065 §7.6 SoD on AUDIT_PASSED -> APPROVED) has been removed. The
  // on-site auditor who records a PASS issues the certificate directly — the
  // certificate is auto-minted on the AUDIT_PASSED write (see
  // application-status-writer.js cert hook). AUDIT_PASSED -> APPROVED is now an
  // ordinary auditor-owned edge with no approver≠evaluator constraint.

  // Mandatory comment check
  if (!force && REQUIRES_COMMENT_TARGETS.has(nextState) && !comment?.trim()) {
    throw new Error(`Transition to ${nextState} requires a mandatory comment`);
  }

  const formData = safeObject(application.formData);
  const workflowHistory = safeArray(application.workflowHistory);
  // The status column and the canonical state are the same vocabulary now —
  // LEGACY_STATUS_BY_STATE was 20 identity entries doing nothing but adding a
  // lookup between a value and itself.
  const nextLegacyStatus = nextState;

  const transitionEvent = buildWorkflowEvent({
    action: force ? 'WORKFLOW_FORCE_TRANSITION' : 'WORKFLOW_TRANSITION',
    fromState,
    toState: nextState,
    fromStatus: application.status || null,
    toStatus: nextLegacyStatus || null,
    actorId,
    actorRole: canonicalRole,
    reasonCode,
    comment,
    metadata,
  });

  return {
    previousState: fromState,
    nextState,
    nextLegacyStatus,
    transitionEvent,
    updateData: {
      status: nextLegacyStatus,
      updatedBy: actorId || null,
      formData: {
        ...formData,
        workflowState: nextState,
        workflowStateUpdatedAt: transitionEvent.timestamp,
      },
      workflowHistory: [...workflowHistory, transitionEvent],
    },
  };
}

// APPLICATION_STATUSES (frozen dictionary, previously in workflow-state-machine.js)
const APPLICATION_STATUSES = Object.freeze(
  WORKFLOW_STATES.reduce((acc, s) => { acc[s] = s; return acc; }, {}),
);

// InvalidTransitionError (previously in status-machine.js)
class InvalidTransitionError extends Error {
  constructor(entity, from, to, allowedTransitions = []) {
    super(
      `Invalid ${entity} transition: "${from}" → "${to}". ` +
      `Allowed from "${from}": [${allowedTransitions.join(', ')}]`,
    );
    this.name = 'InvalidTransitionError';
    this.entity = entity;
    this.from = from;
    this.to = to;
    this.allowedTransitions = allowedTransitions;
  }
}

// validateTransition (previously in status-machine.js)
function validateTransition(entity, fromRaw, toRaw) {
  // Keep the raw upper-cased value when normalization fails so the thrown
  // InvalidTransitionError names what the caller actually passed.
  const from = normalizeWorkflowStateInput(fromRaw) || String(fromRaw || '').toUpperCase();
  const to = normalizeWorkflowStateInput(toRaw) || String(toRaw || '').toUpperCase();

  if (!canTransition(from, to)) {
    const allowed = ALLOWED_TRANSITIONS[from];
    const allowedList = allowed ? [...allowed] : [];
    throw new InvalidTransitionError(entity, from, to, allowedList);
  }
}

module.exports = {
  WORKFLOW_STATES,
  APPLICATION_STATUSES,
  ALLOWED_TRANSITIONS,
  ROLE_TRANSITIONS,
  REQUIRES_COMMENT_TARGETS,
  EDITABLE_STATUSES,
  normalizeWorkflowStateInput,
  resolveRawStatusesForStates,
  resolveStateFromApplication,
  canTransition,
  canRoleTransition,
  isApplicationEditable,
  buildTransitionUpdate,
  validateTransition,
  InvalidTransitionError,
};
