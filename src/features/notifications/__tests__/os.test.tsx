import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { useNotificationRouting } from '../hooks/useNotificationRouting';
import { useReminderSync } from '../hooks/useReminderSync';
import { applySchedule, configureNotifications, routeFor, scheduleKey } from '../os';
import type { Reminder } from '../schedule';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const granted = () => N.getPermissionsAsync.mockResolvedValueOnce({ granted: true } as never);
const NOW = Date.parse('2026-11-23T00:00:00Z');
const r = (id: string, minutes: number, url = '/today'): Reminder => ({
  id,
  date: '2026-11-23',
  at: NOW + minutes * 60_000,
  type: 'block',
  title: id,
  body: 'b',
  url,
});

beforeEach(() => jest.clearAllMocks());

describe('applySchedule', () => {
  it('replaces every reminder with the future ones (date trigger, url in data)', async () => {
    granted();
    await expect(applySchedule([r('past', -5), r('a', 10, '/meal/lunch')], NOW)).resolves.toBe(1);
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'a',
      content: { title: 'a', body: 'b', data: { url: '/meal/lunch' } },
      trigger: { type: 'date', date: new Date(NOW + 600_000) },
    });
  });

  it('does nothing without permission', async () => {
    await expect(applySchedule([r('a', 10)], NOW)).resolves.toBe(0);
    N.getPermissionsAsync.mockRejectedValueOnce(new Error('x'));
    await expect(applySchedule([r('a', 10)], NOW)).resolves.toBe(0);
    expect(N.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });

  it('configureNotifications shows banners in the foreground', async () => {
    await configureNotifications();
    const handler = N.setNotificationHandler.mock.calls[0]![0]!;
    await expect(handler.handleNotification({} as never)).resolves.toMatchObject({
      shouldShowBanner: true,
    });
  });

  it('scheduleKey changes with any reminder field', () => {
    expect(scheduleKey([r('a', 1)])).not.toBe(scheduleKey([{ ...r('a', 1), body: 'x' }]));
  });
});

describe('F15 AC3: tapping a notification opens the right screen', () => {
  it('routeFor only allows known screens', () => {
    expect(routeFor({ url: '/meal/breakfast' })).toBe('/meal/breakfast');
    expect(routeFor({ url: '/water' })).toBe('/water');
    expect(routeFor({ url: '/train' })).toBe('/train');
    expect(routeFor({ url: '/meal/brunch' })).toBeNull();
    expect(routeFor({ url: 'https://evil.example' })).toBeNull();
    expect(routeFor({})).toBeNull();
    expect(routeFor(null)).toBeNull();
  });

  it('listener pushes the screen; a cold-start tap is handled too; off when disabled', async () => {
    const response = (url: string) => ({
      notification: { request: { content: { data: { url } } } },
    });
    N.getLastNotificationResponseAsync.mockResolvedValueOnce(response('/water') as never);
    const { unmount } = await renderHook(() => useNotificationRouting(true));
    await act(async () => undefined);
    expect(mockRouter.push).toHaveBeenCalledWith('/water');
    const listener = N.addNotificationResponseReceivedListener.mock.calls[0]![0];
    listener(response('/meal/lunch') as never);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/meal/lunch');
    listener(response('/nope') as never);
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
    await unmount();

    jest.clearAllMocks();
    await renderHook(() => useNotificationRouting(false));
    expect(N.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
  });
});

describe('useReminderSync', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces, applies once per change, skips unchanged schedules', async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const future = Date.now() + 3_600_000;
    const a = [{ ...r('a', 0), at: future }];
    const { rerender } = await renderHook(({ rs }: { rs: Reminder[] }) => useReminderSync(rs), {
      initialProps: { rs: a },
    });
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    await rerender({ rs: [...a] }); // same content
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    await rerender({ rs: [{ ...a[0]!, title: 'changed' }] });
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    N.getPermissionsAsync.mockReset();
  });
});
