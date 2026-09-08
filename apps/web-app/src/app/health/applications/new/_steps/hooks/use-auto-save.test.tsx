import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { jest } from '@jest/globals';

import { useAutoSave } from './use-auto-save';

type HookValue = ReturnType<typeof useAutoSave>;
type AutoSaveDependencies = NonNullable<Parameters<typeof useAutoSave>[0]>;
type ApplicationFlowStore = ReturnType<AutoSaveDependencies['useApplicationFlowStore']>;
type SyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';
type SetSyncStatusFn = (status: SyncStatus) => void;

type MockStoreState = {
  plantId: string | null;
  requestType?: string | null;
  serviceType: string | null;
  certificationPurposes: string[];
  cultivationMethods: string[];
  currentStep: number;
  applicantData: Record<string, unknown> | null;
  farmData: Record<string, unknown> | null;
  plots: unknown[];
  lots: unknown[];
  documents: unknown[];
  productionData: Record<string, unknown> | null;
  harvestData: Record<string, unknown> | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'ERROR';
};

type MockStoreReturn = {
  state: MockStoreState;
  setSyncStatus: jest.MockedFunction<SetSyncStatusFn>;
  setApplicationId: jest.MockedFunction<(id: string) => void>;
};

type MockApiResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

type MockApi = {
  post: jest.MockedFunction<(url: string, payload: unknown) => Promise<MockApiResponse>>;
  delete: jest.MockedFunction<(url: string) => Promise<MockApiResponse>>;
};

function createMockStore(overrides: Partial<MockStoreState> = {}): MockStoreReturn {
  const state: MockStoreState = {
    plantId: 'cannabis',
    requestType: null,
    serviceType: 'NEW',
    certificationPurposes: ['MEDICAL'],
    cultivationMethods: ['outdoor'],
    currentStep: 2,
    applicantData: { applicantType: 'INDIVIDUAL', firstName: 'Test' },
    farmData: { farmName: 'Farm A' },
    plots: [],
    lots: [],
    documents: [],
    productionData: null,
    harvestData: null,
    syncStatus: 'SYNCED',
    ...overrides,
  };

  return {
    state,
    setSyncStatus: jest.fn(),
    setApplicationId: jest.fn(),
  };
}

function HookHarness({
  onChange,
  dependencies,
}: {
  onChange: (value: HookValue) => void;
  dependencies: AutoSaveDependencies;
}) {
  const hook = useAutoSave(dependencies);

  useEffect(() => {
    onChange(hook);
  }, [hook, onChange]);

  return null;
}

describe('useAutoSave (mock API)', () => {
  let container: HTMLDivElement | null;
  let root: Root | null;
  let latestHook: HookValue | null;
  let mockStore: MockStoreReturn;
  let mockApi: MockApi;
  let mockUseApplicationFlowStore: jest.MockedFunction<() => ApplicationFlowStore>;
  let dependencies: AutoSaveDependencies;

  const onChange = jest.fn((value: HookValue) => {
    latestHook = value;
  });

  function renderHookWithStore(overrides: Partial<MockStoreState> = {}) {
    mockStore = createMockStore(overrides);
    mockUseApplicationFlowStore.mockImplementation(
      () => mockStore as unknown as ApplicationFlowStore,
    );

    act(() => {
      root?.render(<HookHarness onChange={onChange} dependencies={dependencies} />);
    });
  }

  async function callSaveNow() {
    if (!latestHook) {
      throw new Error('Hook not rendered');
    }
    await act(async () => {
      await latestHook!.saveNow();
    });
  }

  async function callClearDraft() {
    if (!latestHook) {
      throw new Error('Hook not rendered');
    }
    await act(async () => {
      await latestHook!.clearDraft();
    });
  }

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    jest.useFakeTimers();
    jest.clearAllMocks();
    latestHook = null;
    onChange.mockClear();

    mockApi = {
      post: jest.fn(),
      delete: jest.fn(),
    };

    mockUseApplicationFlowStore = jest.fn();
    dependencies = {
      useApplicationFlowStore:
        mockUseApplicationFlowStore as unknown as AutoSaveDependencies['useApplicationFlowStore'],
      api: mockApi as unknown as AutoSaveDependencies['api'],
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  /**
   * เทสทุกตัวในไฟล์นี้เรียก saveNow() เอง ซึ่ง **ข้าม debounce** ไปเลย เส้นทางที่ผู้ใช้จริงเดิน
   * — พิมพ์แล้วปล่อยให้มันบันทึกเอง — จึงไม่เคยถูกทดสอบสักครั้ง และมันไม่ทำงาน
   *
   * กลไก: effect ที่เฝ้า [state] ตั้ง timer ไว้ แล้วเรียก setAutoSaveState ในตัวมันเอง
   * ⇒ เกิด render ใหม่ ⇒ cleanup ของ effect เดิมล้าง timer ทิ้ง ⇒ รอบใหม่แฮชไม่เปลี่ยนแล้ว
   * จึง return ก่อนตั้ง timer ใหม่ · ผลคือ **timer ถูกยกเลิกเสมอ ไม่มีการบันทึกอัตโนมัติเลย**
   *
   * เห็นตอนเดินจริงผ่านเบราว์เซอร์ 2026-09-06: ป้ายค้างที่ "มีการเปลี่ยนแปลง (รอบันทึก)"
   * ตลอดกาล และไม่มี POST /applications/draft ออกไปเลยแม้แต่ครั้งเดียว
   */
  it('บันทึกเองหลัง debounce โดยผู้ใช้ไม่ต้องกดอะไร', async () => {
    // สโตร์จริงประกอบ object `state` ขึ้นใหม่ทุกครั้งที่ถูกเรียก (use-application-flow-store.ts
    // สร้าง `const state: WizardState = {...}` ในตัวฮุก) ⇒ ตัวตนของ state เปลี่ยนทุก render
    // · mock เดิมคืน object เดิมเสมอ ซึ่ง **กลบ** พฤติกรรมนั้น และกลบบั๊กนี้ไปด้วย
    mockStore = createMockStore({ requestType: 'NEW' } as Partial<MockStoreState>);
    mockUseApplicationFlowStore.mockImplementation(() => ({
      state: { ...mockStore.state },
      setSyncStatus: mockStore.setSyncStatus,
      setApplicationId: mockStore.setApplicationId,
    } as unknown as ApplicationFlowStore));
    mockApi.post.mockResolvedValueOnce({ success: true, data: { draftId: 'draft-1' } });
    act(() => {
      root?.render(<HookHarness onChange={onChange} dependencies={dependencies} />);
    });

    // ผู้ใช้ตอบคำถามแล้วปล่อยมือ — ไม่มีการกดปุ่มบันทึกใด ๆ ทั้งสิ้น
    await act(async () => {
      jest.advanceTimersByTime(3500);
      await Promise.resolve();
    });

    expect(dependencies.api.post).toHaveBeenCalledWith(
      '/applications/draft',
      expect.objectContaining({ formData: expect.objectContaining({ requestType: 'NEW' }) }),
    );

    // และคำขอที่เพิ่งเกิดต้องถูกบอกกลับเข้าสโตร์ · ขั้น 2/3/5 ดึงรายการเอกสารด้วย id นี้
    // ถ้าไม่บอก การบันทึกสำเร็จก็ยังไม่มีการ์ดเอกสารสักใบให้ผู้ยื่นเห็น
    expect(mockStore.setApplicationId).toHaveBeenCalledWith('draft-1');
  });

  it('uses the backend id as draftId without inventing a client sync version on successful save', async () => {
    mockApi.post.mockResolvedValueOnce({
      success: true,
      data: { id: 'draft-from-backend-id' },
    });

    renderHookWithStore();
    await callSaveNow();

    expect(mockApi.post).toHaveBeenCalledWith('/applications/draft', expect.any(Object));
    expect(latestHook?.draftId).toBe('draft-from-backend-id');
    expect(latestHook?.syncState).toBe('SYNCED');
    expect(latestHook?.errorKind).toBeNull();
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(1, 'PENDING');
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(2, 'SYNCED');
  });

  it('posts the canonical 1-based step field alongside currentStep when saving drafts', async () => {
    mockApi.post.mockResolvedValueOnce({
      success: true,
      data: { draftId: 'draft-123' },
    });

    renderHookWithStore({ currentStep: 2 });
    await callSaveNow();

    expect(mockApi.post).toHaveBeenCalledWith(
      '/applications/draft',
      expect.objectContaining({
        currentStep: 2,
        step: 3,
      }),
    );
  });

  it('calls delete cleanup route with saved draftId and resets local autosave state', async () => {
    mockApi.post.mockResolvedValueOnce({
      success: true,
      data: { draftId: 'draft-123' },
    });
    mockApi.delete.mockResolvedValueOnce({ success: true });

    renderHookWithStore();
    await callSaveNow();
    await callClearDraft();

    expect(mockApi.delete).toHaveBeenCalledWith('/applications/draft/draft-123');
    expect(latestHook?.draftId).toBeNull();
    expect(latestHook?.isDirty).toBe(false);
    expect(latestHook?.error).toBeNull();
    expect(latestHook?.syncState).toBe('IDLE');
    expect(mockStore.setSyncStatus).toHaveBeenLastCalledWith('SYNCED');
  });

  it('classifies unsuccessful auth responses as error (not offline retry)', async () => {
    mockApi.post.mockResolvedValueOnce({
      success: false,
      error: 'Session expired. Please sign in again',
    });

    renderHookWithStore();
    await callSaveNow();

    expect(latestHook?.syncState).toBe('ERROR');
    expect(latestHook?.errorKind).toBe('AUTH');
    expect(latestHook?.isSaving).toBe(false);
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(1, 'PENDING');
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(2, 'ERROR');
  });

  it('classifies thrown network failures as offline retry when browser is offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    mockApi.post.mockRejectedValueOnce(new Error('network down'));

    renderHookWithStore();
    await callSaveNow();

    expect(latestHook?.syncState).toBe('OFFLINE_RETRY');
    expect(latestHook?.errorKind).toBe('OFFLINE');
    expect(latestHook?.isSaving).toBe(false);
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(1, 'PENDING');
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(2, 'ERROR');
  });

  it('classifies thrown online failures as server errors instead of offline retry', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    mockApi.post.mockRejectedValueOnce(new Error('Failed to save application'));

    renderHookWithStore();
    await callSaveNow();

    expect(latestHook?.syncState).toBe('ERROR');
    expect(latestHook?.errorKind).toBe('SERVER');
    expect(latestHook?.isSaving).toBe(false);
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(1, 'PENDING');
    expect(mockStore.setSyncStatus).toHaveBeenNthCalledWith(2, 'ERROR');
  });

  // ─── Optimistic concurrency (2-tab race protection) ──────────────────
  describe('optimistic concurrency', () => {
    it('captures version from server response and echoes it on next save', async () => {
      mockApi.post
        .mockResolvedValueOnce({ success: true, data: { id: 'd1', version: 1 } })
        .mockResolvedValueOnce({ success: true, data: { id: 'd1', version: 2 } });

      renderHookWithStore();
      await callSaveNow();
      expect(latestHook?.draftVersion).toBe(1);

      await callSaveNow();
      expect(latestHook?.draftVersion).toBe(2);
      // Second call must echo the v1 it captured from the first.
      expect(mockApi.post).toHaveBeenNthCalledWith(
        2,
        '/applications/draft',
        expect.objectContaining({ expectedVersion: 1 }),
      );
    });

    it('does not send expectedVersion on the very first save (no version yet)', async () => {
      mockApi.post.mockResolvedValueOnce({
        success: true,
        data: { id: 'd1', version: 1 },
      });

      renderHookWithStore();
      await callSaveNow();

      // expectedVersion should be `undefined` (omitted), not 0.
      const firstCallPayload = mockApi.post.mock.calls[0][1] as Record<string, unknown>;
      expect(firstCallPayload.expectedVersion).toBeUndefined();
    });

    it('surfaces DRAFT_VERSION_CONFLICT as a CONFLICT error kind', async () => {
      mockApi.post
        .mockResolvedValueOnce({ success: true, data: { id: 'd1', version: 1 } })
        .mockResolvedValueOnce({ success: false, error: 'DRAFT_VERSION_CONFLICT' });

      renderHookWithStore();
      await callSaveNow();
      await callSaveNow();

      expect(latestHook?.hasConflict).toBe(true);
      expect(latestHook?.errorKind).toBe('CONFLICT');
      expect(latestHook?.syncState).toBe('ERROR');
    });

    it('acknowledgeConflict() drops the conflict state for retry', async () => {
      mockApi.post
        .mockResolvedValueOnce({ success: true, data: { id: 'd1', version: 1 } })
        .mockResolvedValueOnce({ success: false, error: 'DRAFT_VERSION_CONFLICT' });

      renderHookWithStore();
      await callSaveNow();
      await callSaveNow();

      expect(latestHook?.hasConflict).toBe(true);

      act(() => {
        latestHook?.acknowledgeConflict();
      });

      expect(latestHook?.hasConflict).toBe(false);
      expect(latestHook?.errorKind).toBeNull();
      expect(latestHook?.syncState).toBe('IDLE');
    });
  });
});
