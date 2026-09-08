import { renderToStaticMarkup } from 'react-dom/server';
import { AutoSaveIndicator } from './auto-save-indicator';

describe('AutoSaveIndicator', () => {
  it('shows dirty-local state without syncing spinner while waiting for debounce', () => {
    const html = renderToStaticMarkup(
      <AutoSaveIndicator
        isDirty
        isSaving={false}
        lastSavedAt={null}
        error={null}
        syncState="DIRTY_LOCAL"
      />,
    );

    expect(html).toContain('data-testid="auto-save-indicator"');
    expect(html).toContain('data-state="dirty-local"');
    expect(html).not.toContain('animate-spin');
  });

  it('shows syncing state when a request is in flight', () => {
    const html = renderToStaticMarkup(
      <AutoSaveIndicator
        isDirty
        isSaving={false}
        lastSavedAt={null}
        error={null}
        syncState="SYNCING"
      />,
    );

    expect(html).toContain('data-state="syncing"');
    expect(html).toContain('animate-spin');
  });

  it('shows offline-retry state distinctly from generic errors', () => {
    const html = renderToStaticMarkup(
      <AutoSaveIndicator
        isDirty
        isSaving={false}
        lastSavedAt={null}
        error="Unable to connect to server"
        errorKind="OFFLINE"
        syncState="OFFLINE_RETRY"
      />,
    );

    expect(html).toContain('data-state="offline-retry"');
  });

  it('shows auth errors as error state (not offline retry)', () => {
    const html = renderToStaticMarkup(
      <AutoSaveIndicator
        isDirty
        isSaving={false}
        lastSavedAt={null}
        error="Session expired. Please sign in again"
        errorKind="AUTH"
        syncState="ERROR"
      />,
    );

    expect(html).toContain('data-state="auth-error"');
    expect(html).not.toContain('data-state="offline-retry"');
  });
});
