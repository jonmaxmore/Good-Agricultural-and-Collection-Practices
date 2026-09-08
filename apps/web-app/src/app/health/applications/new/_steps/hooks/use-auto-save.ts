"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApplicationFlowStore } from './use-application-flow-store';
import { api } from '@/lib/api/api-client';
import { deriveLocationType } from '../steps/derive-location-type';
import {
  classifyAutoSaveFailure,
  type AutoSaveErrorKind,
  type AutoSaveSyncState,
} from './auto-save-status';

interface AutoSaveState {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  errorKind: AutoSaveErrorKind | null;
  draftId: string | null;
  syncState: AutoSaveSyncState;
  // Optimistic-concurrency token returned by the backend on every
  // successful save. Echoed back as `expectedVersion` on the next
  // save so the backend can detect 2-tab concurrent writes.
  draftVersion: number | null;
  // Set when the backend returned 409 DRAFT_VERSION_CONFLICT —
  // another tab saved newer changes and the user should reload.
  hasConflict: boolean;
  /**
   * F-APPV2-02 — what the server decided about ประเภทคำขอ, when it did not agree.
   *
   * The save SUCCEEDED; this is not an error. `requestType` is server-owned because
   * RENEWAL and REPLACEMENT are judged by two rows instead of the whole ส่วนที่ ๓ set,
   * so the server grants that reading only against a live certificate the caller owns
   * and otherwise records the filing as NEW. Without this field the applicant would see
   * their document list quietly get longer and be told nothing — the same defect as a
   * refusal that reaches the browser as a bare code.
   */
  lawNotice: { code: string; messageTh: string } | null;
}

interface UseAutoSaveReturn extends AutoSaveState {
  saveNow: () => Promise<void>;
  markDirty: () => void;
  clearDraft: () => void;
  /** Drop local conflict state once the user has reloaded server data. */
  acknowledgeConflict: () => void;
}

type AutoSaveDependencies = {
  useApplicationFlowStore: typeof useApplicationFlowStore;
  api: Pick<typeof api, 'post' | 'delete'>;
};

interface DraftSaveResponse {
  draftId?: string;
  id: string;
  /** Server-side optimistic-concurrency token (incremented per save). */
  version?: number;
  /**
   * F-APPV2-02 — set when the server did NOT grant the ประเภทคำขอ the applicant chose,
   * because RENEWAL and REPLACEMENT are only granted against a live certificate the
   * caller owns. The save still succeeded; the filing was recorded as NEW.
   */
  lawNotice?: { code: string; messageTh: string } | null;
  /** What the server actually recorded, after checking. */
  requestType?: string;
  certScope?: string;
}

const DEBOUNCE_DELAY = 3000;
const DEFAULT_DEPENDENCIES: AutoSaveDependencies = {
  useApplicationFlowStore,
  api,
};

function getAutoSaveErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || null;
  }

  if (typeof error === 'string') {
    const message = error.trim();
    return message || null;
  }

  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    const message = error.message.trim();
    return message || null;
  }

  return null;
}

/**
 * Everything the applicant has answered, ready to be sent as `formData`.
 *
 * The same deny-list as the dirty-check, and for the same reason: this used to be a
 * hand-typed object naming twenty-odd fields, and it was the THIRD copy of the old
 * wizard's field list on this path. All three were stale in the same way, so a filing
 * could be seen as changed, be allowed to save, and still arrive at the server with the
 * applicant's answers to steps 1 and 4 missing.
 *
 * The server keeps its own allow-list (`WIZARD_OWNED_FORM_DATA_KEYS`) and that one is a
 * security boundary, not a convenience — sending a key the server does not own changes
 * nothing. Sending everything the applicant answered is exactly what this side owes.
 */
export function answersForDraft(state: ReturnType<typeof useApplicationFlowStore>['state']): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const key of Object.keys(state) as Array<keyof typeof state>) {
    if (NOT_SENT_KEYS.includes(key as string)) { continue; }
    const value = state[key];
    if (value === undefined) { continue; }
    answers[key as string] = value;
  }
  return answers;
}

/**
 * Has the applicant actually started filling this wizard?
 *
 * The point of asking is to not create a draft row for someone who merely opened the page.
 * It used to be asked as `state.plantId`, which was the OLD wizard's first question. The
 * six-step rebuild moved the plant to STEP 4, so that test silently became "save nothing
 * until the applicant reaches step 4": steps 1-3 were never persisted, a reload lost them,
 * and because steps 2 and 3 fetch their document cards BY the application id that only a
 * save produces, those steps showed no papers at all — with no message, because the fetch
 * is skipped rather than failed.
 *
 * Measured in a browser 2026-09-06 on a fresh filing: step 1 answered in full, six seconds
 * later the pill still read "พร้อมบันทึก".
 *
 * Three ways to have started, and each is a different real applicant:
 *   requestType   — answered the first question of the six-step wizard
 *   plantId       — a draft from the old wizard being resumed
 *   applicationId — an existing application being edited; its saves must never be dropped
 */
export function wizardHasStarted(state: ReturnType<typeof useApplicationFlowStore>['state']): boolean {
  return Boolean(state.requestType || state.plantId || state.applicationId);
}

/**
 * The only fields that are NOT an answer: the wizard's own bookkeeping about saving.
 *
 * They must be exempt in both directions. Counting them would make one save mark the
 * form dirty again (the save response writes applicationId / syncStatus), which is an
 * endless loop; and a timestamp changes on every write with nothing to save.
 */
export const HASH_EXEMPT_KEYS: readonly string[] = Object.freeze([
  'syncStatus',
  'applicationId',
  'applicationNumber',
  'lastSyncError',
  'createdAt',
  'updatedAt',
]);

/**
 * Keys the payload must NOT carry, beyond the bookkeeping above.
 *
 * Two different questions were being answered by one list and they are not the same:
 * "did anything change?" and "what do we send?".
 *   currentStep — IS a change worth saving (progress), and it travels in its own
 *                 `payload.step` field which the server judges against what was earned.
 *                 Sending it inside formData too would be a second, ungated way to claim
 *                 progress.
 *   milestone1  — the quotation and the amount owed. The finance rails own it; the wizard
 *                 holds it only to display what the server said (L3).
 */
export const NOT_SENT_KEYS: readonly string[] = Object.freeze([
  ...HASH_EXEMPT_KEYS,
  'currentStep',
  'milestone1',
]);


/**
 * "Has anything changed?" — asked over the WHOLE state minus the bookkeeping above.
 *
 * It used to be an allow-list of thirteen field names typed out by hand, and that list
 * was written for the wizard that came before this one. Seven fields the six-step wizard
 * writes were not on it — requestType, certScope, applicantType, previousCertificateNumber
 * (step 1) and varieties, varietiesNote, processing (step 4) — so answering step 1 in full
 * left the form CLEAN. No debounce fired, no draft row was created, `applicationId` stayed
 * empty, and steps 2/3/5 fetch their document cards BY that id: the applicant saw a bare
 * form with no papers listed and no message saying why, and lost every answer on reload.
 *
 * Found by walking the wizard in a real browser on 2026-09-06 — filled step 1, waited six
 * seconds, and the pill still read "พร้อมบันทึก".
 *
 * A deny-list is the fix, not seven more names: the next field added to the state is
 * covered the day it is added, and anything genuinely not an answer has to be declared
 * above where it can be read. Keys are sorted so the hash cannot move just because the
 * store happened to gain a key in a different order.
 */
export function buildStateHash(state: ReturnType<typeof useApplicationFlowStore>['state']) {
  try {
    const entries = (Object.keys(state) as Array<keyof typeof state>)
      .filter((key) => !HASH_EXEMPT_KEYS.includes(key as string))
      .sort()
      .map((key) => [key, state[key]] as const);
    return JSON.stringify(entries);
  } catch {
    return '';
  }
}

export function useAutoSave(dependencies: AutoSaveDependencies = DEFAULT_DEPENDENCIES): UseAutoSaveReturn {
  const { state, setSyncStatus, setApplicationId } = dependencies.useApplicationFlowStore();
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    error: null,
    errorKind: null,
    draftId: null,
    syncState: 'IDLE',
    draftVersion: null,
    hasConflict: false,
    lawNotice: null,
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastStateHash = useRef<string>('');
  // Keep `draftVersion` available to the saveDraft closure without
  // re-creating the callback every time the version changes. Same
  // pattern as lastStateHash above; saveDraft is invoked via a ref
  // so capturing the latest version this way is safe.
  const draftVersionRef = useRef<number | null>(null);
  draftVersionRef.current = autoSaveState.draftVersion;

  const saveDraft = useCallback(async () => {
    // ด่านเดียวกับใน effect ด้านล่าง และเป็นด่านที่สองที่เคยถาม `plantId` — พืชคือคำถามของ
    // ขั้นที่ 4 ในรุ่นหกขั้น การถามที่นี่จึงแปลว่า "ห้ามบันทึกจนกว่าจะถึงขั้น 4" อีกที
    if (!wizardHasStarted(state)) {
      return;
    }

    setAutoSaveState((previous) => ({
      ...previous,
      isSaving: true,
      error: null,
      errorKind: null,
      syncState: 'SYNCING',
    }));
    setSyncStatus('PENDING');

    try {
      const draftStep = Math.max(
        1,
        (Number.isFinite(state.currentStep) ? state.currentStep : 0) + 1,
      );
      const draftData = {
        plantId: state.plantId,
        serviceType: state.serviceType,
        areaType: state.siteTypes?.[0] || 'OUTDOOR',
        purpose: state.certificationPurposes?.[0] || null, // Legacy: backend expects single purpose for sorting
        cultivationMethods: state.cultivationMethods,
        step: draftStep,
        currentStep: state.currentStep,
        // Optimistic-concurrency token. Sent only after the first
        // successful save (or first load); on the very first save
        // for a fresh wizard session this is null and the backend
        // takes the upsert path. Read via ref so the closure always
        // sees the latest version.
        expectedVersion: draftVersionRef.current ?? undefined,
        // ทุกคำตอบที่ผู้ยื่นให้ไว้ ไม่ใช่รายการที่พิมพ์ชื่อไว้ด้วยมือ (ดู answersForDraft
        // — รายการแบบนั้นค้างมาแล้วสามชุดบนเส้นทางเดียวกันนี้) · `locationType` เขียนทับ
        // ด้วยค่าที่คำนวณ เพื่อให้ร่างที่โหลดกลับมากับคำขอที่ยื่นแล้วตรงกัน
        formData: {
          ...answersForDraft(state),
          locationType: deriveLocationType(state),
        },
      };

      const response = await dependencies.api.post<DraftSaveResponse>('/applications/draft', draftData);

      if (!response.success) {
        // Distinguish DRAFT_VERSION_CONFLICT (409 — another tab won)
        // from generic save failures so the UI can prompt the user
        // to reload instead of silently retrying.
        const isConflict = response.error === 'DRAFT_VERSION_CONFLICT';
        if (isConflict) {
          setAutoSaveState((previous) => ({
            ...previous,
            isSaving: false,
            error: 'อีกแท็บได้บันทึกร่างไปก่อนหน้านี้แล้ว โปรดโหลดข้อมูลล่าสุด',
            errorKind: 'CONFLICT' as AutoSaveErrorKind,
            syncState: 'ERROR',
            hasConflict: true,
          }));
          setSyncStatus('ERROR');
          return;
        }
        const failure = classifyAutoSaveFailure(response.error, {
          ...(typeof navigator !== 'undefined' ? { isOnline: navigator.onLine } : {}),
        });
        setAutoSaveState((previous) => ({
          ...previous,
          isSaving: false,
          error: response.error || 'บันทึกร่างไม่สำเร็จ',
          errorKind: failure.errorKind,
          syncState: failure.syncState,
        }));
        setSyncStatus('ERROR');
        return;
      }

      const now = new Date();
      setAutoSaveState((previous) => ({
        ...previous,
        isDirty: false,
        isSaving: false,
        lastSavedAt: now,
        errorKind: null,
        draftId:
          response.data?.draftId
          || response.data?.id
          || previous.draftId,
        // Capture the new version so the next save sends it back as
        // expectedVersion. Server increments per save.
        draftVersion:
          typeof response.data?.version === 'number'
            ? response.data.version
            : previous.draftVersion,
        syncState: 'SYNCED',
        hasConflict: false,
        // null clears a notice the applicant has since fixed.
        lawNotice: response.data?.lawNotice ?? null,
      }));
      lastStateHash.current = buildStateHash(state);
      setSyncStatus('SYNCED');

      // Tell the WIZARD which application this now is — not just this hook's own state.
      //
      // The id was kept in `autoSaveState.draftId` and nowhere else, so the store's
      // `applicationId` stayed null after a perfectly successful save. Steps 2, 3 and 5 ask
      // the server for their document cards BY that id and skip the fetch when it is empty
      // (`if (!appId) return`), so the applicant saw those steps with no papers listed at
      // all and no message explaining why — the requirements lens was never asked.
      const savedId = response.data?.draftId || response.data?.id;
      if (savedId && savedId !== state.applicationId) {
        setApplicationId(savedId);
      }
    } catch (error: unknown) {
      const errorMessage = getAutoSaveErrorMessage(error) || 'Unable to connect to server';
      const failure = classifyAutoSaveFailure(errorMessage, {
        ...(typeof navigator !== 'undefined' ? { isOnline: navigator.onLine } : {}),
      });
      setAutoSaveState((previous) => ({
        ...previous,
        isSaving: false,
        error: 'ไม่สามารถบันทึกร่างได้ กรุณาลองใหม่อีกครั้ง',
        errorKind: failure.errorKind,
        syncState: failure.syncState,
      }));
      setSyncStatus('ERROR');
    }
  }, [state, setSyncStatus, setApplicationId, dependencies]);

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  const saveNow = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    await saveDraftRef.current();
  }, []);

  const markDirty = useCallback(() => {
    setAutoSaveState((previous) => ({
      ...previous,
      isDirty: true,
      syncState: previous.syncState === 'OFFLINE_RETRY' ? 'OFFLINE_RETRY' : 'DIRTY_LOCAL',
    }));
  }, []);

  const clearDraft = useCallback(async () => {
    if (autoSaveState.draftId) {
      try {
        await dependencies.api.delete<unknown>(`/applications/draft/${autoSaveState.draftId}`);
      } catch {
        // Keep local reset even if backend cleanup fails.
      }
    }

    setAutoSaveState({
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      error: null,
      errorKind: null,
      draftId: null,
      lawNotice: null,
      syncState: 'IDLE',
      draftVersion: null,
      hasConflict: false,
    });
    setSyncStatus('SYNCED');
    lastStateHash.current = '';
  }, [autoSaveState.draftId, setSyncStatus, dependencies]);

  // Called by the conflict-resolution UI after the user has reloaded
  // server data. Drops the local conflict flag so subsequent saves
  // don't keep nagging.
  const acknowledgeConflict = useCallback(() => {
    setAutoSaveState((previous) => ({
      ...previous,
      hasConflict: false,
      error: null,
      errorKind: null,
      syncState: 'IDLE',
    }));
  }, []);

  useEffect(() => {
    const currentHash = buildStateHash(state);
    if (!currentHash || currentHash === lastStateHash.current || !wizardHasStarted(state)) {
      return;
    }

    lastStateHash.current = currentHash;
    setAutoSaveState((previous) => ({
      ...previous,
      isDirty: true,
      syncState: previous.syncState === 'OFFLINE_RETRY' ? 'OFFLINE_RETRY' : 'DIRTY_LOCAL',
    }));

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      void saveDraftRef.current();
    }, DEBOUNCE_DELAY);

    // NO cleanup here, and that is the fix, not an omission.
    //
    // This effect used to return a cleanup that cleared the pending timer. It reads like
    // ordinary hygiene and it silently disabled autosave completely:
    //   1. an answer changes → the effect runs → it schedules the save AND calls
    //      setAutoSaveState (to raise `isDirty`), which is a state update;
    //   2. that update re-renders → the store hook builds a NEW `state` object (it composes
    //      one on every call), so `[state]` is a new dependency → the effect re-runs;
    //   3. the cleanup fires FIRST and cancels the timer, then the body returns early
    //      because the hash has not changed since step 1 — so nothing reschedules it.
    // The timer was cancelled by the very render its own setState caused, every time.
    // Measured in a browser 2026-09-06: the pill sat at "มีการเปลี่ยนแปลง (รอบันทึก)"
    // and not one POST /applications/draft ever left the page.
    //
    // Nothing leaks: a later change clears the pending timer before scheduling the next one
    // (just above), and unmount is handled by its own effect below.
  }, [state]);

  // The only moment the pending save must be dropped: this component is going away.
  useEffect(() => () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!autoSaveState.isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = 'คุณมีข้อมูลที่ยังไม่บันทึก';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoSaveState.isDirty]);

  useEffect(() => {
    const handleOnline = () => {
      if (!autoSaveState.isDirty) {
        return;
      }
      void saveNow();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autoSaveState.isDirty, saveNow]);

  return {
    ...autoSaveState,
    saveNow,
    markDirty,
    clearDraft,
    acknowledgeConflict,
  };
}

export default useAutoSave;
