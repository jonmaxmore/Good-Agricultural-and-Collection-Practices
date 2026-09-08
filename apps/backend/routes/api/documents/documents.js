/**
 * Document Verification Routes
 * Handles AI/OCR verification of uploaded documents
 */
const express = require('express');
const { safeErrorMessage } = require('../../../shared/api-response');
const router = express.Router();
const path = require('path');
const documentAnalysisService = require('../../../services/document-analysis-service');
const documentService = require('../../../services/document-service');
const authModule = require('../../../middleware/auth-middleware');
const logger = require('../../../shared/logger');

// Helper to resolve file path safe-ish
const _UPLOADS_DIR = path.join(__dirname, '../../../../uploads'); // Assuming apps/backend/uploads or root/uploads? wrapper needed.
// Better: use the same logic as upload-middleware or config.
// For now, allow relative path from project root or absolute if sensible.

// Use upload middleware to handle file from FormData
const upload = require('../../../middleware/upload-middleware');

/**
 * Detokenize STAGE A (RFC docs/handoffs/national-id-detokenize-rfc-2026-06-29.md,
 * breaker 3c): Application.healthId is an FK to User.canonicalId and stores the
 * keyed-HMAC TOKEN once APP_FK_USE_TOKEN is on (LIVE on prod 2026-06-29), while
 * req.user.healthId is the DECRYPTED PLAINTEXT national ID. Passing the
 * plaintext as the ownership predicate never matches the token → the documents
 * list came back empty and the /documents/[id] viewer 404'd for every
 * applicant. Scope by the `applicant: { id }` relation join (User.id is a UUID
 * that is never re-keyed → correct in BOTH data states); the fallback is the
 * live FK key (canonicalId), never the plaintext.
 */
function buildApplicantDocScope(user) {
    return {
        userId: String(user?.userId || user?.id || '').trim() || undefined,
        healthId: String(user?.canonicalId || '').trim() || undefined,
    };
}

/**
 * GET /api/documents
 * List documents for authenticated user
 */
router.get('/', authModule.authenticateHealth, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Get documents from applications (draft documents). Goes through
        // document-service so the soft-delete + ownership predicates live
        // at the service boundary (Batch 15 prisma-bypass cleanup). STAGE-A
        // token-safe scope — see buildApplicantDocScope above; the plaintext
        // national ID (req.user.healthId) must never reach a query.
        const applications = await documentService.listApplicantApplicationsForDraftDocs(
            buildApplicantDocScope(req.user),
        );

        const documents = [];
        for (const app of applications) {
            const formData = app.formData && typeof app.formData === 'object' ? app.formData : {};
            const draftDocs = Array.isArray(formData.draftDocuments) ? formData.draftDocuments : [];
            for (const doc of draftDocs) {
                documents.push({
                    id: doc.documentId || doc.id,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    type: doc.stepKey || 'application',
                    applicationId: app.id,
                    applicationNumber: app.applicationNumber,
                    uploadedAt: doc.uploadedAt,
                });
            }
        }

        return res.json({
            success: true,
            data: documents,
            total: documents.length,
        });
    } catch (error) {
        logger.error('[Documents] List Error:', error);
        return res.status(500).json({ success: false, error: safeErrorMessage(error) });
    }
});

/**
 * GET /api/documents/:id
 * Single document detail for the health /documents/[id] viewer.
 *
 * A "document" = a draftDocuments[] entry in Application.formData. Ownership is
 * enforced at the service boundary (findApplicantDraftDocument only scans the
 * caller's own owner-scoped applications), so a cross-owner / nonexistent id
 * yields 404 (anti-IDOR) — never a fabricated document.
 */
router.get('/:id', authModule.authenticateHealth, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // STAGE-A token-safe ownership scope — see buildApplicantDocScope above.
        // Empty scope fails closed inside the service (null → 404).
        const document = await documentService.findApplicantDraftDocument(
            buildApplicantDocScope(req.user),
            req.params.id,
        );
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        return res.json({ success: true, data: document });
    } catch (error) {
        logger.error('[Documents] Get-by-id Error:', error);
        return res.status(500).json({ success: false, error: safeErrorMessage(error) });
    }
});

/**
 * POST /api/documents/verify
 * Verify an uploaded document
 * Accepts multipart/form-data: { file, expectedType }
 */
router.post('/verify', authModule.authenticateHealth, upload.single('file'), async (req, res) => {
    try {
        const { expectedType } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'File is required' });
        }

        logger.info(`[AI] Verifying document: ${file.filename} as ${expectedType}`);

        // Call the AI Service with the absolute path from multer
        const result = await documentAnalysisService.verifyUploadedDocument(file.path, expectedType || 'UNKNOWN');

        // Map service response to frontend expectation
        const responseData = {
            verification: {
                isMatch: result.valid,
                confidence: result.confidencePercent,
                message: result.valid ? 'Document Verified' : (result.issues?.[0] || 'Verification failed'),
            },
            extractedData: result.extractedData,
            raw: result,
        };

        res.json({
            success: true,
            data: responseData,
        });

    } catch (error) {
        logger.error('[AI] Verification Failed:', error);
        res.status(500).json({ success: false, error: safeErrorMessage(error) });
    }
});

module.exports = router;
