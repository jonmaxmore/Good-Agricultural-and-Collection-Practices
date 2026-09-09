'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { GACP_PHASE1_TOTAL, GACP_PHASE2_TOTAL } from '@/constants/fees';
import { ORGANIZATION } from '@/lib/organization-identity';

/**
 * OnboardingModal — Iter 28 customer success first-run walkthrough.
 *
 * Presents the 5-step welcome tour for new applicants:
 *   1) ยินดีต้อนรับสู่ GACP THAILAND
 *   2) ขั้นตอนการสมัคร 12 ขั้น
 *   3) ค่าธรรมเนียม 2 งวด ต่อขอบเขตการปลูก (ยอดมาจาก GACP_PHASE1_TOTAL /
 *      GACP_PHASE2_TOTAL ใน constants/fees.ts ไม่พิมพ์ตัวเลขซ้ำที่นี่)
 *   4) ใบรับรองมีอายุ 3 ปี — แจ้งเตือนต่ออายุล่วงหน้า
 *   5) ติดต่อ Help Center ได้ตลอดเวลา
 *
 * The modal exposes Skip and Next buttons; on the final step Next
 * becomes "เริ่มใช้งาน" and calls onComplete. Both Skip and Complete
 * persist `onboardingCompleted = true` in localStorage so the modal
 * never reappears for the same browser profile. The real persistence
 * (sync to user.metadata) is handled by the caller via onComplete.
 */

export type OnboardingStep = {
    title: string;
    description: string;
    bullets?: ReadonlyArray<string>;
    illustration?: React.ReactNode;
    cta?: string;
};

export const DEFAULT_ONBOARDING_STEPS: ReadonlyArray<OnboardingStep> = [
    {
        title: 'ยินดีต้อนรับสู่ GACP THAILAND',
        description:
            'ระบบรับรองมาตรฐานการปฏิบัติทางการเกษตรที่ดีสำหรับพืชสมุนไพร ขับเคลื่อนโดยกรมการแพทย์แผนไทยและการแพทย์ทางเลือก',
        bullets: [
            'สมัครออนไลน์ ครบจบในที่เดียว',
            'ติดตามสถานะคำขอแบบเรียลไทม์',
            'รับใบรับรองดิจิทัลพร้อม QR Code',
        ],
        cta: 'ถัดไป',
    },
    {
        title: 'ขั้นตอนการสมัคร 12 ขั้น',
        description:
            'ตั้งแต่กรอกเอกสาร → ตรวจสอบ → ตรวจประเมินฟาร์ม → ออกใบรับรอง โดยมีระบบติดตามทุกขั้น',
        bullets: [
            '1-3 กรอกข้อมูลคำขอและเอกสาร',
            '4-6 ตรวจสอบเอกสารและชำระงวดที่ 1',
            '7-9 ตรวจประเมินฟาร์มและคำชี้แจง',
            '10-12 ชำระงวดที่ 2 และออกใบรับรอง',
        ],
        cta: 'ถัดไป',
    },
    {
        title: 'ค่าธรรมเนียม (จ่ายเป็น 2 งวด)',
        description:
            'ค่าธรรมเนียมขึ้นกับขอบเขตการรับรอง (scope) แบ่งจ่ายเป็น 2 งวดเพื่อความสะดวก',
        bullets: [
            `scope เล็ก: ${GACP_PHASE1_TOTAL.toLocaleString('th-TH')} บาท ต่อขอบเขต`,
            `scope ใหญ่: ${GACP_PHASE2_TOTAL.toLocaleString('th-TH')} บาท ต่อขอบเขต`,
            'งวด 1: ค่าตรวจเอกสาร ชำระหลังยื่นคำขอ',
            'งวด 2: ค่าตรวจฟาร์ม ชำระก่อนนัดตรวจ',
            'ออกใบเสร็จอิเล็กทรอนิกส์อัตโนมัติ',
        ],
        cta: 'ถัดไป',
    },
    {
        title: 'ใบรับรองมีอายุ 3 ปี',
        description:
            'ระบบจะแจ้งเตือนการต่ออายุล่วงหน้าให้คุณไม่พลาดและรักษาสถานะการรับรอง',
        bullets: [
            'แจ้งเตือนล่วงหน้า 60 วันก่อนหมดอายุ',
            'แจ้งเตือนซ้ำที่ 30 วัน และ 15 วัน',
            'ยื่นต่ออายุได้ตั้งแต่ 90 วันก่อนหมดอายุ',
            'ใบรับรองเดิมยังใช้งานได้จนกว่าจะออกใบใหม่',
        ],
        cta: 'ถัดไป',
    },
    {
        title: 'ติดต่อ Help Center ได้ตลอดเวลา',
        description:
            'หากต้องการความช่วยเหลือ ทีมงานพร้อมตอบทุกคำถามผ่านศูนย์ช่วยเหลือ',
        bullets: [
            'ค้นหาคำตอบในหน้า FAQ',
            `อีเมล: ${ORGANIZATION.email}`,
            'เปิดให้บริการในเวลาราชการ',
            'พบที่เมนู "ศูนย์ช่วยเหลือ" ในแถบนำทาง',
        ],
        cta: 'เริ่มใช้งาน',
    },
];

export const ONBOARDING_STORAGE_KEY = 'gacp.onboardingCompleted';

export interface OnboardingModalProps {
    /** Controlled open state. When omitted the component manages itself. */
    open?: boolean;
    /** Steps to show — defaults to the 5-step Iter 28 walkthrough. */
    steps?: ReadonlyArray<OnboardingStep>;
    /** Called when the user finishes the walkthrough successfully. */
    onComplete?: () => void;
    /** Called when the user skips. */
    onSkip?: () => void;
    /** Persist to localStorage on complete / skip. Default true. */
    persist?: boolean;
    /** Initial step index. */
    initialStep?: number;
}

export function OnboardingModal({
    open: openProp,
    steps = DEFAULT_ONBOARDING_STEPS,
    onComplete,
    onSkip,
    persist = true,
    initialStep = 0,
}: OnboardingModalProps) {
    const [internalOpen, setInternalOpen] = React.useState<boolean>(true);
    const [stepIndex, setStepIndex] = React.useState<number>(initialStep);

    const isControlled = typeof openProp === 'boolean';
    const open = isControlled ? Boolean(openProp) : internalOpen;
    const step = steps[stepIndex];
    const isLast = stepIndex === steps.length - 1;

    const close = React.useCallback(() => {
        if (!isControlled) setInternalOpen(false);
    }, [isControlled]);

    const writeFlag = React.useCallback(() => {
        if (!persist) return;
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
            }
        } catch {
            // ignore storage errors (private mode, etc.)
        }
    }, [persist]);

    const handleSkip = React.useCallback(() => {
        writeFlag();
        onSkip?.();
        close();
    }, [writeFlag, onSkip, close]);

    const handleNext = React.useCallback(() => {
        if (isLast) {
            writeFlag();
            onComplete?.();
            close();
            return;
        }
        setStepIndex((s) => Math.min(s + 1, steps.length - 1));
    }, [isLast, writeFlag, onComplete, close, steps.length]);

    const handleBack = React.useCallback(() => {
        setStepIndex((s) => Math.max(s - 1, 0));
    }, []);

    // Lock body scroll while open so the dialog truly modals over content.
    React.useEffect(() => {
        if (!open || typeof document === 'undefined') return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            aria-describedby="onboarding-desc"
            data-testid="onboarding-modal"
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 md:items-center"
        >
            <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                    <span className="text-xs font-semibold uppercase text-leaf-700">
                        เริ่มต้นใช้งาน · GACP THAILAND
                    </span>
                    <span className="text-xs font-medium tabular-nums text-slate-500">
                        ขั้นที่ {stepIndex + 1} / {steps.length}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full bg-slate-100" aria-hidden="true">
                    <div
                        className="h-full bg-leaf-700 transition-all"
                        style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="px-5 py-6 md:px-7 md:py-8">
                    {/* Illustration placeholder */}
                    <div className="mb-5 flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-soft via-white to-leaf-soft">
                        {step?.illustration ?? <StepGlyph index={stepIndex} />}
                    </div>

                    <h2 id="onboarding-title" className="text-lg font-bold text-slate-900 md:text-xl">
                        {step?.title}
                    </h2>
                    <p id="onboarding-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
                        {step?.description}
                    </p>

                    {step?.bullets && step.bullets.length > 0 ? (
                        <ul className="mt-4 space-y-2 text-sm text-slate-700">
                            {step.bullets.map((b, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <CheckDot />
                                    <span className="min-w-0 flex-1">{b}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 md:px-7 md:py-4">
                    <button
                        type="button"
                        onClick={handleSkip}
                        data-testid="onboarding-skip"
                        className={cn(
                            'inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100',
                        )}
                    >
                        ข้าม
                    </button>
                    <div className="flex items-center gap-2">
                        {stepIndex > 0 ? (
                            <button
                                type="button"
                                onClick={handleBack}
                                data-testid="onboarding-back"
                                className={cn(
                                    'inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50',
                                )}
                            >
                                ย้อนกลับ
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={handleNext}
                            data-testid="onboarding-next"
                            className={cn(
                                'inline-flex h-10 items-center justify-center rounded-lg bg-leaf-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-leaf-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-600 focus-visible:ring-offset-2',
                            )}
                        >
                            {step?.cta ?? (isLast ? 'เริ่มใช้งาน' : 'ถัดไป')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CheckDot() {
    return (
        <span
            aria-hidden="true"
            className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-onSoft"
        >
            <svg viewBox="0 0 20 20" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M4 10l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
}

function StepGlyph({ index }: { index: number }) {
    const map = ['สวัสดี', '12 ขั้น', '฿฿', '1 ปี', 'ช่วยเหลือ'];
    return (
        <span
            aria-hidden="true"
            className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-leaf-700 text-base font-bold text-white shadow-sm"
        >
            {map[index] ?? `ขั้น ${index + 1}`}
        </span>
    );
}

/** Reads the persisted onboarding flag (browser-only). */
export function hasCompletedOnboarding(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export default OnboardingModal;
