/**
 * Capability Flags — Progressive Disclosure System
 *
 * Controls which advanced features are visible to each user.
 * Default: all false (simple Applicant flow).
 * Future: read from user profile / subscription tier.
 */

export interface CapabilityFlags {
    /** Allow partner API key management */
    partnerTraceApi: boolean;

    /** Custom branding on public QR trace page */
    whiteLabelTracePage: boolean;

    /** Show structured lab value inputs (THC/CBD/moisture) instead of just PDF upload */
    structuredLabResults: boolean;
}

/** Default capabilities — simple Applicant flow */
export const DEFAULT_CAPABILITIES: CapabilityFlags = {
    partnerTraceApi: false,
    whiteLabelTracePage: false,
    structuredLabResults: false,
};

/**
 * Get capabilities for the current user.
 * Phase 1: always returns defaults.
 * Phase 2: will read from user profile / env.
 */
export function getCapabilities(): CapabilityFlags {
    // Future: read from user.subscription?.tier or ENV
    // For now: check localStorage override (dev/testing only)
    if (typeof window !== 'undefined') {
        const override = localStorage.getItem('gacp_capabilities');
        if (override) {
            try {
                return { ...DEFAULT_CAPABILITIES, ...JSON.parse(override) };
            } catch {
                // ignore parse errors
            }
        }
    }
    return DEFAULT_CAPABILITIES;
}

/**
 * Check a single capability
 */
export function hasCapability(key: keyof CapabilityFlags): boolean {
    return getCapabilities()[key];
}
