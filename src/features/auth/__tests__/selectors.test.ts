import { makeStore } from '@/store';
import { fakeSupabase } from '@/test/fakeSupabase';

import { selectAuth, selectAuthStatus, selectIsSignedIn, selectUser } from '../selectors';
import { sessionChanged } from '../slice';

describe('auth selectors', () => {
  it('reflect the session', () => {
    const fake = fakeSupabase();
    const store = makeStore({
      getSupabase: () => fake.client,
      isConfigured: true,
      storageKey: 'k',
    });
    expect(selectAuthStatus(store.getState())).toBe('restoring');
    expect(selectIsSignedIn(store.getState())).toBe(false);
    store.dispatch(sessionChanged({ id: 'u1', email: 'a@b.co' }));
    expect(selectIsSignedIn(store.getState())).toBe(true);
    expect(selectUser(store.getState())).toEqual({ id: 'u1', email: 'a@b.co' });
    expect(selectAuth(store.getState()).status).toBe('signedIn');
  });
});
