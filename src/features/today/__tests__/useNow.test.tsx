import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useNow } from '../hooks/useNow';

describe('useNow', () => {
  it('ticks on the interval and when the app becomes active', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-11-23T21:29:00Z') });
    let onChange: ((s: string) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => {
      onChange = cb as (s: string) => void;
      return { remove } as never;
    });
    const { result, unmount } = await renderHook(() => useNow(30_000));
    const start = result.current;
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(start + 30_000);
    jest.setSystemTime(start + 45_000);
    await act(async () => onChange?.('active'));
    expect(result.current).toBe(start + 45_000);
    await act(async () => onChange?.('background'));
    expect(result.current).toBe(start + 45_000);
    await unmount();
    expect(remove).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
