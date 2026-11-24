import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { TodayScreen } from '@/features/today/components/TodayScreen';
import { addDays, logicalMoment, todayLogical } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { TasksScreen } from '../components/TasksScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

/** The fixture's logical today (real clock). */
const today = todayLogical();

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const writes = (store: Store) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === 'task')
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};
/** Open top-3 tasks today after the queued writes are applied by the screen. */
const top3Titles = () =>
  within(screen.getByTestId('top3-card'))
    .queryAllByRole('button', { name: /Options$/ })
    .map((b) => String(b.props.accessibilityLabel).split('.')[0]);

describe('Tasks screen (F17)', () => {
  it('lists: top 3, pending by priority then due, overdue, completed', async () => {
    const { store, at } = await todayStore({
      tasks: [
        { title: 'Low soon', priority: 'low', due_date: addDays(today, 1) },
        { title: 'Form 16', priority: 'high', due_date: addDays(today, -4) },
        { title: 'Bike insurance', priority: 'high', due_date: addDays(today, 3) },
        { title: 'Desk drawer', priority: 'medium' },
        { title: 'Pay bill', priority: 'high', is_top3: true, top3_date: today, due_date: today },
        {
          title: 'Review PR',
          is_top3: true,
          top3_date: today,
          status: 'done',
          done_at: new Date(logicalMoment(today, '11:40')).toISOString(),
        },
        { title: 'Yesterday pick', is_top3: true, top3_date: addDays(today, -1) },
      ],
    });
    await renderWithStore(store, <TasksScreen now={at('12:00')} />);
    expect(screen.getByText('1 overdue · 3 due this week')).toBeOnTheScreen();
    expect(top3Titles()).toEqual(['Pay bill', 'Review PR']);
    expect(within(screen.getByTestId('top3-card')).getByText('1 of 2 done')).toBeOnTheScreen();
    expect(within(screen.getByTestId('top3-card')).getByText('Done 11:40 am')).toBeOnTheScreen();
    const pending = within(screen.getByTestId('pending-card'))
      .getAllByRole('button', { name: /Options$/ })
      .map((b) => String(b.props.accessibilityLabel).split('.')[0]);
    expect(pending).toEqual([
      'Form 16',
      'Bike insurance',
      'Desk drawer',
      'Yesterday pick',
      'Low soon',
    ]);
    expect(screen.getByText(/4 days overdue$/)).toBeOnTheScreen();
    // yesterday's unfinished top 3 is suggested, not added
    expect(within(screen.getByTestId('suggestions')).getByText('Yesterday pick')).toBeOnTheScreen();
    await press(/^Completed, 1 in the last 14 days/);
    expect(within(screen.getByTestId('completed-card')).getByText('Review PR')).toBeOnTheScreen();
  });

  it('quick add: title, default medium, due tomorrow', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TasksScreen now={at('12:00')} />);
    expect(screen.getByText('All clear')).toBeOnTheScreen();
    await press('New task');
    await fireEvent.changeText(screen.getByLabelText('Task'), 'Buy whey protein');
    await press('Due Tomorrow');
    await press('Add task');
    expect(writes(store)).toEqual([
      {
        op: 'upsert',
        client_id: expect.any(String),
        row: expect.objectContaining({
          title: 'Buy whey protein',
          priority: 'medium',
          due_date: addDays(today, 1),
          is_top3: false,
          status: 'open',
        }),
      },
    ]);
    expect(screen.getByText('Due tomorrow')).toBeOnTheScreen();
  });

  it('AC1: a 4th top-3 task asks which to swap out', async () => {
    const { store, at } = await todayStore({
      tasks: [
        { title: 'A', priority: 'high', is_top3: true, top3_date: today },
        {
          title: 'B',
          is_top3: true,
          top3_date: today,
          status: 'done',
          done_at: new Date(logicalMoment(today, '10:00')).toISOString(),
        },
        { title: 'C', priority: 'low', is_top3: true, top3_date: today },
        { title: 'D' },
      ],
    });
    await renderWithStore(store, <TasksScreen now={at('12:00')} />);
    await press(/^D\. No date\. Options$/);
    await press('Add to today’s top 3');
    expect(screen.getByTestId('swap-sheet')).toBeOnTheScreen();
    expect(screen.getByText(/Adding “D” means one of these goes back/)).toBeOnTheScreen();
    // the done one is picked by default
    await press('Swap out B');
    expect(top3Titles().sort()).toEqual(['A', 'C', 'D']);
    expect(writes(store).map((w) => [w.client_id, w.row])).toEqual([
      ['tk1', { is_top3: false }],
      ['tk3', { is_top3: true, top3_date: today }],
    ]);
  });

  it('quick add into a full top 3: keep top 3 adds it to pending', async () => {
    const { store, at } = await todayStore({
      tasks: [
        { title: 'A', is_top3: true, top3_date: today },
        { title: 'B', is_top3: true, top3_date: today },
        { title: 'C', is_top3: true, top3_date: today },
      ],
    });
    await renderWithStore(store, <TasksScreen now={at('12:00')} />);
    await press('New task');
    await fireEvent.changeText(screen.getByLabelText('Task'), 'E');
    expect(screen.getByText('Top 3 is full; you’ll swap one out')).toBeOnTheScreen();
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);
    await press('Add task');
    await press('Keep top 3, add to pending');
    expect(writes(store)).toHaveLength(1);
    expect(writes(store)[0]?.row).toMatchObject({ title: 'E', is_top3: false });
    expect(top3Titles()).toHaveLength(3);
  });

  it('remove from top 3 and delete', async () => {
    const { store, at } = await todayStore({
      tasks: [{ title: 'A', is_top3: true, top3_date: today }, { title: 'Z' }],
    });
    await renderWithStore(store, <TasksScreen now={at('12:00')} />);
    await press(/^A\. No date\. Options$/);
    await press('Remove from today’s top 3');
    expect(top3Titles()).toEqual([]);
    await press(/^Z\. No date\. Options$/);
    await press('Delete task');
    expect(writes(store).at(-1)).toMatchObject({ op: 'soft_delete', client_id: 'tk1' });
    expect(screen.queryByText('Z')).toBeNull();
  });
});

describe('Today card (F17)', () => {
  const tasks = (today: string) => [
    { title: 'Pay bill', is_top3: true, top3_date: today, due_date: today },
    { title: 'Other' },
  ];

  it('AC3: shows 09:00–18:00; completing a task updates Today immediately', async () => {
    const { store, at } = await todayStore({ tasks: tasks(today) });
    await renderWithStore(store, <TodayScreen now={at('13:15')} />);
    const card = screen.getByTestId('today-top3');
    expect(within(card).getByText('Due today')).toBeOnTheScreen();
    expect(within(card).getByText('· 0 done')).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(within(card).getByRole('checkbox', { name: /^Pay bill\. Mark done/ }));
    });
    expect(within(screen.getByTestId('today-top3')).getByText('· 1 done')).toBeOnTheScreen();
    expect(writes(store).at(-1)?.row).toMatchObject({ status: 'done' });
    await press('All tasks, 1 open');
    expect(mockRouter.push).toHaveBeenCalledWith('/tasks');
  });

  it('hidden before 09:00 and from 18:00, and with no tasks', async () => {
    const s = await todayStore({ tasks: tasks('x') });
    await renderWithStore(s.store, <TodayScreen now={s.at('08:30')} />);
    expect(screen.queryByTestId('today-top3')).toBeNull();
    const late = await todayStore({ tasks: tasks('x') });
    await renderWithStore(late.store, <TodayScreen now={late.at('18:00')} />);
    expect(screen.queryByTestId('today-top3')).toBeNull();
    const none = await todayStore();
    await renderWithStore(none.store, <TodayScreen now={none.at('12:00')} />);
    expect(screen.queryByTestId('today-top3')).toBeNull();
  });
});
