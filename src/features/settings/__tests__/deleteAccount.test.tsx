import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore, seededStore } from '@/test/profileFixtures';

import { SettingsScreen } from '../components/SettingsScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const queueWrite = (owner: string, id: string) => ({
  type: 'sync/enqueued',
  payload: {
    write: { client_id: id, table: 'water_log', op: 'upsert', row: {}, owner, is_new: true },
    now: 1,
  },
});

describe('Delete account (F25)', () => {
  it('needs DELETE typed; deletes on the server, drops its unsent writes, signs out', async () => {
    const { store, fake } = await seededStore();
    const me = store.getState().auth.user!.id;
    store.dispatch(queueWrite(me, 'mine'));
    store.dispatch(queueWrite('someone-else', 'theirs'));
    await renderWithStore(store, <SettingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    const go = screen.getByRole('button', { name: 'Delete my account permanently' });
    expect(go).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    expect(go).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await act(async () => {
      await fireEvent.press(go);
    });

    const invoke = (fake.client as unknown as { functions: { invoke: jest.Mock } }).functions
      .invoke;
    expect(invoke).toHaveBeenCalledWith('delete-account', { body: { confirm: 'DELETE' } });
    expect(fake.auth.signOut).toHaveBeenCalled();
    expect(store.getState().auth.status).toBe('signedOut');
    expect(store.getState().sync.queue.map((m) => m.client_id)).toEqual(['theirs']);
  });

  it('offline: shows the error and keeps the account; "Keep my account" closes', async () => {
    const { store, fake } = await seededStore();
    (
      fake.client as unknown as { functions: { invoke: jest.Mock } }
    ).functions.invoke.mockResolvedValueOnce({ data: null, error: new Error('network') });
    await renderWithStore(store, <SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Delete my account permanently' }));
    });
    expect(
      screen.getByText('Could not delete the account. Check your connection.'),
    ).toBeOnTheScreen();
    expect(store.getState().auth.status).toBe('signedIn');
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByTestId('delete-account')).toBeNull();
  });
});
