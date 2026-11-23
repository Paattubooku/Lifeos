import { seedRoutine } from '@/test/routineFixtures';

import {
  blockMeta,
  blocksOf,
  blocksSummary,
  countedBlocks,
  dayMinutes,
  draftFromBlock,
  kindForGroup,
  kindGroup,
  kindLabel,
  newBlockDraft,
  slotForTime,
  validateBlock,
  withKind,
} from '../lib/blocks';

const { blocks } = seedRoutine();
const workday = blocksOf(blocks, 'workday');

describe('kinds (DESIGN_NOTES A18)', () => {
  it('maps the PRD enum onto the design’s six labels', () => {
    expect(['wake', 'custom', 'phone_off', 'sleep', 'task', 'meal'].map(kindLabel)).toEqual([
      'Habit',
      'Habit',
      'Sleep',
      'Sleep',
      'Task',
      'Meal',
    ]);
    expect(kindGroup('unknown')).toBe('habit');
  });

  it('keeps wake / phone_off when their group is re-picked', () => {
    expect(kindForGroup('habit', 'wake')).toBe('wake');
    expect(kindForGroup('sleep', 'phone_off')).toBe('phone_off');
    expect(kindForGroup('habit', 'meal')).toBe('custom');
    expect(kindForGroup('sleep')).toBe('sleep');
    expect(kindForGroup('task', null)).toBe('task');
  });

  it('meal blocks get a slot by time; leaving meal drops it', () => {
    expect(['07:00', '13:00', '16:30', '20:00'].map(slotForTime)).toEqual([
      'breakfast',
      'lunch',
      'snack',
      'dinner',
    ]);
    const d = newBlockDraft([]);
    const meal = withKind({ ...d, start_time: '13:00' }, 'meal');
    expect(meal).toMatchObject({ kind: 'meal', ref_slot: 'lunch' });
    expect(withKind({ ...meal, ref_slot: 'dinner' }, 'meal').ref_slot).toBe('dinner');
    expect(withKind(meal, 'task')).toMatchObject({ kind: 'task', ref_slot: null });
  });
});

describe('listing', () => {
  it('orders by time with late-night blocks last, and counts non-optional only', () => {
    expect(workday).toHaveLength(12);
    expect(countedBlocks(workday)).toHaveLength(11);
    expect(dayMinutes('01:00')).toBeGreaterThan(dayMinutes('23:00'));
    const late = { ...workday[0]!, client_id: 'late', start_time: '00:30:00' };
    expect(blocksOf([late, ...workday], 'workday').at(-1)?.client_id).toBe('late');
  });

  it('meta and summary copy', () => {
    const byTitle = (t: string) => workday.find((b) => b.title === t)!;
    expect(blockMeta(byTitle('Lunch'))).toBe('Meal · 30 min');
    expect(blockMeta(byTitle('Drink 500 ml water'))).toBe('Water · auto');
    expect(blockMeta({ ...byTitle('Water target hit'), auto_complete: false })).toBe(
      'Water · check',
    );
    expect(blockMeta(byTitle('Evening walk'))).toBe('Habit · 30 min · optional');
    expect(blockMeta({ ...byTitle('Lights out'), duration_min: 0 })).toBe('Sleep · —');
    expect(blocksSummary(workday)).toBe('12 blocks · 5:00 am – 10:00 pm');
    expect(blocksSummary(workday.slice(0, 1))).toBe('1 block · 5:00 am – 5:00 am');
    expect(blocksSummary([])).toBe('No blocks');
  });
});

describe('drafts', () => {
  it('a new block starts where the last ends, rounded to 5 min', () => {
    expect(newBlockDraft(workday).start_time).toBe('22:15');
    expect(newBlockDraft([{ start_time: '23:50:00', duration_min: 30 }]).start_time).toBe('23:55');
    expect(newBlockDraft([{ start_time: '07:02:00', duration_min: 0 }]).start_time).toBe('07:05');
    expect(newBlockDraft([])).toMatchObject({ start_time: '12:00', kind: 'custom', title: '' });
  });

  it('draftFromBlock + validation', () => {
    const d = draftFromBlock(workday[5]!);
    expect(d).toEqual({
      title: 'Lunch',
      kind: 'meal',
      start_time: '13:00',
      duration_min: 30,
      ref_slot: 'lunch',
      notify: true,
      is_optional: false,
    });
    expect(validateBlock(d)).toBeNull();
    expect(validateBlock({ ...d, title: '  ' })).toMatch(/title/);
    expect(validateBlock({ ...d, title: 'x'.repeat(81) })).toMatch(/80/);
    expect(validateBlock({ ...d, duration_min: 601 })).toMatch(/600/);
    expect(validateBlock({ ...d, ref_slot: null })).toMatch(/slot/);
  });
});
