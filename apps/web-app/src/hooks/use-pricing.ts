'use client';

/**
 * usePricing Hook - "One Brain, Many Faces" Architecture
 * 
 * Fetches pricing information from backend API
 * instead of hardcoding prices in frontend.
 */

import { useState, useEffect } from "react";
import { apiClient } from '@/lib/api/api-client';
import {
    GACP_APPLICATION_FEE,
    GACP_INSPECTION_FEE,
    GACP_RENEWAL_FEE,
    GACP_RENEWAL_PAYABLE_PER_SCOPE,
    GACP_RENEWAL_CHARGE_COUNT,
    GACP_PLATFORM_RATE,
    GACP_VAT_RATE,
} from '@/constants/fees';

export interface PricingFees {
    applicationFee: number;
    inspectionFee: number;
    /**
     * W12 (2026-08-22): the pre-VAT, pre-platform BASE of the single renewal
     * charge — NOT the amount due. Never render it on its own; pair it with
     * renewalTotalPerScope via resolveRenewalFee below.
     */
    renewalFee: number;
    /**
     * What the applicant actually pays for a renewal, once. Optional because a
     * server older than 2026-08-22 does not send it; resolveRenewalFee falls
     * back to the locked constant.
     */
    renewalTotalPerScope?: number;
    /** 1 for a renewal. A new application is billed in two phases. */
    renewalChargeCount?: number;
    currency: string;
    vatRate: number;
    lastUpdated: string;
    validUntil: string;
}

interface UsePricingResult {
    fees: PricingFees | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

// Always use relative path for client-side requests (nginx will proxy to backend)
const API_BASE = '/api';

/**
 * Hook to fetch platform fees from backend
 */
export function usePricing(): UsePricingResult {
    const [fees, setFees] = useState<PricingFees | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFees = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await apiClient.get<PricingFees>(`${API_BASE}/pricing/fees`);

            if (data.success) {
                setFees(data.data || null);
            } else {
                setError(data.error || 'ไม่สามารถดึงข้อมูลราคาได้');
            }
        } catch (err: unknown) {
            setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
            console.error('Pricing API error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFees();
    }, []);

    return { fees, loading, error, refetch: fetchFees };
}

/**
 * Default fees for fallback when API is unavailable
 * (kept for graceful degradation, but API should be primary source)
 */
export const DEFAULT_FEES: PricingFees = {
    applicationFee: GACP_APPLICATION_FEE,
    inspectionFee: GACP_INSPECTION_FEE,
    renewalFee: GACP_RENEWAL_FEE,
    renewalTotalPerScope: GACP_RENEWAL_PAYABLE_PER_SCOPE,
    renewalChargeCount: GACP_RENEWAL_CHARGE_COUNT,
    currency: 'THB',
    // W11-3 — was the literal 0.07 while GACP_VAT_RATE sat in the SSoT module
    // this file already imports from. Same value, one source.
    vatRate: GACP_VAT_RATE,
    lastUpdated: '2025-01-01',
    validUntil: '2025-12-31',
};

export const PLATFORM_RATE = GACP_PLATFORM_RATE;

/** The renewal fee as a screen must show it: never the base on its own. */
export interface RenewalFeeView {
    /** ฐานค่าธรรมเนียม ก่อน VAT */
    base: number;
    /** ยอดที่ต้องชำระจริง */
    payable: number;
    /** 1 — a renewal is a single charge */
    chargeCount: number;
}

/**
 * One accessor for every renewal-fee surface, live from the API when it is
 * there and the locked fallback otherwise. It exists so no screen re-implements
 * the choice, and so none of them can render renewalFee alone by accident:
 * the base is only reachable through a shape that also carries the payable.
 */
export function resolveRenewalFee(fees: PricingFees | null): RenewalFeeView {
    const source = fees ?? DEFAULT_FEES;
    return {
        base: source.renewalFee,
        payable: source.renewalTotalPerScope ?? GACP_RENEWAL_PAYABLE_PER_SCOPE,
        chargeCount: source.renewalChargeCount ?? GACP_RENEWAL_CHARGE_COUNT,
    };
}

/** Hook form for the renewal wizard. */
export function useRenewalFee(): RenewalFeeView {
    const { fees } = usePricing();
    return resolveRenewalFee(fees);
}

/**
 * Generate quotation items from pricing data
 */
export function generateQuotationItems(fees: PricingFees | null, includeInspection: boolean = false) {
    const f = fees || DEFAULT_FEES;

    const items = [
        {
            description: 'ค่าตรวจสอบและประเมินคำขอการรับรองมาตรฐานเบื้องต้น',
            quantity: 1,
            unitPrice: f.applicationFee,
        },
    ];

    if (includeInspection) {
        items.push({
            description: 'ค่ารับรองผลการประเมินและจัดทำหนังสือรับรองมาตรฐาน',
            quantity: 1,
            unitPrice: f.inspectionFee,
        });
    }

    return items;
}

