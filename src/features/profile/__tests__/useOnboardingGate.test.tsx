import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { baseApi } from '@/store/baseApi';
import { seededStore } from '@/test/profileFixtures';

import { useOnboardingGate } from '../hooks/useOnboardingGate';
import { stickyGate } from '../lib/gate';

describe('useOnboardingGate (keyboard fix: no spinner after the first answer)', () => {
  it('a later profile reload keeps the settled gate; another account starts over', async () => {
    const { store } = await seededStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = await renderHook(() => useOnboardingGate(true), { wrapper });
    expect(result.current).toBe('onboard');

    // Cache dropped (e.g. a refetch or reset): still 'onboard', not 'loading'.
    await act(async () => {
      store.dispatch(baseApi.util.resetApiState());
    });
    expect(result.current).toBe('onboard');
  });

  it('signed out is always done', async () => {
    const { store } = await seededStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = await renderHook(() => useOnboardingGate(false), { wrapper });
    expect(result.current).toBe('done');
  });
});

describe('stickyGate', () => {
  it('keeps the settled answer for the same account only', () => {
    expect(stickyGate('loading', { user: 'a', gate: 'done' }, 'a')).toBe('done');
    expect(stickyGate('loading', { user: 'a', gate: 'done' }, 'b')).toBe('loading');
    expect(stickyGate('loading', null, 'a')).toBe('loading');
    // Setup can't be undone: a stale read saying 'onboard' never flips back.
    expect(stickyGate('onboard', { user: 'a', gate: 'done' }, 'a')).toBe('done');
    expect(stickyGate('onboard', { user: 'b', gate: 'done' }, 'a')).toBe('onboard');
    expect(stickyGate('done', { user: 'a', gate: 'onboard' }, 'a')).toBe('done');
  });
});
