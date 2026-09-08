-- CreateTable
CREATE TABLE "application_document_reviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT,
    "due_date" TIMESTAMP(3),
    "reviewer_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT NOT NULL,

    CONSTRAINT "application_document_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT,
    "slotId" TEXT,
    "stepKey" TEXT,
    "issuedDate" TIMESTAMP(3),
    "documentType" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "fileHash" TEXT,
    "photoHash" TEXT,
    "idNumber" TEXT,
    "verificationStatus" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "uploadedBy" TEXT,
    "currentForSlot" TEXT,
    "slotVersion" INTEGER NOT NULL DEFAULT 1,
    "supersededAt" TIMESTAMP(3),
    "supersededById" TEXT,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "healthId" TEXT NOT NULL,
    "entityId" TEXT,
    "submitterId" TEXT,
    "serviceType" TEXT NOT NULL DEFAULT 'new_application',
    "areaType" TEXT NOT NULL,
    "certificationPurpose" TEXT,
    "certificationPurposes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previousCertNumber" TEXT,
    "consentedPDPA" BOOLEAN NOT NULL DEFAULT false,
    "standardCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "batchId" TEXT,
    "areaTypeIndex" INTEGER NOT NULL DEFAULT 0,
    "cultivationScopeCount" INTEGER,
    "totalAreaTypes" INTEGER NOT NULL DEFAULT 1,
    "phase1Amount" INTEGER NOT NULL DEFAULT 5885,
    "phase1Status" TEXT NOT NULL DEFAULT 'PENDING',
    "phase1InvoiceId" TEXT,
    "phase1PaidAt" TIMESTAMP(3),
    "phase1ExpiresAt" TIMESTAMP(3),
    "phase2Amount" INTEGER NOT NULL DEFAULT 29425,
    "phase2Status" TEXT NOT NULL DEFAULT 'PENDING',
    "phase2InvoiceId" TEXT,
    "phase2PaidAt" TIMESTAMP(3),
    "phase2ExpiresAt" TIMESTAMP(3),
    "previewData" JSONB,
    "isPreviewReady" BOOLEAN NOT NULL DEFAULT false,
    "reviewerId" TEXT,
    "headAuditorId" TEXT,
    "schedulerId" TEXT,
    "auditorId" TEXT,
    "sameReviewerAuditor" BOOLEAN NOT NULL DEFAULT false,
    "scheduledDate" TIMESTAMP(3),
    "auditResult" TEXT,
    "auditNotes" TEXT,
    "appointmentMode" TEXT,
    "meetingUrl" TEXT,
    "appointmentLocation" TEXT,
    "auditMode" TEXT,
    "auditMeetingUrl" TEXT,
    "auditLocation" TEXT,
    "formData" JSONB,
    "personnelHygiene" JSONB,
    "attachments" JSONB,
    "workflowHistory" JSONB,
    "supplementaryCriteria" JSONB,
    "supplementarySkipped" BOOLEAN NOT NULL DEFAULT false,
    "labResults" JSONB,
    "labResultStatus" TEXT,
    "labName" TEXT,
    "submissionHash" TEXT,
    "idempotencyKey" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdByIp" TEXT,
    "updatedByIp" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "retainUntil" TIMESTAMP(3) NOT NULL DEFAULT (now() + '5 years'::interval),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "closedReason" TEXT,
    "bundleId" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_comments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "internalOnly" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "application_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_drafts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "plantId" TEXT,
    "serviceType" TEXT NOT NULL DEFAULT 'NEW',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "formData" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "application_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_bundles" (
    "id" TEXT NOT NULL,
    "bundleNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "healthId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "application_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resModel" TEXT NOT NULL,
    "resId" TEXT NOT NULL,
    "field" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "fileHash" TEXT,
    "uploadedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_audit_checklist_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auditId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "notes" TEXT,
    "isCritical" BOOLEAN NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "disclosureWithheld" BOOLEAN NOT NULL DEFAULT false,
    "withholdReason" TEXT,
    "withheldBy" TEXT,
    "withheldAt" TIMESTAMP(3),

    CONSTRAINT "farm_audit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_audit_photos" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auditId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "gpsLatitude" DOUBLE PRECISION NOT NULL,
    "gpsLongitude" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "caption" TEXT,
    "farmDistanceMeters" DOUBLE PRECISION,
    "farmDistanceStatus" TEXT,
    "captureTimeSource" TEXT,
    "captureWindowSource" TEXT,
    "captureWindowStatus" TEXT,
    "captureWindowOffsetSec" INTEGER,
    "perceptualHash" TEXT,
    "perceptualHashAlgo" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "checklistItemId" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "farm_audit_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_verification_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reportedLatitude" DOUBLE PRECISION NOT NULL,
    "reportedLongitude" DOUBLE PRECISION NOT NULL,
    "gpsAccuracy" DOUBLE PRECISION,
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "gps_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'USER',
    "actorEmail" TEXT,
    "actorRole" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "metadata" JSONB,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "previousHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_audit_tasks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "documents" JSONB,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "assignedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "post_audit_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_deadlines" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,
    "revisionDue" TIMESTAMP(3) NOT NULL,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "extensionDays" INTEGER,
    "extensionReason" TEXT,
    "extensionApprovedBy" TEXT,
    "extensionApprovedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "revision_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'HEALTH',
    "entityType" TEXT,
    "authType" TEXT NOT NULL DEFAULT 'HEALTH_ID',
    "email" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "healthId" TEXT,
    "healthIdHash" TEXT,
    "healthIdHmac" TEXT,
    "providerId" TEXT,
    "providerIdHash" TEXT,
    "providerIdHmac" TEXT,
    "canonicalId" TEXT NOT NULL,
    "canonicalIdLegacy" TEXT,
    "ministryVerified" BOOLEAN NOT NULL DEFAULT false,
    "ministryVerifiedAt" TIMESTAMP(3),
    "idCard_deprecated" TEXT,
    "idCardHash_deprecated" TEXT,
    "idCardHmac" TEXT,
    "laserCode" TEXT,
    "companyName" TEXT,
    "taxId" TEXT,
    "taxIdHash" TEXT,
    "taxIdHmac" TEXT,
    "representativeName" TEXT,
    "representativePosition" TEXT,
    "communityName" TEXT,
    "communityRegistrationNo" TEXT,
    "communityRegistrationNoHash" TEXT,
    "communityRegistrationNoHmac" TEXT,
    "role" TEXT NOT NULL DEFAULT 'health',
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "accountTier" TEXT NOT NULL DEFAULT 'NORMAL',
    "address" TEXT,
    "province" TEXT,
    "district" TEXT,
    "subdistrict" TEXT,
    "zipCode" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationExpiry" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "sessionsRevokedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdByIp" TEXT,
    "updatedByIp" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "retainUntil" TIMESTAMP(3) NOT NULL DEFAULT (now() + '5 years'::interval),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "anonymizedAt" TIMESTAMP(3),
    "privacySettings" JSONB,
    "notificationSettings" JSONB,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorBackupCodes" JSONB,
    "twoFactorMethod" TEXT DEFAULT 'TOTP',
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "qrData" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "farmName" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "holderDisplayName" TEXT,
    "holderType" TEXT,
    "cropType" TEXT NOT NULL,
    "farmSize" DOUBLE PRECISION NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "subDistrict" TEXT NOT NULL,
    "address" TEXT,
    "standardCode" TEXT,
    "standardId" TEXT NOT NULL,
    "standardName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "validityYears" INTEGER NOT NULL DEFAULT 3,
    "issuedBy" TEXT NOT NULL,
    "pdfGenerated" BOOLEAN NOT NULL DEFAULT false,
    "pdfGeneratedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "verificationCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokedReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspendedReason" TEXT,
    "reinstatedAt" TIMESTAMP(3),
    "reinstatedBy" TEXT,
    "renewedCertificateId" TEXT,
    "previousCertificateId" TEXT,
    "revisionNo" INTEGER NOT NULL DEFAULT 1,
    "revisedAt" TIMESTAMP(3),
    "revisedBy" TEXT,
    "revisionReason" TEXT,
    "documentHash" TEXT,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "signature" TEXT,
    "signatureAlgorithm" TEXT,
    "signatureKeyId" TEXT,
    "signaturePublicKey" TEXT,
    "printHistory" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "retainUntil" TIMESTAMP(3) NOT NULL DEFAULT (now() + '5 years'::interval),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_revisions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certificateId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "documentHash" TEXT,
    "signature" TEXT,
    "signatureAlgorithm" TEXT,
    "signatureKeyId" TEXT,
    "signaturePublicKey" TEXT,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3) NOT NULL,
    "supersededBy" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonText" TEXT,
    "correctedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "certificate_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification_standards" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameTH" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v2024',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "logoUrl" TEXT,
    "targetMarket" TEXT,

    CONSTRAINT "certification_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_requirements" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "standardId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameTH" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "standard_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplementary_criteria" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "categoryTH" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "inputType" TEXT NOT NULL DEFAULT 'checkbox',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "supplementary_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_rounds" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "letterId" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "correction_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_submission_versions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "formDataSnapshot" JSONB NOT NULL,
    "attachmentsSnapshot" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "correction_submission_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_context_switches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "fromEntityId" TEXT,
    "toEntityId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" VARCHAR(512),
    "source" TEXT NOT NULL DEFAULT 'HEADER',
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "entity_context_switches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_member_permission_grants" (
    "membershipId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "reason" TEXT,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "entity_member_permission_grants_pkey" PRIMARY KEY ("membershipId","permission")
);

-- CreateTable
CREATE TABLE "entity_membership_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetUserId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" VARCHAR(512),
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "entity_membership_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT,
    "thaiCitizenId" TEXT,
    "thaiCitizenIdHash" TEXT,
    "thaiCitizenIdHmac" TEXT,
    "juristicId" TEXT,
    "juristicIdHash" TEXT,
    "communityRegNo" TEXT,
    "communityRegNoHash" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdBy" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_memberships" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "entity_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entityId" TEXT,
    "farmName" TEXT NOT NULL,
    "farmType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "subDistrict" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "totalArea" DOUBLE PRECISION NOT NULL,
    "cultivationArea" DOUBLE PRECISION NOT NULL,
    "areaUnit" TEXT NOT NULL DEFAULT 'sqm',
    "cultivationMethod" TEXT NOT NULL,
    "irrigationType" TEXT,
    "soilType" TEXT,
    "waterSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verificationNotes" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "landDocuments" JSONB,
    "sanitationInfo" JSONB,
    "siteHistory" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_analyses" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "farmId" TEXT NOT NULL,
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysisType" TEXT NOT NULL,
    "previousLandUse" TEXT,
    "yearsOfHistory" INTEGER,
    "hasChemicalHistory" BOOLEAN NOT NULL DEFAULT false,
    "chemicalDetails" TEXT,
    "soilPH" DOUBLE PRECISION,
    "soilOrganic" DOUBLE PRECISION,
    "soilNitrogen" DOUBLE PRECISION,
    "soilPhosphorus" DOUBLE PRECISION,
    "soilPotassium" DOUBLE PRECISION,
    "soilHeavyMetals" JSONB,
    "soilReportUrl" TEXT,
    "waterPH" DOUBLE PRECISION,
    "waterEC" DOUBLE PRECISION,
    "waterColiform" DOUBLE PRECISION,
    "waterHeavyMetals" JSONB,
    "waterReportUrl" TEXT,
    "bufferZoneMeters" INTEGER,
    "nearbyPollution" TEXT,
    "floodRisk" TEXT,
    "riskLevel" TEXT,
    "riskDetails" TEXT,
    "mitigationPlan" TEXT,
    "passedCriteria" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "site_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_records" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "farmId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "personRole" TEXT,
    "personIdCard" TEXT,
    "trainingTopic" TEXT NOT NULL,
    "trainingType" TEXT NOT NULL,
    "trainingDate" TIMESTAMP(3) NOT NULL,
    "trainingHours" DOUBLE PRECISION,
    "trainingLocation" TEXT,
    "trainedBy" TEXT,
    "organizerName" TEXT,
    "hasCertificate" BOOLEAN NOT NULL DEFAULT false,
    "certificateNo" TEXT,
    "certificateUrl" TEXT,
    "expiryDate" TIMESTAMP(3),
    "preTestScore" DOUBLE PRECISION,
    "postTestScore" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "recordedBy" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plots" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotCode" TEXT,
    "qrIssuedAt" TIMESTAMP(3),
    "qrRevokedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "areaSqm" DOUBLE PRECISION,
    "area" DOUBLE PRECISION NOT NULL,
    "areaUnit" TEXT NOT NULL DEFAULT 'sqm',
    "solarSystem" TEXT NOT NULL DEFAULT 'OUTDOOR',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "amountThb" INTEGER NOT NULL,
    "externalReference" TEXT,
    "note" TEXT,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_species" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "nameTH" TEXT NOT NULL,
    "nameEN" TEXT,
    "scientificName" TEXT,
    "familyName" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "group" TEXT NOT NULL DEFAULT 'GENERAL',
    "requiresLicense" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "maxYieldPerPlant" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "standardSpacing" TEXT,
    "units" JSONB,
    "plantParts" JSONB,
    "securityRequirements" JSONB,
    "productionInputs" JSONB,
    "gacpCategory" TEXT,
    "dtamPlantCode" TEXT,
    "cultivationType" TEXT DEFAULT 'SELF_GROWN',
    "harvestCycle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plant_species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requirements" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "plantCode" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentNameTH" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "allowedFileTypes" JSONB,
    "maxFileSizeMB" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_rules" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "holderType" TEXT,
    "requestType" TEXT,
    "plantCode" TEXT,
    "landTenure" TEXT,
    "areaType" TEXT,
    "certScope" TEXT,
    "slotId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "maxDocumentAgeMonths" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "reason" TEXT,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "requirement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'GENERAL',
    "metadata" JSONB,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "wizard_step_configs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepKey" TEXT NOT NULL,
    "titleTH" TEXT NOT NULL,
    "titleEN" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "plantGroups" JSONB NOT NULL DEFAULT '["*"]',
    "validationRules" JSONB,
    "componentName" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "wizard_step_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "titleTH" TEXT NOT NULL,
    "titleEN" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredDate" TIMESTAMP(3),
    "htmlTemplate" TEXT NOT NULL,
    "cssOverrides" TEXT,
    "payloadSchema" JSONB,
    "paperSize" TEXT NOT NULL DEFAULT 'A4_LANDSCAPE',
    "orientation" TEXT NOT NULL DEFAULT 'landscape',
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_submissions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "certificateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportMonth" INTEGER NOT NULL,
    "reportYear" INTEGER NOT NULL,
    "formData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "attachmentUrl" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "report_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_of_works" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "standardCode" TEXT NOT NULL DEFAULT 'GACP',
    "inspectionScope" JSONB,
    "estimatedDays" INTEGER NOT NULL DEFAULT 1,
    "assignedAuditorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "scope_of_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_checklists" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sections" JSONB NOT NULL,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "auditorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "audit_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_rooms" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "roomUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'JITSI',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "hostId" TEXT NOT NULL,
    "participantIds" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "recordingUrl" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "meeting_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PRIVATE_CERTIFIER',
    "isolationTier" TEXT NOT NULL DEFAULT 'SHARED',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'th-TH',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "contactEmail" TEXT,
    "legalName" TEXT,
    "taxId" TEXT,
    "taxIdHash" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "retainUntil" TIMESTAMP(3) NOT NULL DEFAULT (now() + '5 years'::interval),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_groups" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "titleTH" TEXT NOT NULL,
    "titleEN" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "role_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_memberships" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "user_group_memberships_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateTable
CREATE TABLE "user_permission_grants" (
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "reason" TEXT,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("userId","permission")
);

-- CreateTable
CREATE TABLE "work_activities" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "candidateGroup" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'TODO',
    "assignedUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "dueAt" TIMESTAMP(3),
    "warningAt" TIMESTAMP(3),
    "warnedAt" TIMESTAMP(3),
    "breachedAt" TIMESTAMP(3),
    "triggeredAtStage" TEXT NOT NULL,
    "note" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "work_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_activity_configs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workflowStage" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "candidateGroup" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "labelTH" TEXT NOT NULL,
    "labelEN" TEXT NOT NULL,
    "descriptionTH" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "stage_activity_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workType" TEXT NOT NULL,
    "targetHours" INTEGER NOT NULL,
    "warningHours" INTEGER,
    "escalationHours" INTEGER,
    "labelTH" TEXT NOT NULL,
    "labelEN" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_document_reviews_applicationId_idx" ON "application_document_reviews"("applicationId");

-- CreateIndex
CREATE INDEX "application_document_reviews_applicationId_round_idx" ON "application_document_reviews"("applicationId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "application_document_reviews_applicationId_slot_id_round_key" ON "application_document_reviews"("applicationId", "slot_id", "round");

-- CreateIndex
CREATE INDEX "application_documents_applicationId_idx" ON "application_documents"("applicationId");

-- CreateIndex
CREATE INDEX "application_documents_documentType_idx" ON "application_documents"("documentType");

-- CreateIndex
CREATE INDEX "application_documents_idNumber_idx" ON "application_documents"("idNumber");

-- CreateIndex
CREATE INDEX "application_documents_photoHash_idx" ON "application_documents"("photoHash");

-- CreateIndex
CREATE UNIQUE INDEX "application_documents_applicationId_currentForSlot_key" ON "application_documents"("applicationId", "currentForSlot");

-- CreateIndex
CREATE UNIQUE INDEX "applications_uuid_key" ON "applications"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "applications_applicationNumber_key" ON "applications"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "applications_phase1InvoiceId_key" ON "applications"("phase1InvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_phase2InvoiceId_key" ON "applications"("phase2InvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_idempotencyKey_key" ON "applications"("idempotencyKey");

-- CreateIndex
CREATE INDEX "applications_healthId_idx" ON "applications"("healthId");

-- CreateIndex
CREATE INDEX "applications_entityId_idx" ON "applications"("entityId");

-- CreateIndex
CREATE INDEX "applications_submitterId_idx" ON "applications"("submitterId");

-- CreateIndex
CREATE INDEX "applications_bundleId_idx" ON "applications"("bundleId");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_applicationNumber_idx" ON "applications"("applicationNumber");

-- CreateIndex
CREATE INDEX "applications_reviewerId_idx" ON "applications"("reviewerId");

-- CreateIndex
CREATE INDEX "applications_headAuditorId_idx" ON "applications"("headAuditorId");

-- CreateIndex
CREATE INDEX "applications_schedulerId_idx" ON "applications"("schedulerId");

-- CreateIndex
CREATE INDEX "applications_auditorId_idx" ON "applications"("auditorId");

-- CreateIndex
CREATE INDEX "applications_organizationId_idx" ON "applications"("organizationId");

-- CreateIndex
CREATE INDEX "applications_rejectCount_idx" ON "applications"("rejectCount");

-- CreateIndex
CREATE INDEX "applications_closedReason_idx" ON "applications"("closedReason");

-- CreateIndex
CREATE INDEX "applications_status_isDeleted_idx" ON "applications"("status", "isDeleted");

-- CreateIndex
CREATE INDEX "applications_healthId_isDeleted_status_idx" ON "applications"("healthId", "isDeleted", "status");

-- CreateIndex
CREATE INDEX "applications_workflowHistory_gin_idx" ON "applications" USING GIN ("workflowHistory");

-- CreateIndex
CREATE INDEX "applications_standardCode_idx" ON "applications"("standardCode");

-- CreateIndex
CREATE INDEX "application_comments_applicationId_idx" ON "application_comments"("applicationId");

-- CreateIndex
CREATE INDEX "application_comments_authorId_idx" ON "application_comments"("authorId");

-- CreateIndex
CREATE INDEX "application_comments_isDeleted_idx" ON "application_comments"("isDeleted");

-- CreateIndex
CREATE INDEX "application_comments_organizationId_idx" ON "application_comments"("organizationId");

-- CreateIndex
CREATE INDEX "application_drafts_userId_idx" ON "application_drafts"("userId");

-- CreateIndex
CREATE INDEX "application_drafts_isDeleted_idx" ON "application_drafts"("isDeleted");

-- CreateIndex
CREATE INDEX "application_drafts_organizationId_idx" ON "application_drafts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_drafts_userId_status_key" ON "application_drafts"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "application_bundles_bundleNumber_key" ON "application_bundles"("bundleNumber");

-- CreateIndex
CREATE INDEX "application_bundles_healthId_idx" ON "application_bundles"("healthId");

-- CreateIndex
CREATE INDEX "application_bundles_isDeleted_idx" ON "application_bundles"("isDeleted");

-- CreateIndex
CREATE INDEX "application_bundles_organizationId_idx" ON "application_bundles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_uuid_key" ON "attachments"("uuid");

-- CreateIndex
CREATE INDEX "attachments_resModel_resId_idx" ON "attachments"("resModel", "resId");

-- CreateIndex
CREATE INDEX "attachments_resModel_resId_field_idx" ON "attachments"("resModel", "resId", "field");

-- CreateIndex
CREATE INDEX "attachments_uploadedBy_idx" ON "attachments"("uploadedBy");

-- CreateIndex
CREATE INDEX "attachments_fileHash_idx" ON "attachments"("fileHash");

-- CreateIndex
CREATE INDEX "attachments_isDeleted_idx" ON "attachments"("isDeleted");

-- CreateIndex
CREATE INDEX "attachments_organizationId_idx" ON "attachments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "farm_audit_checklist_items_auditId_itemCode_key" ON "farm_audit_checklist_items"("auditId", "itemCode");

-- CreateIndex
CREATE INDEX "farm_audit_photos_auditId_idx" ON "farm_audit_photos"("auditId");

-- CreateIndex
CREATE INDEX "farm_audit_photos_organizationId_idx" ON "farm_audit_photos"("organizationId");

-- CreateIndex
CREATE INDEX "farm_audit_photos_attachmentId_idx" ON "farm_audit_photos"("attachmentId");

-- CreateIndex
CREATE INDEX "farm_audit_photos_checklistItemId_idx" ON "farm_audit_photos"("checklistItemId");

-- CreateIndex
CREATE INDEX "farm_audit_photos_uploadedBy_idx" ON "farm_audit_photos"("uploadedBy");

-- CreateIndex
CREATE INDEX "gps_verification_logs_entityType_entityId_idx" ON "gps_verification_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "gps_verification_logs_organizationId_idx" ON "gps_verification_logs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_logId_key" ON "audit_logs"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_currentHash_key" ON "audit_logs"("currentHash");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_category_severity_idx" ON "audit_logs"("category", "severity");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_metadata_idx" ON "audit_logs" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_createdAt_idx" ON "audit_logs"("resourceType", "resourceId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_organizationId_sequenceNumber_key" ON "audit_logs"("organizationId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "post_audit_tasks_applicationId_idx" ON "post_audit_tasks"("applicationId");

-- CreateIndex
CREATE INDEX "post_audit_tasks_status_idx" ON "post_audit_tasks"("status");

-- CreateIndex
CREATE INDEX "post_audit_tasks_dueDate_idx" ON "post_audit_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "post_audit_tasks_organizationId_idx" ON "post_audit_tasks"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "revision_deadlines_applicationId_key" ON "revision_deadlines"("applicationId");

-- CreateIndex
CREATE INDEX "revision_deadlines_applicationId_idx" ON "revision_deadlines"("applicationId");

-- CreateIndex
CREATE INDEX "revision_deadlines_status_idx" ON "revision_deadlines"("status");

-- CreateIndex
CREATE INDEX "revision_deadlines_revisionDue_idx" ON "revision_deadlines"("revisionDue");

-- CreateIndex
CREATE INDEX "revision_deadlines_organizationId_idx" ON "revision_deadlines"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_healthIdHash_key" ON "users"("healthIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_healthIdHmac_key" ON "users"("healthIdHmac");

-- CreateIndex
CREATE UNIQUE INDEX "users_providerIdHash_key" ON "users"("providerIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_providerIdHmac_key" ON "users"("providerIdHmac");

-- CreateIndex
CREATE UNIQUE INDEX "users_canonicalId_key" ON "users"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "users_idCardHash_deprecated_key" ON "users"("idCardHash_deprecated");

-- CreateIndex
CREATE UNIQUE INDEX "users_idCardHmac_key" ON "users"("idCardHmac");

-- CreateIndex
CREATE UNIQUE INDEX "users_taxIdHash_key" ON "users"("taxIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_taxIdHmac_key" ON "users"("taxIdHmac");

-- CreateIndex
CREATE UNIQUE INDEX "users_communityRegistrationNoHash_key" ON "users"("communityRegistrationNoHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_communityRegistrationNoHmac_key" ON "users"("communityRegistrationNoHmac");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_healthId_idx" ON "users"("healthId");

-- CreateIndex
CREATE INDEX "users_providerId_idx" ON "users"("providerId");

-- CreateIndex
CREATE INDEX "users_canonicalId_idx" ON "users"("canonicalId");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_accountType_idx" ON "users"("accountType");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "user_consents_userId_idx" ON "user_consents"("userId");

-- CreateIndex
CREATE INDEX "user_consents_category_idx" ON "user_consents"("category");

-- CreateIndex
CREATE INDEX "user_consents_granted_idx" ON "user_consents"("granted");

-- CreateIndex
CREATE INDEX "user_consents_organizationId_idx" ON "user_consents"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_userId_category_key" ON "user_consents"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_uuid_key" ON "certificates"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificateNumber_key" ON "certificates"("certificateNumber");

-- CreateIndex
CREATE INDEX "certificates_userId_idx" ON "certificates"("userId");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "certificates"("status");

-- CreateIndex
CREATE INDEX "certificates_certificateNumber_idx" ON "certificates"("certificateNumber");

-- CreateIndex
CREATE INDEX "certificates_expiryDate_idx" ON "certificates"("expiryDate");

-- CreateIndex
CREATE INDEX "certificates_isDeleted_idx" ON "certificates"("isDeleted");

-- CreateIndex
CREATE INDEX "certificates_organizationId_idx" ON "certificates"("organizationId");

-- CreateIndex
CREATE INDEX "certificates_applicationId_idx" ON "certificates"("applicationId");

-- CreateIndex
CREATE INDEX "certificates_farmId_idx" ON "certificates"("farmId");

-- CreateIndex
CREATE INDEX "certificates_standardCode_idx" ON "certificates"("standardCode");

-- CreateIndex
CREATE INDEX "certificate_revisions_certificateId_idx" ON "certificate_revisions"("certificateId");

-- CreateIndex
CREATE INDEX "certificate_revisions_organizationId_idx" ON "certificate_revisions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_revisions_certificateId_revisionNo_key" ON "certificate_revisions"("certificateId", "revisionNo");

-- CreateIndex
CREATE UNIQUE INDEX "certification_standards_code_key" ON "certification_standards"("code");

-- CreateIndex
CREATE INDEX "certification_standards_code_idx" ON "certification_standards"("code");

-- CreateIndex
CREATE INDEX "certification_standards_isActive_idx" ON "certification_standards"("isActive");

-- CreateIndex
CREATE INDEX "standard_requirements_standardId_idx" ON "standard_requirements"("standardId");

-- CreateIndex
CREATE INDEX "standard_requirements_category_idx" ON "standard_requirements"("category");

-- CreateIndex
CREATE UNIQUE INDEX "supplementary_criteria_code_key" ON "supplementary_criteria"("code");

-- CreateIndex
CREATE INDEX "supplementary_criteria_category_idx" ON "supplementary_criteria"("category");

-- CreateIndex
CREATE INDEX "supplementary_criteria_isActive_idx" ON "supplementary_criteria"("isActive");

-- CreateIndex
CREATE INDEX "supplementary_criteria_sortOrder_idx" ON "supplementary_criteria"("sortOrder");

-- CreateIndex
CREATE INDEX "correction_rounds_applicationId_stage_idx" ON "correction_rounds"("applicationId", "stage");

-- CreateIndex
CREATE INDEX "correction_rounds_organizationId_idx" ON "correction_rounds"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "correction_rounds_applicationId_stage_roundNo_key" ON "correction_rounds"("applicationId", "stage", "roundNo");

-- CreateIndex
CREATE INDEX "correction_submission_versions_applicationId_stage_idx" ON "correction_submission_versions"("applicationId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "correction_submission_versions_applicationId_stage_roundNo_key" ON "correction_submission_versions"("applicationId", "stage", "roundNo");

-- CreateIndex
CREATE INDEX "entity_context_switches_userId_createdAt_idx" ON "entity_context_switches"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "entity_context_switches_toEntityId_idx" ON "entity_context_switches"("toEntityId");

-- CreateIndex
CREATE INDEX "entity_context_switches_organizationId_idx" ON "entity_context_switches"("organizationId");

-- CreateIndex
CREATE INDEX "entity_context_switches_fromEntityId_idx" ON "entity_context_switches"("fromEntityId");

-- CreateIndex
CREATE INDEX "entity_member_permission_grants_membershipId_idx" ON "entity_member_permission_grants"("membershipId");

-- CreateIndex
CREATE INDEX "entity_member_permission_grants_organizationId_idx" ON "entity_member_permission_grants"("organizationId");

-- CreateIndex
CREATE INDEX "entity_membership_events_entityId_createdAt_idx" ON "entity_membership_events"("entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "entity_membership_events_actorUserId_idx" ON "entity_membership_events"("actorUserId");

-- CreateIndex
CREATE INDEX "entity_membership_events_targetUserId_idx" ON "entity_membership_events"("targetUserId");

-- CreateIndex
CREATE INDEX "entity_membership_events_eventType_idx" ON "entity_membership_events"("eventType");

-- CreateIndex
CREATE INDEX "entity_membership_events_organizationId_idx" ON "entity_membership_events"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "entities_uuid_key" ON "entities"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "entities_slug_key" ON "entities"("slug");

-- CreateIndex
CREATE INDEX "entities_organizationId_idx" ON "entities"("organizationId");

-- CreateIndex
CREATE INDEX "entities_type_idx" ON "entities"("type");

-- CreateIndex
CREATE INDEX "entities_status_idx" ON "entities"("status");

-- CreateIndex
CREATE UNIQUE INDEX "entities_type_thaiCitizenIdHmac_key" ON "entities"("type", "thaiCitizenIdHmac");

-- CreateIndex
CREATE UNIQUE INDEX "entities_type_juristicIdHash_key" ON "entities"("type", "juristicIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "entities_type_communityRegNoHash_key" ON "entities"("type", "communityRegNoHash");

-- CreateIndex
CREATE INDEX "entity_memberships_entityId_idx" ON "entity_memberships"("entityId");

-- CreateIndex
CREATE INDEX "entity_memberships_userId_idx" ON "entity_memberships"("userId");

-- CreateIndex
CREATE INDEX "entity_memberships_status_idx" ON "entity_memberships"("status");

-- CreateIndex
CREATE INDEX "entity_memberships_organizationId_idx" ON "entity_memberships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_memberships_userId_entityId_key" ON "entity_memberships"("userId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "farms_uuid_key" ON "farms"("uuid");

-- CreateIndex
CREATE INDEX "farms_ownerId_idx" ON "farms"("ownerId");

-- CreateIndex
CREATE INDEX "farms_entityId_idx" ON "farms"("entityId");

-- CreateIndex
CREATE INDEX "farms_status_idx" ON "farms"("status");

-- CreateIndex
CREATE INDEX "farms_province_idx" ON "farms"("province");

-- CreateIndex
CREATE INDEX "farms_isDeleted_idx" ON "farms"("isDeleted");

-- CreateIndex
CREATE INDEX "farms_organizationId_idx" ON "farms"("organizationId");

-- CreateIndex
CREATE INDEX "site_analyses_farmId_idx" ON "site_analyses"("farmId");

-- CreateIndex
CREATE INDEX "site_analyses_analysisDate_idx" ON "site_analyses"("analysisDate");

-- CreateIndex
CREATE INDEX "site_analyses_organizationId_idx" ON "site_analyses"("organizationId");

-- CreateIndex
CREATE INDEX "training_records_farmId_idx" ON "training_records"("farmId");

-- CreateIndex
CREATE INDEX "training_records_trainingDate_idx" ON "training_records"("trainingDate");

-- CreateIndex
CREATE INDEX "training_records_trainingType_idx" ON "training_records"("trainingType");

-- CreateIndex
CREATE INDEX "training_records_organizationId_idx" ON "training_records"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "plots_plotCode_key" ON "plots"("plotCode");

-- CreateIndex
CREATE INDEX "plots_farmId_idx" ON "plots"("farmId");

-- CreateIndex
CREATE INDEX "plots_organizationId_idx" ON "plots"("organizationId");

-- CreateIndex
CREATE INDEX "fee_payments_confirmedAt_idx" ON "fee_payments"("confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_applicationId_phase_key" ON "fee_payments"("applicationId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "plant_species_uuid_key" ON "plant_species"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "plant_species_code_key" ON "plant_species"("code");

-- CreateIndex
CREATE INDEX "plant_species_code_idx" ON "plant_species"("code");

-- CreateIndex
CREATE INDEX "plant_species_nameTH_idx" ON "plant_species"("nameTH");

-- CreateIndex
CREATE INDEX "plant_species_isActive_isDeleted_idx" ON "plant_species"("isActive", "isDeleted");

-- CreateIndex
CREATE INDEX "document_requirements_plantCode_requestType_idx" ON "document_requirements"("plantCode", "requestType");

-- CreateIndex
CREATE INDEX "requirement_rules_slotId_idx" ON "requirement_rules"("slotId");

-- CreateIndex
CREATE INDEX "requirement_rules_effectiveFrom_effectiveTo_idx" ON "requirement_rules"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_uuid_key" ON "notifications"("uuid");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_kind_idx" ON "notifications"("userId", "kind");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "system_configs_key_idx" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_step_configs_stepNumber_key" ON "wizard_step_configs"("stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_step_configs_stepKey_key" ON "wizard_step_configs"("stepKey");

-- CreateIndex
CREATE INDEX "wizard_step_configs_isEnabled_idx" ON "wizard_step_configs"("isEnabled");

-- CreateIndex
CREATE INDEX "wizard_step_configs_displayOrder_idx" ON "wizard_step_configs"("displayOrder");

-- CreateIndex
CREATE INDEX "document_templates_code_idx" ON "document_templates"("code");

-- CreateIndex
CREATE INDEX "document_templates_status_idx" ON "document_templates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_code_version_key" ON "document_templates"("code", "version");

-- CreateIndex
CREATE INDEX "report_submissions_certificateId_idx" ON "report_submissions"("certificateId");

-- CreateIndex
CREATE INDEX "report_submissions_userId_idx" ON "report_submissions"("userId");

-- CreateIndex
CREATE INDEX "report_submissions_reportType_idx" ON "report_submissions"("reportType");

-- CreateIndex
CREATE INDEX "report_submissions_status_idx" ON "report_submissions"("status");

-- CreateIndex
CREATE INDEX "report_submissions_reportYear_reportMonth_idx" ON "report_submissions"("reportYear", "reportMonth");

-- CreateIndex
CREATE INDEX "report_submissions_organizationId_idx" ON "report_submissions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "report_submissions_certificateId_reportType_reportMonth_rep_key" ON "report_submissions"("certificateId", "reportType", "reportMonth", "reportYear");

-- CreateIndex
CREATE INDEX "scope_of_works_applicationId_idx" ON "scope_of_works"("applicationId");

-- CreateIndex
CREATE INDEX "scope_of_works_status_idx" ON "scope_of_works"("status");

-- CreateIndex
CREATE INDEX "scope_of_works_isDeleted_idx" ON "scope_of_works"("isDeleted");

-- CreateIndex
CREATE INDEX "scope_of_works_organizationId_idx" ON "scope_of_works"("organizationId");

-- CreateIndex
CREATE INDEX "scope_of_works_assignedAuditorId_idx" ON "scope_of_works"("assignedAuditorId");

-- CreateIndex
CREATE INDEX "audit_checklists_applicationId_idx" ON "audit_checklists"("applicationId");

-- CreateIndex
CREATE INDEX "audit_checklists_auditorId_idx" ON "audit_checklists"("auditorId");

-- CreateIndex
CREATE INDEX "audit_checklists_status_idx" ON "audit_checklists"("status");

-- CreateIndex
CREATE INDEX "audit_checklists_isDeleted_idx" ON "audit_checklists"("isDeleted");

-- CreateIndex
CREATE INDEX "audit_checklists_organizationId_idx" ON "audit_checklists"("organizationId");

-- CreateIndex
CREATE INDEX "meeting_rooms_applicationId_idx" ON "meeting_rooms"("applicationId");

-- CreateIndex
CREATE INDEX "meeting_rooms_scheduledAt_idx" ON "meeting_rooms"("scheduledAt");

-- CreateIndex
CREATE INDEX "meeting_rooms_status_idx" ON "meeting_rooms"("status");

-- CreateIndex
CREATE INDEX "meeting_rooms_isDeleted_idx" ON "meeting_rooms"("isDeleted");

-- CreateIndex
CREATE INDEX "meeting_rooms_organizationId_idx" ON "meeting_rooms"("organizationId");

-- CreateIndex
CREATE INDEX "meeting_rooms_hostId_idx" ON "meeting_rooms"("hostId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_uuid_key" ON "organizations"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_taxIdHash_key" ON "organizations"("taxIdHash");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_isolationTier_idx" ON "organizations"("isolationTier");

-- CreateIndex
CREATE UNIQUE INDEX "role_groups_code_key" ON "role_groups"("code");

-- CreateIndex
CREATE INDEX "user_group_memberships_userId_idx" ON "user_group_memberships"("userId");

-- CreateIndex
CREATE INDEX "user_group_memberships_groupId_idx" ON "user_group_memberships"("groupId");

-- CreateIndex
CREATE INDEX "user_group_memberships_organizationId_groupId_idx" ON "user_group_memberships"("organizationId", "groupId");

-- CreateIndex
CREATE INDEX "user_permission_grants_userId_idx" ON "user_permission_grants"("userId");

-- CreateIndex
CREATE INDEX "user_permission_grants_organizationId_idx" ON "user_permission_grants"("organizationId");

-- CreateIndex
CREATE INDEX "work_activities_applicationId_idx" ON "work_activities"("applicationId");

-- CreateIndex
CREATE INDEX "work_activities_assignedUserId_idx" ON "work_activities"("assignedUserId");

-- CreateIndex
CREATE INDEX "work_activities_state_candidateGroup_idx" ON "work_activities"("state", "candidateGroup");

-- CreateIndex
CREATE INDEX "work_activities_workType_state_idx" ON "work_activities"("workType", "state");

-- CreateIndex
CREATE INDEX "work_activities_organizationId_idx" ON "work_activities"("organizationId");

-- CreateIndex
CREATE INDEX "work_activities_completedBy_idx" ON "work_activities"("completedBy");

-- CreateIndex
CREATE INDEX "stage_activity_configs_workflowStage_isActive_idx" ON "stage_activity_configs"("workflowStage", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "stage_activity_configs_workflowStage_workType_key" ON "stage_activity_configs"("workflowStage", "workType");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_workType_key" ON "sla_policies"("workType");

-- AddForeignKey
ALTER TABLE "application_document_reviews" ADD CONSTRAINT "application_document_reviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_reviews" ADD CONSTRAINT "application_document_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "application_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_healthId_fkey" FOREIGN KEY ("healthId") REFERENCES "users"("canonicalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_standardCode_fkey" FOREIGN KEY ("standardCode") REFERENCES "certification_standards"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_headAuditorId_fkey" FOREIGN KEY ("headAuditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_schedulerId_fkey" FOREIGN KEY ("schedulerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "application_bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_drafts" ADD CONSTRAINT "application_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_drafts" ADD CONSTRAINT "application_drafts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_bundles" ADD CONSTRAINT "application_bundles_healthId_fkey" FOREIGN KEY ("healthId") REFERENCES "users"("canonicalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_bundles" ADD CONSTRAINT "application_bundles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_audit_checklist_items" ADD CONSTRAINT "farm_audit_checklist_items_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audit_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_audit_photos" ADD CONSTRAINT "farm_audit_photos_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audit_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_audit_photos" ADD CONSTRAINT "farm_audit_photos_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "farm_audit_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_audit_photos" ADD CONSTRAINT "farm_audit_photos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_verification_logs" ADD CONSTRAINT "gps_verification_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audit_tasks" ADD CONSTRAINT "post_audit_tasks_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audit_tasks" ADD CONSTRAINT "post_audit_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_deadlines" ADD CONSTRAINT "revision_deadlines_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_deadlines" ADD CONSTRAINT "revision_deadlines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_standardCode_fkey" FOREIGN KEY ("standardCode") REFERENCES "certification_standards"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_revisions" ADD CONSTRAINT "certificate_revisions_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_revisions" ADD CONSTRAINT "certificate_revisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standard_requirements" ADD CONSTRAINT "standard_requirements_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "certification_standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_rounds" ADD CONSTRAINT "correction_rounds_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_rounds" ADD CONSTRAINT "correction_rounds_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_rounds" ADD CONSTRAINT "correction_rounds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_submission_versions" ADD CONSTRAINT "correction_submission_versions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_submission_versions" ADD CONSTRAINT "correction_submission_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_context_switches" ADD CONSTRAINT "entity_context_switches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_context_switches" ADD CONSTRAINT "entity_context_switches_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_context_switches" ADD CONSTRAINT "entity_context_switches_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_context_switches" ADD CONSTRAINT "entity_context_switches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_member_permission_grants" ADD CONSTRAINT "entity_member_permission_grants_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "entity_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_member_permission_grants" ADD CONSTRAINT "entity_member_permission_grants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_membership_events" ADD CONSTRAINT "entity_membership_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_membership_events" ADD CONSTRAINT "entity_membership_events_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_membership_events" ADD CONSTRAINT "entity_membership_events_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_membership_events" ADD CONSTRAINT "entity_membership_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_memberships" ADD CONSTRAINT "entity_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_memberships" ADD CONSTRAINT "entity_memberships_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_memberships" ADD CONSTRAINT "entity_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_analyses" ADD CONSTRAINT "site_analyses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_analyses" ADD CONSTRAINT "site_analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plots" ADD CONSTRAINT "plots_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plots" ADD CONSTRAINT "plots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_plantCode_fkey" FOREIGN KEY ("plantCode") REFERENCES "plant_species"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_submissions" ADD CONSTRAINT "report_submissions_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_submissions" ADD CONSTRAINT "report_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_submissions" ADD CONSTRAINT "report_submissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_of_works" ADD CONSTRAINT "scope_of_works_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_of_works" ADD CONSTRAINT "scope_of_works_assignedAuditorId_fkey" FOREIGN KEY ("assignedAuditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_of_works" ADD CONSTRAINT "scope_of_works_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklists" ADD CONSTRAINT "audit_checklists_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklists" ADD CONSTRAINT "audit_checklists_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklists" ADD CONSTRAINT "audit_checklists_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "role_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

