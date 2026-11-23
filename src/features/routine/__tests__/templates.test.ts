import { templateForDate, templateLabel } from '../lib/templates';

const T = (id: string, weekdays: number[], over: Record<string, unknown> = {}) => ({
  id,
  name: id,
  weekdays,
  is_default: false,
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
});

describe('templateForDate', () => {
  const templates = [
    T('Workday', [1, 2, 3, 4, 5], { is_default: true }),
    T('Weekend', [6, 7]),
    T('Rest', []),
  ];

  it('picks the template that claims the weekday', () => {
    expect(templateForDate(templates, '2026-11-23')?.id).toBe('Workday'); // Monday
    expect(templateForDate(templates, '2026-11-29')?.id).toBe('Weekend'); // Sunday
  });

  it('last edited wins when two claim the same day', () => {
    const both = [...templates, T('Late', [1], { updated_at: '2026-11-20T00:00:00Z' })];
    expect(templateForDate(both, '2026-11-23')?.id).toBe('Late');
  });

  it('falls back to the default, ignores deleted, and may find nothing', () => {
    expect(templateForDate([T('Workday', [1], { is_default: true })], '2026-11-29')?.id).toBe(
      'Workday',
    );
    expect(templateForDate([T('W', [1], { deleted_at: 'x' })], '2026-11-23')).toBeNull();
  });
});

describe('templateLabel', () => {
  it.each([
    [[1, 2, 3, 4, 5], 'Workday (Mon–Fri)'],
    [[6, 7], 'Workday (Sat–Sun)'],
    [[3], 'Workday (Wed)'],
    [[1, 3, 5], 'Workday (Mon, Wed, Fri)'],
    [[], 'Workday'],
  ])('%p → %s', (weekdays, label) => {
    expect(templateLabel({ name: 'Workday', weekdays })).toBe(label);
  });
});
