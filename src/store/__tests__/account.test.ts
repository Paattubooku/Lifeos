import * as Notifications from 'expo-notifications';

import { sessionChanged } from '@/features/auth/slice';
import { profileSlice } from '@/features/profile/slice';
import { stepsSlice } from '@/features/steps/slice';

import { accountSet, setThemePreference } from '../appSlice';
import { makeStore } from '../index';

const user = (id: string) => ({ id, email: `${id}@example.com` });
const tick = () => new Promise((r) => setTimeout(r, 0));

/** F25: several accounts on one phone never see each other's cached data. */
describe('account switch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('remembers the first account without clearing (phones cached before F25)', async () => {
    const store = makeStore();
    store.dispatch(stepsSlice.actions.motionLinked('on'));
    store.dispatch(sessionChanged(user('a')));
    await tick();
    expect(store.getState().app.account).toBe('a');
    expect(store.getState().steps.motion).toBe('on');
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });

  it('sign-out clears cached data and reminders but keeps the theme and the write queue', async () => {
    const store = makeStore();
    store.dispatch(sessionChanged(user('a')));
    await tick();
    store.dispatch(setThemePreference('light'));
    store.dispatch(stepsSlice.actions.motionLinked('on'));
    store.dispatch({
      type: 'sync/enqueued',
      payload: {
        write: {
          client_id: 'w1',
          table: 'water_log',
          op: 'upsert',
          row: {},
          owner: 'a',
          is_new: true,
        },
        now: 1,
      },
    });
    store.dispatch(sessionChanged(null));
    await tick();
    const s = store.getState();
    expect(s.steps).toEqual(stepsSlice.reducer(undefined, { type: 'init' }));
    expect(s.app.account).toBeNull();
    expect(s.app.themePreference).toBe('light');
    expect(s.sync.queue.map((m) => m.owner)).toEqual(['a']);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('sign-out deletes leftover data exports from the phone, nothing else', async () => {
    const { File, Paths, __files } = jest.requireMock('expo-file-system') as {
      File: new (d: { uri: string }, n: string) => { create(): void; uri: string };
      Paths: { cache: { uri: string } };
      __files: Map<string, string>;
    };
    new File(Paths.cache, 'lifeos-2026-11-24.json').create();
    new File(Paths.cache, 'lifeos-2026-11-24-csv.zip').create();
    new File(Paths.cache, 'other.txt').create();
    const store = makeStore();
    store.dispatch(sessionChanged(user('a')));
    await tick();
    store.dispatch(sessionChanged(null));
    await tick();
    expect([...__files.keys()].filter((k) => k.startsWith(Paths.cache.uri))).toEqual([
      `${Paths.cache.uri}/other.txt`,
    ]);
  });

  it('another account restored over cached data clears it first', async () => {
    const store = makeStore();
    store.dispatch(accountSet('a'));
    store.dispatch(profileSlice.actions.draftStarted({} as never));
    store.dispatch(sessionChanged(user('b')));
    await tick();
    expect(store.getState().app.account).toBe('b');
    expect(store.getState().profile).toEqual(profileSlice.reducer(undefined, { type: 'init' }));
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('the same account again keeps its cache', async () => {
    const store = makeStore();
    store.dispatch(accountSet('a'));
    store.dispatch(stepsSlice.actions.motionLinked('on'));
    store.dispatch(sessionChanged(user('a')));
    await tick();
    expect(store.getState().steps.motion).toBe('on');
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});
