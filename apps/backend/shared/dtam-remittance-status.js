'use strict';

/**
 * DTAM pass-through liability lifecycle SSOT — Wave 1
 * (docs/payment-refactor/step2-data-model-design.md v2, approved).
 *
 * Every settled checkout carries a DTAM fee the platform collected as a
 * collection agent (Cr 2151-001 Payable-to-DTAM at settlement). This module
 * is the vocabulary of that liability from birth to clearance:
 *
 *   order:  PENDING → BATCHED → REMITTED → RECONCILED
 *   batch:  OPEN → REMITTED → RECONCILED
 *
 * BATCHED → PENDING is allowed (a batch dissolved before the transfer);
 * nothing moves backwards once REMITTED — the money left the account, and
 * the clearing journal entry (Dr 2151-001 / Cr 1110-001) is already in the
 * hash-chained ledger. RECONCILED is confirmed by bank-reconciliation
 * matching the batch's bankReference to a statement line.
 *
 * String + CHECK per executive decision R1 — the CHECK constraints in
 * migration 20260802150000 mirror these arrays exactly.
 */

const DTAM_REMITTANCE_STATUSES = Object.freeze([
    'PENDING',
    'BATCHED',
    'REMITTED',
    'RECONCILED',
]);

const REMITTANCE_BATCH_STATUSES = Object.freeze([
    'OPEN',
    'REMITTED',
    'RECONCILED',
]);

const ALLOWED_REMITTANCE_TRANSITIONS = Object.freeze({
    PENDING: Object.freeze(['BATCHED']),
    BATCHED: Object.freeze(['REMITTED', 'PENDING']),
    REMITTED: Object.freeze(['RECONCILED']),
    RECONCILED: Object.freeze([]),
});

function canTransitionRemittance(from, to) {
    const targets = ALLOWED_REMITTANCE_TRANSITIONS[from];
    return Array.isArray(targets) && targets.includes(to);
}

function assertRemittanceVocabularyIsTotal() {
    const missing = DTAM_REMITTANCE_STATUSES.filter(
        (s) => !Object.prototype.hasOwnProperty.call(ALLOWED_REMITTANCE_TRANSITIONS, s),
    );
    const unknown = Object.keys(ALLOWED_REMITTANCE_TRANSITIONS)
        .filter((s) => !DTAM_REMITTANCE_STATUSES.includes(s));
    if (missing.length > 0 || unknown.length > 0) {
        throw new Error(
            `[dtam-remittance-status] vocabulary is not total: missing=[${missing}] unknown=[${unknown}]`,
        );
    }
}

assertRemittanceVocabularyIsTotal();

module.exports = {
    DTAM_REMITTANCE_STATUSES,
    REMITTANCE_BATCH_STATUSES,
    ALLOWED_REMITTANCE_TRANSITIONS,
    canTransitionRemittance,
    assertRemittanceVocabularyIsTotal,
};
