export type AutoSaveSyncState =
  | 'IDLE'
  | 'DIRTY_LOCAL'
  | 'SYNCING'
  | 'SYNCED'
  | 'OFFLINE_RETRY'
  | 'ERROR';

export type AutoSaveErrorKind = 'OFFLINE' | 'AUTH' | 'SERVER' | 'UNKNOWN' | 'CONFLICT';

interface ClassifyAutoSaveFailureOptions {
  isOnline?: boolean;
}

export function classifyAutoSaveFailure(
  errorMessage?: string | null,
  options: ClassifyAutoSaveFailureOptions = {},
): { syncState: AutoSaveSyncState; errorKind: AutoSaveErrorKind } {
  const raw = String(errorMessage || '').trim();
  const normalized = raw.toLowerCase();

  if (options.isOnline === false) {
    return { syncState: 'OFFLINE_RETRY', errorKind: 'OFFLINE' };
  }

  const offlineSignals = [
    'unable to connect to server',
    'request timeout',
    'failed to fetch',
    'network request failed',
    'networkerror',
    'timeout',
  ];

  if (offlineSignals.some((signal) => normalized.includes(signal))) {
    return { syncState: 'OFFLINE_RETRY', errorKind: 'OFFLINE' };
  }

  const authSignals = [
    'session expired',
    'sign in again',
    'unauthorized',
    'invalid token',
    'token has expired',
    'authentication failed',
  ];

  if (authSignals.some((signal) => normalized.includes(signal))) {
    return { syncState: 'ERROR', errorKind: 'AUTH' };
  }

  if (!raw) {
    return { syncState: 'ERROR', errorKind: 'UNKNOWN' };
  }

  return { syncState: 'ERROR', errorKind: 'SERVER' };
}
