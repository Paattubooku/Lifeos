import {
  comparePending,
  completed,
  dueNote,
  headerLine,
  isOverdue,
  pending,
  planAddTop3,
  planNewTask,
  planRemoveTop3,
  planToggleDone,
  suggestions,
  type TaskRow,
  top3,
} from '../lib/tasks';

const TODAY = '2026-11-24';
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({
  client_id: id,
  title: id,
  priority: 'medium',
  due_date: null,
  is_top3: false,
  top3_date: null,
  status: 'open',
  done_at: null,
  created_at: '2026-11-20T00:00:00Z',
  deleted_at: null,
  ...over,
});

describe('F17 AC2: pending order = reference (priority weight) then due date', () => {
  it('high → medium → low; soonest due first, no date last; then newest', () => {
    const list = [
      task('low-due', { priority: 'low', due_date: '2026-11-25' }),
      task('med-none', { priority: 'medium' }),
      task('high-late', { priority: 'high', due_date: '2026-12-01' }),
      task('med-soon', { priority: 'medium', due_date: '2026-11-21' }),
      task('high-soon', { priority: 'high', due_date: '2026-11-19' }),
      task('med-none-new', { priority: 'medium', created_at: '2026-11-23T00:00:00Z' }),
      task('odd', { priority: 'urgent', due_date: '2026-11-22' }),
    ];
    expect([...list].sort(comparePending).map((t) => t.client_id)).toEqual([
      'high-soon',
      'high-late',
      'med-soon',
      'odd',
      'med-none-new',
      'med-none',
      'low-due',
    ]);
    expect(comparePending(task('a'), task('a'))).toBe(0);
  });
});

describe('lists', () => {
  const now = Date.parse(`${TODAY}T12:00:00+05:30`);
  const list = [
    task('t1', { is_top3: true, top3_date: TODAY, priority: 'high' }),
    task('t2', {
      is_top3: true,
      top3_date: TODAY,
      status: 'done',
      done_at: '2026-11-24T05:00:00Z',
    }),
    task('y1', { is_top3: true, top3_date: '2026-11-23' }),
    task('y2', {
      is_top3: false,
      top3_date: '2026-11-23',
      status: 'done',
      done_at: '2026-11-23T05:00:00Z',
    }),
    task('old', { top3_date: '2026-11-20' }),
    task('gone', { deleted_at: 'x' }),
    task('ancient', { status: 'done', done_at: '2026-11-01T05:00:00Z' }),
    task('over', { due_date: '2026-11-22' }),
    task('wk', { due_date: '2026-11-30' }),
  ];
  it('top 3, pending, completed (14 days), suggestions (yesterday’s unfinished)', () => {
    expect(top3(list, TODAY).map((t) => t.client_id)).toEqual(['t1', 't2']);
    expect(pending(list, TODAY).map((t) => t.client_id)).toEqual(['over', 'wk', 'y1', 'old']);
    expect(completed(list, now).map((t) => t.client_id)).toEqual(['t2', 'y2']);
    expect(suggestions(list, TODAY).map((t) => t.client_id)).toEqual(['y1']);
  });

  it('overdue only before today; header and due notes', () => {
    expect(isOverdue(task('a', { due_date: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(task('a', { due_date: '2026-11-23' }), TODAY)).toBe(true);
    expect(isOverdue(task('a', { due_date: '2026-11-23', status: 'done' }), TODAY)).toBe(false);
    expect(headerLine(list, TODAY)).toBe('1 overdue · 1 due this week');
    expect(headerLine([], TODAY)).toBe('Nothing pending');
    expect(dueNote(task('a', { due_date: '2026-11-20' }), TODAY)).toBe('4 days overdue');
    expect(dueNote(task('a', { due_date: '2026-11-23' }), TODAY)).toBe('1 day overdue');
    expect(dueNote(task('a', { due_date: TODAY }), TODAY)).toBe('Due today');
    expect(dueNote(task('a', { due_date: '2026-11-25' }), TODAY)).toBe('Due tomorrow');
    expect(dueNote(task('a', { due_date: '2026-11-28' }), TODAY)).toBeNull();
    expect(dueNote(task('a'), TODAY)).toBeNull();
    expect(dueNote(task('a', { due_date: '2026-11-20', status: 'done' }), TODAY)).toBeNull();
  });
});

describe('F17 AC1: never more than 3 in the top 3', () => {
  const three = [
    task('a', { is_top3: true, top3_date: TODAY }),
    task('b', { is_top3: true, top3_date: TODAY, status: 'done', done_at: 'x' }),
    task('c', { is_top3: true, top3_date: TODAY }),
    task('stale', { is_top3: true, top3_date: '2026-11-23' }),
    task('new'),
  ];
  it('a 4th asks which to swap out', () => {
    const r = planAddTop3(three, TODAY, { clientId: 'new' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.full.map((t) => t.client_id).sort()).toEqual(['a', 'b', 'c']);
    // an unknown swap target doesn't free a slot
    expect(planAddTop3(three, TODAY, { clientId: 'new' }, 'nope').ok).toBe(false);
  });

  it('swapping one out frees its slot and clears stale flags', () => {
    const r = planAddTop3(three, TODAY, { clientId: 'new' }, 'b');
    expect(r).toEqual({
      ok: true,
      changes: [
        { op: 'upsert', table: 'task', clientId: 'stale', row: { is_top3: false } },
        { op: 'upsert', table: 'task', clientId: 'b', row: { is_top3: false } },
        { op: 'upsert', table: 'task', clientId: 'new', row: { is_top3: true, top3_date: TODAY } },
      ],
    });
  });

  it('room left: a new task goes straight in; re-adding one already there is fine', () => {
    const row = planNewTask({ title: '  Buy whey  ', priority: 'high', dueDate: null });
    expect(row).toEqual({
      title: 'Buy whey',
      priority: 'high',
      due_date: null,
      status: 'open',
      is_top3: false,
      done_at: null,
    });
    const r = planAddTop3([three[0]!], TODAY, { row });
    expect(r.ok && r.changes).toEqual([
      { op: 'upsert', table: 'task', row: { ...row, is_top3: true, top3_date: TODAY } },
    ]);
    expect(planAddTop3(three, TODAY, { clientId: 'a' }).ok).toBe(true);
    expect(planRemoveTop3('a')).toEqual([
      { op: 'upsert', table: 'task', clientId: 'a', row: { is_top3: false } },
    ]);
  });

  it('done / undone', () => {
    expect(planToggleDone(task('a'), Date.parse('2026-11-24T06:10:00Z'))[0]).toMatchObject({
      row: { status: 'done', done_at: '2026-11-24T06:10:00.000Z' },
    });
    expect(planToggleDone(task('a', { status: 'done', done_at: 'x' }), 1)[0]).toMatchObject({
      row: { status: 'open', done_at: null },
    });
  });
});
