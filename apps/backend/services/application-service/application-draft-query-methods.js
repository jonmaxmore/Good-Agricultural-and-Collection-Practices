const { maskThaiId } = require('../../utils/field-encryption');

function createApplicationDraftQueryMethods({
    prisma,
    feeService,
    sendNotification,
    NotifyType,
    logger,
}) {
    const auditTrail = require('../audit-trail');
    return {
        /**
         * Create or Update a Draft Application
         * @param {string} identityRef
         * @param {object} data
         * @returns {Promise<object>} Created/Updated Application
         */
        async saveDraft(identityRef, data, options = {}) {
            const healthIdentity = await this.resolveHealthIdentity(identityRef, options);
            const healthUserId = healthIdentity.userId;
            const actorHealthId = healthIdentity.healthId;
            logger.debug('[ApplicationService.saveDraft] START', { userId: healthUserId, healthIdMasked: maskThaiId(actorHealthId), status: data.status });

            const {
                plantId, plantName,
                purpose, areaType, serviceType,
                applicantData, locationData, productionData, harvestData,
                documents, youtubeUrl,
                requestedInspectionDate,
                estimatedProcessingDays, estimatedFee,
                cultivationMethods,
                personnelHygiene, // [NEW] GACP Hygiene Data
            } = data;

            logger.debug('[ApplicationService.saveDraft] Fields:', { plantId, serviceType, areaType, status: data.status });

            // Validation
            if (!plantId || !serviceType) {
                logger.warn('[ApplicationService.saveDraft] Validation Failed - Missing required fields');
                throw new Error('Missing required fields: plantId, serviceType');
            }

            // Check for existing draft
            logger.debug('[ApplicationService.saveDraft] Checking for existing draft...');
            const existingDraft = await prisma.application.findFirst({
                where: {
                    healthId: actorHealthId,
                    status: 'DRAFT',
                    isDeleted: false,
                },
                orderBy: { createdAt: 'desc' },
            });
            logger.debug('[ApplicationService.saveDraft] Existing Draft:', existingDraft ? 'Found' : 'Not Found');

            // Generate application number if new
            const year = new Date().getFullYear() + 543;
            const globalCount = await prisma.application.count();
            const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
            const applicationNumber = `GACP-${year}-${String(globalCount + 1).padStart(5, '0')}-${timestamp}`;
            const fees = feeService.calculateApplicationFees(data || {
                cultivationMethods,
            });

            const applicationData = {
                healthId: actorHealthId,
                applicationNumber: existingDraft ? undefined : applicationNumber, // Don't overwrite if exists
                serviceType,
                areaType,
                status: 'DRAFT', // Should probably check if completing
                phase1Amount: fees.phase1.total,
                phase2Amount: fees.phase2.total,
                cultivationScopeCount: fees.scopeCount,
                // `totalAreaTypes` is the retired name for the same number.
                // Written in step so a process still serving the previous image
                // prices correctly; the contract migration drops it.
                totalAreaTypes: fees.scopeCount,
                personnelHygiene, // [NEW] Save to top-level column
                formData: {
                    plantId,
                    plantName: plantName || plantId,
                    purpose,
                    applicantData,
                    locationData,
                    farmId: locationData?.farmId || null,
                    productionData,
                    harvestData, // Add Harvest Data
                    documents,
                    youtubeUrl,
                    estimatedFee,
                    estimatedProcessingDays,
                    requestedInspectionDate,
                    submissionDate: new Date(),
                    fees: {
                        phase1: fees.phase1,
                        phase2: fees.phase2,
                        total: fees.total,
                    },
                },
            };

            let application;

            // Determine if this is a submission (status changes from DRAFT to SUBMITTED)
            // Note: The UI usually sets status in the payload, but here it sets 'DRAFT' hardcoded in line 50 of original code.
            // Assuming 'data.status' might be passed or inferred.
            // The original code hardcoded status: 'DRAFT'.
            // If the user INTENDS to submit, we should allow status override or separate submit method.
            // For now, I will modify the status assignment to respect input OR check context.
            // Looking at line 86 of original: if (application.status === 'SUBMITTED')
            // This suggests status WAS mutable or passed in.
            // I'll update line 50 to use data.status or default to DRAFT.

            const targetStatus = data.status || 'DRAFT';
            applicationData.status = targetStatus;

            if (existingDraft) {
                application = await prisma.application.update({
                    where: { id: existingDraft.id },
                    data: applicationData,
                });
            } else {
                application = await prisma.application.create({
                    data: applicationData,
                });
            }

            // Auto-generate Invoice & Notify if Submitted
            if (targetStatus === 'SUBMITTED') {
                // 1. Generate Invoice (which will trigger its own notification)
                await this._generatePhase1Invoice(application, healthIdentity);

                // 2. Notify Application Received
                await sendNotification(healthUserId, NotifyType.APPLICATION_SUBMITTED, {
                    applicationId: application.id,
                    applicationNumber: application.applicationNumber,
                    plantName: application.formData.plantName,
                });

                // 3. Audit trail
                auditTrail.logAction({
                    action: auditTrail.ACTIONS.SUBMIT,
                    entityType: auditTrail.ENTITIES.APPLICATION,
                    entityId: application.id,
                    userId: healthUserId,
                    description: `Application ${application.applicationNumber} submitted`,
                    applicationId: application.id,
                    severity: auditTrail.SEVERITY.INFO,
                });
            }

            return application;
        },

        /**
         * Submit Application (Finalize Step 12)
         * Wraps saveDraft but forces status to SUBMITTED
         */
        async submitApplication(identityRef, data, options = {}) {
            logger.info('[ApplicationService.submitApplication] START', { identityRef, healthIdMasked: maskThaiId(options.healthId) || null, keys: Object.keys(data) });

            // Force status to SUBMITTED
            // This triggers Invoice Generation in saveDraft
            const result = await this.saveDraft(identityRef, { ...data, status: 'SUBMITTED' }, options);

            logger.info('[ApplicationService.submitApplication] SUCCESS', { id: result.id, applicationNumber: result.applicationNumber, status: result.status });

            return result;
        },

        /**
         * Get Current Draft for health account
         * @param {string} identityRef
         */
        async getDraft(identityRef, options = {}) {
            const healthWhere = this.buildHealthWhereClause(identityRef, options);
            if (!healthWhere) {
                return null;
            }

            return prisma.application.findFirst({
                where: {
                    ...healthWhere,
                    status: 'DRAFT',
                    isDeleted: false,
                },
                orderBy: { createdAt: 'desc' },
            });
        },

        /**
         * Soft-delete current draft by id (health-owned only).
         *
         * Wave A fix M2 (adversarial-verify 2026-07-02): the lookup uses the
         * STRICT applicant pin (`strictApplicantPin: true`), never the
         * workspace-relaxed `{ entityId }` where — a workspace co-member must
         * not be able to soft-delete the owner's draft (destructive + no
         * per-person revoke exists pre-Wave-B). Reads (getDraft /
         * getHealthApplications) stay workspace-relaxed.
         * @param {string} identityRef
         * @param {string} draftId
         */
        async deleteDraft(identityRef, draftId, options = {}) {
            const normalizedDraftId = String(draftId || '').trim();
            if (!normalizedDraftId) {
                return null;
            }

            const healthWhere = this.buildHealthWhereClause(identityRef, {
                ...options,
                strictApplicantPin: true,
            });
            if (!healthWhere) {
                return null;
            }

            const existingDraft = await prisma.application.findFirst({
                where: {
                    ...healthWhere,
                    id: normalizedDraftId,
                    status: 'DRAFT',
                    isDeleted: false,
                },
                select: { id: true },
            });

            if (!existingDraft) {
                return null;
            }

            return prisma.application.update({
                where: { id: existingDraft.id },
                data: {
                    isDeleted: true,
                    deletedAt: new Date(),
                },
                select: { id: true },
            });
        },

        /**
         * Get All Applications for health account
         * @param {string} identityRef
         */
        async getHealthApplications(identityRef, options = {}) {
            const healthWhere = this.buildHealthWhereClause(identityRef, options);
            if (!healthWhere) {
                return [];
            }

            const take = Number.isFinite(options.take) && Number(options.take) > 0
                ? Number(options.take)
                : undefined;

            return prisma.application.findMany({
                where: {
                    ...healthWhere,
                    isDeleted: false,
                },
                orderBy: { createdAt: 'desc' },
                ...(take ? { take } : {}),
                include: {
                    certificates: {
                        where: {
                            isDeleted: false,
                            status: { in: ['active', 'ACTIVE'] },
                        },
                        select: {
                            id: true,
                        },
                        take: 1,
                    },
                },
            });
        },

        // Backward-compatible alias (to be removed after full migration)
        async getHealthUserApplications(identityRef, options = {}) {
            return this.getHealthApplications(identityRef, options);
        },

        /**
         * Get Application by ID (With Ownership Check)
         * @param {string} id
         * @param {string} identityRef
         */
        async getById(id, identityRef, options = {}) {
            const where = { id };
            const healthWhere = this.buildHealthWhereClause(identityRef, options);
            if (healthWhere) {
                Object.assign(where, healthWhere);
            }

            return prisma.application.findFirst({
                where,
                include: {
                    applicant: {
                        select: {
                            id: true,
                            healthId: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phoneNumber: true,
                            province: true,
                        },
                    },
                },
            });
        },

        /**
         * Lean ownership lookup for the payments flow. Returns just `{ id, status }`
         * if the application belongs to the given healthId and is not soft-deleted,
         * otherwise null. We deliberately do NOT return applicant fields here —
         * route-level callers (notably finance/payments.js) only need the status
         * to decide which phase invoice to create, and shrinking the result
         * surface keeps PII from accidentally being logged or echoed back.
         */
        async findForPaymentOwnership(applicationId, healthId) {
            if (!applicationId || !healthId) {return null;}
            return prisma.application.findFirst({
                where: { id: applicationId, healthId, isDeleted: false },
                select: { id: true, status: true },
            });
        },

        /**
         * CAR (Corrective Action Request) flow ownership lookup.
         *
         * The applicant relation is the authoritative owner check after JWTs
         * stopped carrying `healthId` (PDPA Phase D prep) — `User.id` is a
         * non-encrypted UUID FK that survives PDPA field encryption, whereas
         * `healthId` may be redacted at the column level depending on tenant.
         * Keeping this lookup here, with the full record (formData, workflow
         * history) the CAR route needs, prevents that route from reaching
         * into the Prisma client directly.
         */
        async findOwnedApplicationForApplicant(applicationId, applicantUserId) {
            if (!applicationId || !applicantUserId) {return null;}
            return prisma.application.findFirst({
                where: {
                    id: applicationId,
                    applicant: { id: applicantUserId },
                },
            });
        },
    };
}

module.exports = { createApplicationDraftQueryMethods };
