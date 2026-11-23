import { tpl } from '@/test/routineFixtures';

import {
  activeTemplates,
  conflictText,
  resolveTemplate,
  templateForDate,
  weekdayConflicts,
  weekdaysText,
  weekStrip,
  stripLetters,
} from '../lib/templates';

const MON = '2026-11-23';
const SAT = '2026-11-28';

const workday = tpl('workday', 'Workday', [1, 2, 3, 4, 5], { is_default: true });
const weekend = tpl('weekend', 'Weekend', [6, 7], { sort: 1 });
const rest = tpl('rest', 'Rest day', [], { sort: 2 });

describe('resolveTemplate', () => {
  it('a manual switch on day_log wins over the weekday rule', () => {
    const all = [workday, weekend, rest];
    expect(resolveTemplate(all, MON)?.id).toBe('workday');
    expect(resolveTemplate(all, MON, { template_id: 'rest' })?.id).toBe('rest');
    expect(resolveTemplate(all, MON, { template_id: 'rest', deleted_at: 'x' })?.id).toBe('workday');
    expect(resolveTemplate(all, MON, { template_id: 'gone' })?.id).toBe('workday');
    expect(resolveTemplate(all, MON, null)?.id).toBe('workday');
  });

  it('archived templates still resolve for a stored switch but never by weekday', () => {
    const archived = { ...weekend, archived_at: '2026-11-20T00:00:00Z' };
    expect(templateForDate([workday, archived], SAT)?.id).toBe('workday');
    expect(resolveTemplate([workday, archived], SAT, { template_id: 'weekend' })?.id).toBe(
      'weekend',
    );
  });
});

describe('weekday helpers', () => {
  it('weekdaysText', () => {
    expect(weekdaysText([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(weekdaysText([7, 6])).toBe('Sat–Sun');
    expect(weekdaysText([3])).toBe('Wed');
    expect(weekdaysText([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(weekdaysText([])).toBe('Manual');
    expect(weekdaysText([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
  });

  it('activeTemplates hides deleted/archived and sorts', () => {
    const list = activeTemplates([
      rest,
      { ...weekend, archived_at: 'x' },
      workday,
      tpl('a', 'Alpha', [], { sort: 2 }),
      tpl('d', 'Gone', [], { deleted_at: 'x' }),
    ]);
    expect(list.map((t) => t.name)).toEqual(['Workday', 'Alpha', 'Rest day']);
  });

  it('weekStrip shows which template runs each day', () => {
    expect(weekStrip([workday, weekend, rest], MON).map((t) => t?.id)).toEqual([
      'workday',
      'workday',
      'workday',
      'workday',
      'workday',
      'weekend',
      'weekend',
    ]);
  });
});

describe('weekdayConflicts (last edited wins, warn)', () => {
  it('lists each doubly-claimed day with the winner first', () => {
    const newer = { ...rest, weekdays: [6], updated_at: '2026-11-22T00:00:00Z' };
    const all = [workday, weekend, newer, tpl('x', 'Old', [6], { archived_at: 'y' })];
    const conflicts = weekdayConflicts(all);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ weekday: 6, winner: { id: 'rest' } });
    expect(conflictText(conflicts[0]!)).toBe(
      'Sat is claimed by Rest day and Weekend — Rest day (last edited) wins.',
    );
    expect(templateForDate(all, SAT)?.id).toBe('rest');
    const three = weekdayConflicts([
      ...all,
      tpl('z', 'Zed', [6], { updated_at: '2026-01-01T00:00:00Z' }),
    ]);
    expect(conflictText(three[0]!)).toBe(
      'Sat is claimed by Rest day, Weekend, Zed — Rest day (last edited) wins.',
    );
  });
});

describe('stripLetters', () => {
  it('distinct letters in order', () => {
    const m = stripLetters([workday, weekend, rest, tpl('r2', 'Recovery', []), tpl('x', '!!', [])]);
    expect([...m.values()]).toEqual(['W', 'E', 'R', 'C', '?']);
  });

  it('falls back to the first letter when all are taken', () => {
    const m = stripLetters([tpl('a', 'Ab', []), tpl('b', 'Ba', []), tpl('c', 'Ab', [])]);
    expect(m.get('c')).toBe('A');
  });
});
