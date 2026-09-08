'use client';

import * as React from 'react';
import { ShieldOff, AlertTriangle, Loader2 } from 'lucide-react';
import { AdminB28Service } from '@/lib/services/admin-service-b28';
import { resolveErrorCode } from '@/lib/i18n/error-code-map';
import { cn } from '@/lib/utils';

/**
 * Y1-FIX-D — Thai error-code map for
 * `POST /admin/users/:id/force-reset-mfa` responses. Policy 5 of
 * `docs/i18n-policy.md`. Backend sources:
 * `apps/backend/services/admin-user-service.js:426-443`.
 *
 * Exported for unit testing.
 */
export const FORCE_MFA_RESET_ERROR_MAP: Record<string, string> = {
    SELF_MFA_RESET_FORBIDDEN: 'ระบบไม่อนุญาตให้ผู้ดูแลรีเซ็ต MFA ของตนเอง ใช้ขั้นตอน recovery ส่วนตัว',
    USER_NOT_FOUND: 'ไม่พบบัญชีผู้ใช้ที่ระบุ อาจถูกลบหรือยังไม่เคยลงทะเบียน',
    MFA_USER_NOT_FOUND: 'ไม่พบบัญชีผู้ใช้ที่ระบุ อาจถูกลบหรือยังไม่เคยลงทะเบียน',
    MFA_RESET_RECENTLY_DONE: 'เพิ่งรีเซ็ต MFA ของผู้ใช้นี้ไป กรุณารอแล้วลองอีกครั้งหากจำเป็น',
    PERMISSION_DENIED: 'คุณไม่มีสิทธิ์รีเซ็ต MFA ต้องเป็นบทบาท ADMIN เท่านั้น',
    FORBIDDEN_ROLE: 'คุณไม่มีสิทธิ์รีเซ็ต MFA ต้องเป็นบทบาท ADMIN เท่านั้น',
};

/**
 * ForceMfaResetModal — V5-D Iter 28 admin force-MFA-reset surface.
 *
 * Wraps the Iter 28 `POST /api/admin/users/:id/force-reset-mfa`
 * endpoint behind a confirm-with-reason modal. The action is
 * destructive and NOT reversible — once cleared the user must
 * re-enrol MFA on next login. Header colour is rose (destructive)
 * rather than amber (caution) to emphasise that.
 *
 * Reason gate: ≥ 10 characters (matches backend
 * `FORCE_MFA_RESET_REASON_MIN_LEN`).
 *
 * Mirrors the shape of `UserDisableModal` + `ChangeRoleModal`.
 */

export interface ForceMfaResetModalProps {
    userId: string;
    userLabel: string;
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    /** Optional override for tests. */
    submitHandler?: (
        userId: string,
        reason: string,
    ) => Promise<{ success: boolean; message?: string; error?: string; code?: string }>;
}

export function ForceMfaResetModal({
    userId,
    userLabel,
    open,
    onClose,
    onSuccess,
    submitHandler,
}: ForceMfaResetModalProps) {
    const [reason, setReason] = React.useState('');
    const [confirmText, setConfirmText] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setReason('');
            setConfirmText('');
            setError(null);
            setSubmitting(false);
        }
    }, [open]);

    if (!open) return null;

    // X5-FIX-D H-7: type-to-confirm mistype-resistance. This is the
    // MOST security-sensitive ADMIN modal because force-MFA-reset
    // bypasses 2FA. The operator must retype the user id literally to
    // unlock the submit button. Mirrors ForceStatusModal:286-294.
    const reasonTooShort = reason.trim().length < 10;
    const confirmMismatch = confirmText.trim() !== userId.trim();
    const canSubmit = !reasonTooShort && !confirmMismatch && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const handler =
                submitHandler ??
                ((id: string, r: string) => AdminB28Service.forceResetMfa(id, r));
            const res = await handler(userId, reason.trim());
            if (res.success) {
                onSuccess?.();
                onClose();
            } else {
                // Y1-FIX-D — Policy 5: Thai-friendly resolver.
                setError(
                    resolveErrorCode(res, FORCE_MFA_RESET_ERROR_MAP, 'ไม่สามารถรีเซ็ต MFA ได้'),
                );
            }
        } catch {
            setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
            {/* X5-FIX-B H-9: W5-C backdrop split. The clickable scrim is a real
                <button> so click-outside-to-close also works via Enter/Space —
                drops the previous jsx-a11y/click-events-have-key-events +
                no-noninteractive-element-interactions warnings. Mirrors
                ForceStatusModal.tsx:142-158 (the W5-C reference). */}
            <button
                type="button"
                aria-label="ปิดหน้าต่าง"
                className="absolute inset-0 cursor-default bg-slate-900/60"
                onClick={onClose}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="force-mfa-reset-title"
                className="relative flex max-h-[100vh] w-full flex-col overflow-hidden bg-white shadow-2xl md:max-h-[90vh] md:w-full md:max-w-md md:rounded-2xl"
            >
                <header className="border-b border-rose-200 bg-rose-50 px-5 py-4">
                    <h2
                        id="force-mfa-reset-title"
                        className="flex items-center gap-2 text-base font-bold text-rose-900"
                    >
                        <ShieldOff className="h-5 w-5" aria-hidden="true" />
                        บังคับรีเซ็ต MFA ของผู้ใช้
                    </h2>
                    <p className="mt-1 text-xs text-rose-800">
                        ล้างการลงทะเบียน MFA ของผู้ใช้ ผู้ใช้ต้องตั้งค่าใหม่เมื่อเข้าใช้ครั้งถัดไป
                    </p>
                </header>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                        <p className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            การกระทำนี้ไม่สามารถย้อนกลับได้
                        </p>
                        <p className="mt-1">
                            ใช้เฉพาะกรณีผู้ใช้ทำอุปกรณ์ MFA หาย / ติดล็อกจาก 2FA และยืนยันตัวตนภายนอกระบบแล้ว
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-800">บัญชีที่เลือก</p>
                        <p
                            className="mt-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            data-testid="force-mfa-reset-user-label"
                        >
                            {userLabel}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">{userId}</p>
                    </div>

                    <div>
                        <label
                            htmlFor="force-mfa-reset-reason"
                            className="mb-1 block text-xs font-bold text-slate-800"
                        >
                            เหตุผลในการรีเซ็ต MFA <span className="text-rose-600">*</span>
                        </label>
                        <textarea
                            id="force-mfa-reset-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="เช่น ผู้ใช้ทำอุปกรณ์ MFA หาย และยืนยันตัวตนทางโทรศัพท์แล้ว (อย่างน้อย 10 ตัวอักษร)"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                            aria-required="true"
                            data-testid="force-mfa-reset-reason"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                            ระบุอย่างน้อย 10 ตัวอักษร บันทึกใน audit log (severity = WARNING)
                        </p>
                    </div>

                    {/* X5-FIX-D H-7: type-to-confirm mistype-resistance.
                        Force-MFA-reset bypasses 2FA — the operator must
                        retype the user id literally before submit unlocks.
                        Mirrors ForceStatusModal:286-294. */}
                    <div>
                        <label
                            htmlFor="force-mfa-reset-confirm"
                            className="mb-1 block text-xs font-bold text-slate-800"
                        >
                            ยืนยันโดยพิมพ์รหัสผู้ใช้อีกครั้ง{' '}
                            <span className="text-rose-600">*</span>
                        </label>
                        <input
                            id="force-mfa-reset-confirm"
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={userId}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                            autoComplete="off"
                            aria-required="true"
                            data-testid="force-mfa-reset-confirm"
                        />
                        {confirmText && confirmMismatch ? (
                            <p className="mt-1 text-[11px] text-rose-600">
                                รหัสผู้ใช้ไม่ตรง โปรดคัดลอกค่าด้านบนให้ตรงกัน
                            </p>
                        ) : null}
                    </div>

                    {error ? (
                        <div
                            role="alert"
                            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800"
                        >
                            {error}
                        </div>
                    ) : null}
                </div>

                <footer className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 md:flex-row md:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        data-testid="force-mfa-reset-submit"
                        className={cn(
                            'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white',
                            canSubmit
                                ? 'bg-rose-600 hover:bg-rose-700'
                                : 'cursor-not-allowed bg-rose-300',
                        )}
                    >
                        {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <ShieldOff className="h-4 w-4" aria-hidden="true" />
                        )}
                        ยืนยันรีเซ็ต MFA
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default ForceMfaResetModal;
