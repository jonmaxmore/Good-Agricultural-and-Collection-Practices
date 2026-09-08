'use strict';

/**
 * GET /api/applications/:id/requirements — the one lens, over the wire.
 *
 * Every APPLICANT surface that has to say "which papers does this filing still need"
 * reads THIS door: the 6-step wizard's per-step cards (T6-T9) and the server-truth
 * review page (T11). Before it existed each of them computed its own answer in its own
 * language, and a farmer could be told ครบ by the wizard and ไม่ครบ by the submit gate in
 * the same minute.
 *
 * The officer's per-slot checklist (T12-T13) reads the SAME lens but not this door: a
 * staff token authenticates here and then resolves to a healthId that owns no filing,
 * so every application would answer 404. T12 opens the officer's own door
 * (GET /api/provider/applications/:id/document-check) with the reviewer guard the rest
 * of the provider tree uses. The lens is shared; the ownership question is not.
 *
 * Ownership is resolved the way every other applicant-facing application door resolves
 * it (the pattern copied from GET /:id/pdf in application-workflow-handlers.js): the
 * healthId comes from the token through resolveHealthIdentity, never from the request,
 * and the row is read scoped by it. A filing that is not yours answers 404 rather than
 * 403 — the same anti-probe convention the rest of this tree follows, so that asking
 * about someone else's application cannot even confirm that it exists.
 */

const express = require('express');

const router = express.Router();

const { prisma } = require('../../../services/prisma-database');
const logger = require('../../../shared/logger');
const { respondError } = require('../../../shared/api-response');
const { authenticateAny: authenticateHealth } = require('../../../middleware/auth-middleware');
const applicationService = require('../../../services/application-service');
const { getHealthScopeOptions } = require('../helpers/applications-helpers');
const {
    resolveApplicationRequirements,
} = require('../../../services/application-requirements-service');

router.get('/:id/requirements', authenticateHealth, async (req, res) => {
    try {
        const applicationId = req.params.id;
        const identity = await applicationService.resolveHealthIdentity(
            req.user.id,
            getHealthScopeOptions(req.user),
        );

        const application = await prisma.application.findFirst({
            where: { id: applicationId, healthId: identity.healthId, isDeleted: false },
            include: { entity: true },
        });
        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }

        // The rows the sync service keeps, which is where a document uploaded under an
        // old slot name still lives. formData.draftDocuments is read by the lens itself.
        const documentRows = await prisma.applicationDocument.findMany({
            where: { applicationId: application.id },
            select: {
                documentType: true,
                fileUrl: true,
                fileName: true,
                createdAt: true,
                currentForSlot: true,
                supersededAt: true,
            },
        });

        const data = await resolveApplicationRequirements(application, documentRows);
        // appliedRules / requiredSlotIds are the submit gate's business (they carry raw
        // rule rows); the wire contract is what a surface needs to render.
        const { appliedRules: _appliedRules, requiredSlotIds: _requiredSlotIds, ...payload } = data;

        // ?includeReviews=1 — what the OFFICER asked this applicant to fix.
        //
        // Only the current round, and only the MORE_REQUESTED rows. An applicant
        // never sees the internals of a row the officer ACCEPTED: those carry the
        // reviewer's id and their working notes, which are the officer's record
        // of their own decision, not correspondence addressed to the applicant.
        // What the applicant needs is the ask — which paper, why, and by when.
        if (String(req.query.includeReviews || '') === '1') {
            let requestedDocuments = [];
            try {
                // eslint-disable-next-line global-require
                const { nextRound } = require('../../../services/application-document-review-service');
                const reviews = await prisma.applicationDocumentReview.findMany({
                    where: { applicationId: application.id },
                    orderBy: { createdAt: 'asc' },
                });
                const round = nextRound(reviews);
                requestedDocuments = reviews
                    .filter((r) => r.round === round && r.verdict === 'MORE_REQUESTED')
                    .map((r) => ({
                        slotId: r.slotId,
                        reason: r.reason,
                        dueDate: r.dueDate,
                        requestedAt: r.createdAt,
                    }));
            } catch (reviewErr) {
                // The table may not exist yet where the migration has not been
                // applied. An applicant should still see their document list; the
                // absence of the ask is reported, never faked as "nothing asked".
                logger.warn(`[requirements] reviews unavailable for ${application.id}: ${reviewErr && reviewErr.message}`);
                return res.json({ success: true, data: { ...payload, requestedDocuments: null } });
            }
            return res.json({ success: true, data: { ...payload, requestedDocuments } });
        }

        return res.json({ success: true, data: payload });
    } catch (error) {
        logger.error('[Applications requirements] Error:', error);
        return respondError(res, req, error, { message: 'Failed to resolve document requirements' });
    }
});

module.exports = router;
