'use client';

import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type {
  AutoSaveErrorKind,
  AutoSaveSyncState,
} from '@/app/health/applications/hooks/auto-save-status';

interface AutoSaveIndicatorProps {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  errorKind?: AutoSaveErrorKind | null;
  syncState?: AutoSaveSyncState;
  syncStatus?: 'SYNCED' | 'PENDING' | 'ERROR';
}

// Show CONFLICT before generic ERROR — it has a different recovery
// path (reload server data) and a different message tone.

function formatTime(date: Date): string {
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export function AutoSaveIndicator({
  isDirty,
  isSaving,
  lastSavedAt,
  error,
  errorKind,
  syncState,
  syncStatus,
}: AutoSaveIndicatorProps) {
  const effectiveSyncState: AutoSaveSyncState | undefined = syncState
    ?? (syncStatus === 'PENDING' ? (isSaving ? 'SYNCING' : isDirty ? 'DIRTY_LOCAL' : 'SYNCING')
      : syncStatus === 'ERROR' ? 'ERROR'
        : syncStatus === 'SYNCED' ? 'SYNCED'
          : undefined);
  if (effectiveSyncState === 'OFFLINE_RETRY') {
    return (
      <span
        data-testid="auto-save-indicator"
        data-state="offline-retry"
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
        title={error || 'ระบบออฟไลน์ ข้อมูลถูกเก็บไว้ในเครื่องและจะลองซิงค์ใหม่'}
      >
        <Icons.AlertTriangle size={13} />
        รอซิงค์เมื่อออนไลน์
      </span>
    );
  }

  if (errorKind === 'CONFLICT') {
    return (
      <span
        data-testid="auto-save-indicator"
        data-state="conflict"
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
        title={error ?? 'อีกแท็บได้บันทึกร่างไปก่อนหน้านี้แล้ว โปรดโหลดข้อมูลล่าสุด'}
      >
        <Icons.AlertTriangle size={13} />
        แท็บอื่นบันทึกแล้ว โปรดรีโหลด
      </span>
    );
  }

  if (effectiveSyncState === 'ERROR' || error) {
    const label = errorKind === 'AUTH' ? 'เซสชันหมดอายุ' : 'บันทึกไม่สำเร็จ';
    return (
      <span
        data-testid="auto-save-indicator"
        data-state={errorKind === 'AUTH' ? 'auth-error' : 'error'}
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
        title={error ?? undefined}
      >
        <Icons.AlertTriangle size={13} />
        {label}
      </span>
    );
  }

  if (isSaving || effectiveSyncState === 'SYNCING') {
    return (
      <span
        data-testid="auto-save-indicator"
        data-state="syncing"
        className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700"
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" aria-hidden="true" />
        กำลังซิงค์ข้อมูล...
      </span>
    );
  }

  if (isDirty || effectiveSyncState === 'DIRTY_LOCAL') {
    return (
      <span
        data-testid="auto-save-indicator"
        data-state="dirty-local"
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
      >
        <Icons.Edit size={13} />
        มีการเปลี่ยนแปลง (รอบันทึก)
      </span>
    );
  }

  return (
    <span
      data-testid="auto-save-indicator"
      data-state={lastSavedAt ? 'synced' : 'idle'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        lastSavedAt ? 'bg-leaf-soft text-leaf-onSoft' : 'bg-muted text-muted-foreground',
      )}
      title={lastSavedAt ? `บันทึกล่าสุด ${lastSavedAt.toLocaleString('th-TH')}` : 'ยังไม่มีการบันทึก'}
    >
      {lastSavedAt ? <Icons.Check size={13} /> : <Icons.Clock size={13} />}
      {lastSavedAt ? `บันทึกแล้ว ${formatTime(lastSavedAt)}` : 'พร้อมบันทึก'}
    </span>
  );
}

export default AutoSaveIndicator;
