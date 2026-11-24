import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { ProgramEditScreen } from '../components/ProgramEditScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const queued = (store: Store) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === 'workout_exercise')
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('Program editor (F23)', () => {
  it('edit sets and rest, swap, add and remove; Save writes only the changes', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <ProgramEditScreen now={at('12:00')} dayId="d1" />);
    expect(screen.getByText('Edit Upper A')).toBeOnTheScreen();
    const first = screen.getAllByRole('button', { name: /\. Edit$/ })[0]!;
    const name = String(first.props.accessibilityLabel).split(',')[0]!;
    await act(async () => {
      fireEvent.press(first);
    });
    await press(`Increase ${name} sets`);
    await press('Rest 60 seconds');
    await press(`Swap ${name}`);
    const picker = screen.getByTestId('exercise-picker');
    const pick = within(picker).getAllByRole('button')[0]!;
    await act(async () => {
      fireEvent.press(pick);
    });
    await press('Add exercise from library');
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('exercise-picker')).getAllByRole('button')[1]!);
    });
    const before = queued(store).length;
    expect(before).toBe(0);
    await press(/^Save Upper A$/);
    const w = queued(store);
    expect(
      w.some((x) => x.op === 'upsert' && x.row.sets !== undefined && x.row.rest_sec === 60),
    ).toBe(true);
    expect(
      w.some(
        (x) => x.op === 'upsert' && x.row.workout_day_id === 'd1' && typeof x.row.id === 'string',
      ),
    ).toBe(true);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('remove an exercise; unchanged save writes nothing', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <ProgramEditScreen now={at('12:00')} dayId="d1" />);
    await press(/^Save Upper A$/);
    expect(queued(store)).toEqual([]);
    await renderWithStore(store, <ProgramEditScreen now={at('12:00')} dayId="d1" />);
    const first = screen.getAllByRole('button', { name: /\. Edit$/ })[0]!;
    const name = String(first.props.accessibilityLabel).split(',')[0]!;
    await act(async () => {
      fireEvent.press(first);
    });
    await press(`Remove ${name}`);
    await press(/^Save Upper A$/);
    const w = queued(store);
    expect(w[0]).toMatchObject({ op: 'soft_delete' });
    // the rest only move up
    expect(w.slice(1).every((x) => x.op === 'upsert' && Object.keys(x.row).join() === 'sort')).toBe(
      true,
    );
  });

  it('unknown day', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <ProgramEditScreen now={at('12:00')} dayId="nope" />);
    expect(screen.getByText('This day isn’t in your program.')).toBeOnTheScreen();
  });
});
