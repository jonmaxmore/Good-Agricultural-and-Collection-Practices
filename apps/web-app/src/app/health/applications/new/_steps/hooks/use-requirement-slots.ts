'use client';

/**
 * The ONE way a wizard step reads its requirement slots — with honest states.
 *
 * Steps 2, 3 and 5 each carried the same private copy of this fetch, and each
 * copy had the same two silent failure modes, found when the operator walked the
 * freshly-deployed demo and reported "เอกสารอัพโหลดเหมือนไม่ครบ ... โดยเฉพาะ
 * ข้อมูลส่วนตัว" (2026-09-06):
 *
 *   1. `if (!appId) { return; }` — no application id meant no fetch, silently,
 *      and the step rendered its empty state: on step 5 the literal sentence
 *      "คำขอนี้ยังไม่มีเอกสารที่ต้องแนบเพิ่มในขั้นตอนนี้", the one claim a
 *      failed read must never make (step 5's own comment says exactly this).
 *   2. slots start [] and the answer arrives later — for seconds the screen
 *      showed "no documents" while ten required slots were on their way.
 *
 * So the hook answers with a STATE, not a bare array: `loading` until the first
 * answer lands, `error` when the read failed or there is nothing to read yet,
 * and only a settled, successful read may render an empty list as "ครบแล้ว".
 */

import { useCallback, useEffect, useState } from 'react';
import {
    fetchApplicationRequirements,
    type RequirementSlot,
} from '@/lib/services/application-requirements';

export const SLOTS_LOADING_TH = 'กำลังโหลดรายการเอกสารของคำขอนี้…';
export const SLOTS_ERROR_TH =
    'ระบบอ่านรายการเอกสารของคำขอนี้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือย้อนกลับหนึ่งขั้นแล้วกลับมาใหม่';
/**
 * The THIRD state, added 2026-09-07. A filing with no id yet has not failed —
 * it has not been saved yet, because the draft row is created by the autosave
 * debounce and that cannot fire before the applicant types. Five freshly
 * registered accounts were walked on the live demo and every one of them met
 * SLOTS_ERROR_TH on the first application it ever opened
 * (evidence/apple-qa-audit-2026-09-07). Telling a first-time farmer that the
 * system failed, and advising them to go back a step — which changes nothing —
 * is worse than saying nothing.
 */
export const SLOTS_PENDING_TH =
    'ระบบจะบันทึกร่างให้อัตโนมัติเมื่อคุณเริ่มกรอกข้อมูล แล้วรายการเอกสารที่ต้องแนบจะปรากฏที่นี่';

export type RequirementSlotsState = {
    slots: readonly RequirementSlot[];
    /** true until the FIRST answer (success or failure) lands. */
    loading: boolean;
    /** Thai sentence when the last read genuinely FAILED. Never set for "not saved yet". */
    error: string | null;
    /** true while there is nothing to ask about yet — no id, so no read was attempted. */
    pending: boolean;
    /** What to show the applicant right now: the pending sentence, the error, or null. */
    notice: string | null;
    reload: () => Promise<void>;
};

export function useRequirementSlots(appId: string): RequirementSlotsState {
    const [slots, setSlots] = useState<readonly RequirementSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(true);

    const reload = useCallback(async () => {
        if (!appId) {
            // Not an error and not an empty answer: nothing has been asked yet.
            // The step renders SLOTS_PENDING_TH, which is true, and this hook
            // re-runs on its own the moment `appId` arrives (the dep below), so
            // the papers appear without the applicant doing anything.
            setSlots([]);
            setLoading(false);
            setError(null);
            setPending(true);
            return;
        }
        setPending(false);
        try {
            const payload = await fetchApplicationRequirements(appId);
            setSlots(payload.slots);
            setError(null);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : SLOTS_ERROR_TH);
        } finally {
            setLoading(false);
        }
    }, [appId]);

    useEffect(() => { void reload(); }, [reload]);

    const notice = pending ? SLOTS_PENDING_TH : error;
    return { slots, loading, error, pending, notice, reload };
}
