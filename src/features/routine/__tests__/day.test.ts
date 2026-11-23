import { seedRoutine } from '@/test/routineFixtures';

import { draftFromBlock } from '../lib/blocks';
import { planBlockSave, planSwitch } from '../lib/changes';
import { planForDate, remindersFor } from '../lib/day';
import { mergeByClientId, type Mutation } from '@/lib/sync';

const TODAY = '2026-11-23'; // Monday
const TOMORROW = '2026-11-24';
const NOW = Date.parse('2026-11-23T04:00:00Z');

/** Apply planned changes the way the UI does: queued writes merged over server rows. */
function applied<T extends { client_id: string; deleted_at?: string | null }>(
  rows: readonly T[],
  changes: ReturnType<typeof planBlockSave>,
  table: string,
): T[] {
  const writes = changes
    .filter((c) => c.table === table)
    .map((c, i) =>
      c.op === 'upsert'
        ? ({
            client_id: c.clientId ?? `new-${i}`,
            table: c.table,
            op: 'upsert',
            row: c.row,
          } as Mutation)
        : ({ client_id: c.clientId, table: c.table, op: 'soft_delete', row: {} } as Mutation),
    );
  return mergeByClientId(rows, writes);
}

describe('planForDate', () => {
  it('Workday on a Monday: 12 blocks, 11 counted (walk is optional)', () => {
    const { templates, blocks } = seedRoutine();
    const plan = planForDate(TODAY, templates, blocks);
    expect(plan.template?.name).toBe('Workday');
    expect(plan.blocks).toHaveLength(12);
    expect(plan.counted).toHaveLength(11);
    expect(plan.switched).toBe(false);
  });

  it('no template → empty plan', () => {
    expect(planForDate(TODAY, [], [])).toMatchObject({ template: null, blocks: [], counted: [] });
  });
});

describe('F04 AC1: editing Workday’s 05:30 block to 05:45', () => {
  const { templates, blocks } = seedRoutine();
  const workout = blocks.find((b) => b.template_id === 'workday' && b.start_time === '05:30:00')!;
  const changes = planBlockSave(
    workout,
    { ...draftFromBlock(workout), start_time: '05:45' },
    { templateId: 'workday', blocks, newId: 'x' },
  );
  const after = applied(blocks, changes, 'routine_block');

  it('moves tomorrow’s timeline block and tomorrow’s reminder', () => {
    const plan = planForDate(TOMORROW, templates, after);
    expect(plan.blocks.find((b) => b.kind === 'workout')?.start_time).toBe('05:45');
    const reminder = remindersFor(plan).find((r) => r.title === 'Workout');
    expect(new Date(reminder!.at).toISOString()).toBe('2026-11-24T00:15:00.000Z'); // 05:45 IST
  });

  it('touches no other block and writes nothing to past logs', () => {
    expect(changes.map((c) => c.table)).toEqual(['routine_block']);
    const others = after.filter((b) => b.client_id !== workout.client_id);
    expect(others).toEqual(blocks.filter((b) => b.client_id !== workout.client_id));
  });

  it('reminders: only notify blocks; times before 03:00 fall on the next night', () => {
    const plan = planForDate(TOMORROW, templates, after);
    const reminders = remindersFor(plan);
    expect(reminders).toHaveLength(11); // Evening walk is silent
    const late = { ...after[0]!, client_id: 'late', start_time: '01:30:00' };
    const latePlan = planForDate(TOMORROW, templates, [late]);
    expect(new Date(remindersFor(latePlan)[0]!.at).toISOString()).toBe('2026-11-24T20:00:00.000Z');
  });
});

describe('F04 AC2: switching today to Rest day', () => {
  it('removes the workout block from today’s score denominator', () => {
    const { templates, blocks } = seedRoutine();
    const before = planForDate(TODAY, templates, blocks);
    expect(before.counted.some((b) => b.kind === 'workout')).toBe(true);

    const rest = templates.find((t) => t.name === 'Rest day')!;
    const [dayLogWrite] = planSwitch(rest, 'today', {
      today: TODAY,
      todayDayLog: null,
      templates,
      now: NOW,
    });
    const dayLog = dayLogWrite!.op === 'upsert' ? dayLogWrite!.row : {};

    const after = planForDate(TODAY, templates, blocks, dayLog as { template_id: string });
    expect(after.template?.name).toBe('Rest day');
    expect(after.switched).toBe(true);
    expect(after.counted.some((b) => b.kind === 'workout')).toBe(false);
    expect(after.counted).toHaveLength(10);
    // Tomorrow is unaffected.
    expect(planForDate(TOMORROW, templates, blocks).template?.name).toBe('Workday');
  });
});
