/**
 * checkout-service.ts — createCheckout() for the Stripe checkout UI
 * (W2-03 D1).
 *
 * Thin transport layer only. This file:
 *   - carries NO money math — every amount the UI shows comes verbatim from
 *     the backend's breakdown (or, in mock mode, from the fixtures);
 *   - imports NOTHING from the backend — the wire contract below is the
 *     FE-side mirror of the confirmed backend response shape.
 *
 * live vs mock is decided per call by `getCheckoutApiMode()`
 * (src/lib/config/checkout-mode.ts). Mock mode exists so the D2 checkout UI
 * can be exercised end-to-end — including loading, conflict, server-error
 * and timeout states — without a running backend or a Stripe key. The mock
 * path resolves after a short artificial latency so the loading state is
 * actually visible instead of flashing for 0ms.
 */

import { api } from '../api/api-client';
import type { ApiResponse } from '../api/api-client';
import { getCheckoutApiMode } from '../config/checkout-mode';
import {
    CONFLICT_409,
    HAPPY,
    SERVER_ERROR_500,
    TIMEOUT,
} from './__fixtures__/checkout-fixtures';

/**
 * Fee breakdown as the backend computes it — THB integers. The UI renders
 * these numbers as-is; it must NEVER recompute or "correct" them locally
 * (the HAPPY_NON_SUMMING fixture exists to prove that in D2's tests).
 */
export interface CheckoutBreakdown {
    dtamPayableAmount: number;
    platformFeeNet: number;
    platformFeeVat: number;
    platformFeeGross: number;
    totalPayableAmount: number;
}

/** Success payload of POST /payments/checkout after api-client unwrapping. */
export interface CheckoutSessionData {
    checkoutOrderId: string;
    paymentIntentId: string;
    clientSecret: string;
    milestone: string;
    breakdown: CheckoutBreakdown;
    /**
     * F-G4-64 — the number of the priced document this charge collects against
     * (`quotations.quotationNumber`, returned by createCheckoutForApplication).
     * Optional because the mock fixtures predate it and because a legacy order
     * re-entered from the drain window may answer null; the screen draws the row
     * only when there is a number to draw.
     */
    quotationNumber?: string | null;
}

/** What every checkout call resolves to, in both live and mock mode. */
export type CheckoutResult = ApiResponse<CheckoutSessionData>;

/** Scenario knob for mock mode — ignored entirely in live mode. */
export type CheckoutMockScenario = 'happy' | 'conflict' | 'server-error' | 'timeout';

export interface CreateCheckoutArgs {
    applicationId: string;
    milestone: string;
    /**
     * Only consulted when getCheckoutApiMode() === 'mock'. Unknown values
     * (and omission) fall back to the happy path. In live mode this field
     * is ignored unconditionally so a leaked query param or stale prop can
     * never divert a real payment call into fixture land.
     */
    mockScenario?: CheckoutMockScenario | string;
}

/**
 * Artificial latency for mock responses. Presentation-only (lets a human
 * see the UI's loading state) — NOT a business value, NOT a timeout.
 */
const MOCK_LATENCY_MS = 300;

function mockLatency(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, MOCK_LATENCY_MS);
    });
}

/**
 * Start a checkout for one payable milestone of an application.
 *
 * live: POST /payments/checkout with EXACTLY { applicationId, milestone }
 * (api-client auto-prefixes '/api'), returning its envelope verbatim.
 *
 * mock: resolve the fixture for `mockScenario` after MOCK_LATENCY_MS,
 * without touching the network.
 */
export async function createCheckout({
    applicationId,
    milestone,
    mockScenario,
}: CreateCheckoutArgs): Promise<CheckoutResult> {
    if (getCheckoutApiMode() !== 'mock') {
        return api.post<CheckoutSessionData>('/payments/checkout', { applicationId, milestone });
    }

    await mockLatency();
    switch (mockScenario) {
        case 'conflict':
            return CONFLICT_409;
        case 'server-error':
            return SERVER_ERROR_500;
        case 'timeout':
            return TIMEOUT;
        default:
            return HAPPY;
    }
}
