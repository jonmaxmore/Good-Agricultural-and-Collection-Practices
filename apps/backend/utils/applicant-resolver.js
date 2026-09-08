/**
 * Applicant Resolver
 *
 * Shared module for resolving applicant/payer information from various
 * data sources (Prisma Application, Invoice, formData).
 *
 * Consolidates duplicated logic from:
 * - invoice-template-service.js  (resolvePayerInfo)
 * - application-template-service.js (resolveApplicantInfo)
 *
 * Phase 4d (Wave B) — when the caller includes `entity` in the Prisma
 * query, the resolver prefers Entity.displayName + Entity.{thaiCitizenId,
 * juristicId, communityRegNo} over the legacy formData/applicant fields.
 * Falls back cleanly for pre-Phase-66 records that don't carry an entity.
 *
 * @module utils/applicant-resolver
 */

// Entity.type → legacy applicantType used in formData and on PDFs.
// COMMUNITY_ENTERPRISE folds onto the existing 'COMMUNITY' branch in
// downstream code; INDIVIDUAL / JURISTIC pass through unchanged.
const ENTITY_TYPE_TO_LEGACY = {
    INDIVIDUAL: 'INDIVIDUAL',
    JURISTIC: 'JURISTIC',
    COMMUNITY_ENTERPRISE: 'COMMUNITY',
};

function resolveFromEntity(entity) {
    if (!entity || !entity.type) { return null; }
    const legacyType = ENTITY_TYPE_TO_LEGACY[entity.type] || null;
    if (!legacyType) { return null; }
    let id = '-';
    if (entity.type === 'INDIVIDUAL') {
        id = entity.thaiCitizenId || '-';
    } else if (entity.type === 'JURISTIC') {
        id = entity.juristicId || '-';
    } else if (entity.type === 'COMMUNITY_ENTERPRISE') {
        id = entity.communityRegNo || '-';
    }
    return {
        applicantType: legacyType,
        name: entity.displayName || '-',
        id,
    };
}

/**
 * Resolve applicant info from an Application or Invoice record.
 *
 * Handles all 3 applicant types: individual, juristic (company), community.
 *
 * @param {Object} record - Prisma Application or Invoice record
 * @param {Object} [record.applicant] - Direct applicant relation (User)
 * @param {Object} [record.entity] - Direct entity relation (Phase 66+)
 * @param {Object} [record.application] - Parent application (for invoices)
 * @param {Object} [record.formData] - Wizard form data (applications only)
 * @returns {{ name: string, id: string, phone: string, email: string, address: string }}
 */
function resolveApplicantInfo(record) {
    // Applicant + entity can come from direct relation or via application
    const applicant = record.applicant || record.application?.applicant || {};
    const entity = record.entity || record.application?.entity || null;
    const fd = record.formData || record.application?.formData || {};

    // Phase 4d — prefer the Entity relation when the caller included it.
    // Falls through to the legacy formData/User lookup when entity is
    // absent (pre-Phase-66 rows, or queries that didn't include entity).
    const fromEntity = resolveFromEntity(entity);
    const applicantType = fromEntity?.applicantType
        || fd.applicantType
        || fd.entityType;

    let name = fromEntity?.name || '-';
    let id = fromEntity?.id || '-';
    const phone = applicant.phone || fd.phone || fd.applicantInfo?.phone || '-';
    const email = applicant.email || fd.email || '-';

    // If entity wasn't usable, fall back to the legacy resolution by type.
    //
    // ── DEPRECATION (Wave D Phase 5a, 2026-05-02) ──
    // The `applicant.companyName` / `applicant.taxId` / `applicant.
    // companyRegistrationNumber` reads below are the SOLE remaining
    // production-path consumers of those User-table columns. Phase 5b
    // drops the columns; this fallback then shrinks to the formData /
    // entity paths only. Until then, leaving them in place keeps
    // pre-Phase-66 applications rendering correctly.
    if (!fromEntity) {
        const upperType = String(applicantType || '').toUpperCase();
        if (upperType === 'JURISTIC') {
            name = fd.applicantInfo?.companyName || applicant.companyName || '-';
            id = fd.applicantInfo?.taxId || applicant.taxId || applicant.companyRegistrationNumber || '-';
        } else if (upperType === 'COMMUNITY') {
            name = fd.applicantInfo?.groupName || '-';
            id = fd.applicantInfo?.registrationNumber || '-';
        } else {
            // Individual (default)
            name = applicant.companyName
                || `${applicant.firstName || fd.applicantInfo?.firstName || ''} ${applicant.lastName || fd.applicantInfo?.lastName || ''}`.trim()
                || '-';
            id = applicant.nationalId || applicant.taxId || fd.applicantInfo?.nationalId || applicant.companyRegistrationNumber || '-';
        }
    }

    // Resolve address
    const addrParts = [
        fd.applicantInfo?.address || applicant.address,
        fd.applicantInfo?.district || applicant.district,
        fd.applicantInfo?.province || applicant.province,
        fd.applicantInfo?.postalCode || applicant.postalCode,
    ].filter(Boolean);
    const address = addrParts.join(' ') || '-';

    return { name, id, phone, email, address };
}

module.exports = { resolveApplicantInfo };
