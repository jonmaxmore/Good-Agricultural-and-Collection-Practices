import { classifyAutoSaveFailure } from './auto-save-status';

describe('classifyAutoSaveFailure', () => {
  it('classifies network failures as offline retry', () => {
    expect(classifyAutoSaveFailure('Unable to connect to server')).toEqual({
      syncState: 'OFFLINE_RETRY',
      errorKind: 'OFFLINE',
    });
  });

  it('classifies auth failures separately from offline failures', () => {
    expect(classifyAutoSaveFailure('Session expired. Please sign in again')).toEqual({
      syncState: 'ERROR',
      errorKind: 'AUTH',
    });
  });

  it('classifies generic backend failures as server errors', () => {
    expect(classifyAutoSaveFailure('Failed to save application')).toEqual({
      syncState: 'ERROR',
      errorKind: 'SERVER',
    });
  });
});
