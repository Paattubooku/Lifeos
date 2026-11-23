import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { todayLogical } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { routineStore } from '@/test/routineFixtures';

import { TemplateScreen } from '../components/TemplateScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof routineStore>>['store'];
const queue = (store: Store) =>
  store
    .getState()
    .sync.queue.map((m) => ({ table: m.table, op: m.op, client_id: m.client_id, row: m.row }));

describe('TemplateScreen', () => {
  it('lists Workday’s 12 blocks with time, kind and meta', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="workday" />);
    expect(screen.getByRole('header', { name: 'Workday' })).toBeOnTheScreen();
    expect(screen.getByText('Mon–Fri · 12 blocks · 5:00 am – 10:00 pm')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /\. Edit$/ })).toHaveLength(12);
    expect(
      screen.getByRole('button', {
        name: '6:30 pm, Evening walk, Habit · 30 min · optional. Edit',
      }),
    ).toBeOnTheScreen();
  });

  it('AC1: editing the 05:30 block to 05:45 writes only that block’s start time', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="workday" />);
    await fireEvent.press(
      screen.getByRole('button', { name: '5:30 am, Workout, Workout · 60 min. Edit' }),
    );
    const sheet = screen.getByTestId('block-sheet');
    expect(within(sheet).getByRole('header', { name: 'Edit block' })).toBeOnTheScreen();
    expect(within(sheet).getByRole('button', { name: 'Save block' })).toBeDisabled();
    await fireEvent.press(within(sheet).getByLabelText('Start minute 45'));
    await act(async () => {
      await fireEvent.press(within(sheet).getByRole('button', { name: 'Save block' }));
    });
    expect(queue(store)).toEqual([
      {
        table: 'routine_block',
        op: 'upsert',
        client_id: 'workday-2-c',
        row: { start_time: '05:45' },
      },
    ]);
    expect(await screen.findByText('Block saved')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '5:45 am, Workout, Workout · 60 min. Edit' }),
    ).toBeOnTheScreen();
  });

  it('adds a block: title required, meal kind needs a slot, saved under this template', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="rest" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add block' }));
    const sheet = screen.getByTestId('block-sheet');
    const add = within(sheet).getByRole('button', { name: 'Add block' });
    expect(add).toBeDisabled();
    await fireEvent.changeText(within(sheet).getByLabelText('Title'), 'Stretch');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Kind Meal' }));
    expect(within(sheet).getByLabelText('Meal slot')).toBeOnTheScreen();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Kind Task' }));
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Increase Duration' }));
    await fireEvent(within(sheet).getByTestId('toggle-optional'), 'valueChange', true);
    await act(async () => {
      await fireEvent.press(add);
    });
    const [w] = queue(store);
    expect(w).toMatchObject({
      table: 'routine_block',
      op: 'upsert',
      row: {
        template_id: 'rest',
        title: 'Stretch',
        kind: 'task',
        start_time: '22:15',
        duration_min: 20,
        ref_slot: null,
        is_optional: true,
        auto_complete: false,
        sort: 12,
      },
    });
    expect(typeof w?.row.id).toBe('string');
    expect(await screen.findByText('Block added')).toBeOnTheScreen();
  });

  it('deletes a block with Undo', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="workday" />);
    await fireEvent.press(
      screen.getByRole('button', { name: '7:30 am, Pack lunch box, Habit · 15 min. Edit' }),
    );
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Delete Pack lunch box' }));
    });
    expect(queue(store)).toEqual([
      {
        table: 'routine_block',
        op: 'soft_delete',
        client_id: 'workday-4-c',
        row: expect.any(Object),
      },
    ]);
    expect(screen.getAllByRole('button', { name: /\. Edit$/ })).toHaveLength(11);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^Undo:/ }));
    });
    expect(queue(store)[0]).toMatchObject({
      op: 'upsert',
      row: { deleted_at: null, title: 'Pack lunch box' },
    });
    expect(screen.getAllByRole('button', { name: /\. Edit$/ })).toHaveLength(12);
  });

  it('reorder swaps start times with the neighbour', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="workday" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Reorder blocks' }));
    expect(screen.getByRole('button', { name: 'Move Wake up earlier' })).toBeDisabled();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Move Workout later' }));
    });
    expect(queue(store).map((w) => [w.client_id, w.row.start_time])).toEqual([
      ['workday-2-c', '07:00'],
      ['workday-3-c', '05:30'],
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Done reordering' }));
  });

  it('weekdays, rename, conflict warning', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="weekend" />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Runs on Friday' }));
    });
    expect(queue(store)[0]).toMatchObject({
      client_id: 'weekend-c',
      row: { weekdays: [5, 6, 7], updated_at: expect.any(String) },
    });
    // Weekend now claims Friday too and was edited last, so it wins; Workday shows the warning.
    await renderWithStore(store, <TemplateScreen id="workday" />);
    expect(screen.getByTestId('conflict-5')).toBeOnTheScreen();
    expect(
      screen.getByText('Fri is claimed by Weekend and Workday — Weekend (last edited) wins.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Name'), '');
    expect(screen.getByText('Give the template a name.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Office day');
    await act(async () => {
      await fireEvent(screen.getByLabelText('Name'), 'endEditing');
    });
    expect(queue(store).find((w) => w.client_id === 'workday-c')?.row.name).toBe('Office day');
  });

  it('duplicate copies template + blocks and opens the copy', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="weekend" />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Duplicate Weekend' }));
    });
    const writes = queue(store);
    expect(writes[0]).toMatchObject({
      table: 'routine_template',
      row: { name: 'Weekend copy', weekdays: [] },
    });
    expect(writes.filter((w) => w.table === 'routine_block')).toHaveLength(11);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/routine/[id]',
      params: { id: writes[0]?.row.id },
    });
  });

  it('unused template: Delete (confirmed) removes blocks + template, with Undo', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      void buttons?.[1]?.onPress?.();
    });
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="rest" />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Delete Rest day' }));
    });
    expect(alert).toHaveBeenCalledWith(
      'Delete Rest day?',
      'Its 11 blocks go too.',
      expect.any(Array),
    );
    const writes = queue(store);
    expect(writes.filter((w) => w.op === 'soft_delete')).toHaveLength(12);
    expect(writes.at(-1)).toMatchObject({ table: 'routine_template', client_id: 'rest-c' });
    expect(mockRouter.back).toHaveBeenCalled();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^Undo:/ }));
    });
    expect(queue(store).every((w) => w.op === 'upsert')).toBe(true);
  });

  it('used in the last 7 days: Archive instead of Delete', async () => {
    const { store } = await routineStore({
      dayLogs: [{ client_id: 'dl', date: todayLogical(), template_id: 'rest', deleted_at: null }],
    });
    await renderWithStore(store, <TemplateScreen id="rest" />);
    expect(screen.queryByRole('button', { name: 'Delete Rest day' })).toBeNull();
    expect(screen.getByTestId('archive-hint')).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Archive Rest day' }));
    });
    expect(queue(store)[0]).toMatchObject({
      client_id: 'rest-c',
      row: { archived_at: expect.any(String), weekdays: [] },
    });
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^Undo:/ }));
    });
    expect(queue(store)[0]?.row).toMatchObject({ archived_at: null, weekdays: [] });
  });

  it('unknown id shows not found', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <TemplateScreen id="nope" />);
    expect(screen.getByText('Template not found')).toBeOnTheScreen();
  });
});
