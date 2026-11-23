import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';
import { palettes, withAlpha } from '@/ui';

import { SyncStatusCard } from '../components/SyncStatusCard';
import type { SyncSummary } from '../selectors';

const T = 1_700_000_000_000;
const summary = (over: Partial<SyncSummary>): SyncSummary => ({
  status: 'synced',
  pending: 0,
  dead: 0,
  lastSyncedAt: T - 120_000,
  lastError: null,
  ...over,
});

describe('SyncStatusCard', () => {
  it('synced: matches the design copy, success tint, Sync button', async () => {
    const onSync = jest.fn();
    await renderWithTheme(
      <SyncStatusCard summary={summary({})} onSync={onSync} onRetry={jest.fn()} now={() => T} />,
    );
    expect(screen.getByLabelText('Synced 2 min ago. 0 pending')).toBeOnTheScreen();
    expect(screen.getByTestId('sync-status')).toHaveStyle({
      backgroundColor: withAlpha(palettes.dark.accents.success.base, 0.08),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(onSync).toHaveBeenCalled();
  });

  it('offline with pending writes explains they are safe', async () => {
    await renderWithTheme(
      <SyncStatusCard
        summary={summary({ status: 'offline', pending: 5 })}
        onSync={jest.fn()}
        onRetry={jest.fn()}
        now={() => T}
      />,
    );
    expect(
      screen.getByLabelText(
        'Offline. 5 pending. Saved on this phone. Syncs when you’re back online.',
      ),
    ).toBeOnTheScreen();
  });

  it('sync issue: alert with the error and a Retry button', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(
      <SyncStatusCard
        summary={summary({ status: 'issue', dead: 2, pending: 1, lastError: 'check violation' })}
        onSync={jest.fn()}
        onRetry={onRetry}
        now={() => T}
      />,
    );
    expect(screen.getByRole('alert')).toHaveProp(
      'accessibilityLabel',
      'Sync issue. 2 failed · 1 pending. check violation',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Retry 2 failed changes' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('sync issue with one failure and no message', async () => {
    await renderWithTheme(
      <SyncStatusCard
        summary={summary({ status: 'issue', dead: 1 })}
        onSync={jest.fn()}
        onRetry={jest.fn()}
        now={() => T}
      />,
    );
    expect(screen.getByRole('button', { name: 'Retry 1 failed change' })).toBeOnTheScreen();
    expect(screen.getByText('Some changes were rejected by the server.')).toBeOnTheScreen();
  });

  it('syncing disables the button; never-synced reads "Not synced yet"', async () => {
    const { rerender } = await renderWithTheme(
      <SyncStatusCard
        summary={summary({ status: 'syncing', pending: 3 })}
        onSync={jest.fn()}
        onRetry={jest.fn()}
        now={() => T}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(screen.getByLabelText('Syncing…. 3 pending')).toBeOnTheScreen();
    await rerender(
      <SyncStatusCard
        summary={summary({ status: 'never', lastSyncedAt: null })}
        onSync={jest.fn()}
        onRetry={jest.fn()}
        now={() => T}
      />,
    );
    expect(screen.getByLabelText('Not synced yet. 0 pending')).toBeOnTheScreen();
  });

  it('refreshes the "ago" text every 30 s', async () => {
    jest.useFakeTimers();
    let t = T;
    await renderWithTheme(
      <SyncStatusCard
        summary={summary({ lastSyncedAt: T })}
        onSync={jest.fn()}
        onRetry={jest.fn()}
        now={() => t}
      />,
    );
    expect(screen.getByLabelText('Synced just now. 0 pending')).toBeOnTheScreen();
    t += 5 * 60_000;
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(screen.getByLabelText('Synced 5 min ago. 0 pending')).toBeOnTheScreen();
    jest.useRealTimers();
  });
});

describe('withAlpha', () => {
  it('converts a hex token to rgba and leaves other strings alone', () => {
    expect(withAlpha('#34D399', 0.3)).toBe('rgba(52,211,153,0.3)');
    expect(withAlpha('rgba(1,2,3,1)', 0.5)).toBe('rgba(1,2,3,1)');
  });
});
