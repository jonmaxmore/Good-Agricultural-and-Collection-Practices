/**
 * Renewal Flow - Shared Types
 * Refactored to remove Theme interface (now using isDark + Tailwind classes)
 */

export interface Certificate {
    id: string;
    certificateNumber: string;
    applicationId: string;
    siteName: string;
    plantType: string;
    expiryDate: string;
    status: string;
}

// Re-export from Single Source of Truth (constants/fees.ts)
// DO NOT define fee values here — update fees.ts instead
export { GACP_RENEWAL_FEE as RENEWAL_FEE } from '@/constants/fees';

// W12 (operator ruling 2026-08-22) - REQUIRED_DOCS and the 'upload' step are
// gone. A renewal has no document-review stage, so nobody ever reads documents
// collected here; asking an applicant to upload four files that no officer will
// open is a lie about what they must do. The four that used to be collected
// were the renewed operating licence, the annual yield report, the quality
// inspection report, and the tax certificate.
//
// Nothing on the backend read them: the renewal route takes only
// originalCertificateId (routes/api/applications/renewals.js) and the
// documentIds array the wizard used to send was never looked at.
export type RenewalStep = 'quotation' | 'invoice' | 'payment' | 'success';
