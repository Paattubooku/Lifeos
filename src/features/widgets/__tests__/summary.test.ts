import { resolveTemplate } from '@/features/routine/lib/templates';
import { computeStreak } from '@/features/today/lib/streak';
import { expectedBy } from '@/features/water/lib/pace';
import { addDays as appAddDays, logicalDate, logicalMoment } from '@/lib/dates';
import { seedRoutine } from '@/test/routineFixtures';

import {
  addDays,
  buildSummary,
  currentStreak,
  istNow,
  nowAndNext,
  type SummaryInput,
  templateFor,
  waterExpected,
} from '../lib/summary';
import { widgetScript } from '../lib/script';
import { WIDGET_SCRIPT } from '../scriptSource';

const MON = '2026-11-23';
const { templates, blocks } = seedRoutine();
const T = templates.map((t) => ({
  ...t,
  archived_at: null,
  deleted_at: null,
  updated_at: '2026-11-01T00:00:00Z',
}));
const B = blocks.map((b) => ({ ...b, id: b.id ?? b.client_id, deleted_at: null }));

describe('ports match the app', () => {
  it('logical day and dates', () => {
    for (const t of [
      logicalMoment(MON, '02:30'),
      logicalMoment(MON, '03:00'),
      logicalMoment(MON, '23:59'),
    ])
      expect(istNow(t).today).toBe(logicalDate(t));
    expect(istNow(logicalMoment(MON, '13:15')).minutes).toBe(13 * 60 + 15);
    expect(addDays('2026-12-31', 1)).toBe(appAddDays('2026-12-31', 1));
  });

  it('streak with grace days equals computeStreak', () => {
    const scores = [80, 90, 60, 75, null, 72, 55, 71, 66, 85, 40, 70, 74, 69, 90, 91];
    const days = scores.map((score, i) => ({ date: addDays(MON, i - scores.length), score }));
    for (const todayScore of [null, 50, 70, 100])
      for (let cut = 0; cut <= days.length; cut += 3)
        expect(currentStreak(days.slice(cut), MON, todayScore)).toBe(
          computeStreak(days.slice(cut), MON, todayScore).current,
        );
  });

  it('template choice equals resolveTemplate (weekday, manual switch, archived)', () => {
    for (const d of [MON, '2026-11-28', '2026-11-29'])
      for (const manual of [null, 'rest'])
        expect(templateFor(T, d, manual)?.id).toBe(
          resolveTemplate(T, d, { template_id: manual })?.id,
        );
    const archived = T.map((t) => (t.id === 'weekend' ? { ...t, archived_at: 'x' } : t));
    expect(templateFor(archived, '2026-11-28', null)?.id).toBe('workday');
  });

  it('water pace equals expectedBy', () => {
    for (const m of [200, 300, 600, 780, 1260, 1300])
      expect(waterExpected(m, '05:00', '21:00:00', 3000)).toBe(expectedBy(m, 300, 1260, 3000));
  });
});

describe('now and next', () => {
  const day = B.filter((b) => b.template_id === 'workday');
  it('the block running now, then the next open ones; ticked blocks skipped', () => {
    const lunch = day.find((b) => b.title === 'Lunch')!;
    const r = nowAndNext(day, new Set(), 13 * 60 + 15);
    expect(r.now).toMatchObject({ title: 'Lunch', start: '13:00' });
    expect(r.next?.title).toBe(r.after?.title);
    const ticked = nowAndNext(day, new Set([lunch.id]), 13 * 60 + 15);
    expect(ticked.now).toBeNull();
    expect(ticked.next).toEqual(r.next);
    expect(ticked.after).not.toEqual(ticked.next);
    // after the last block: nothing left
    expect(nowAndNext(day, new Set(), 23 * 60 + 30)).toEqual({
      now: null,
      next: null,
      after: null,
    });
    // 01:00 is after 23:59 on the logical day
    expect(nowAndNext(day, new Set(), 60).next).toBeNull();
  });
});

describe('buildSummary', () => {
  const input = (over: Partial<SummaryInput> = {}): SummaryInput => ({
    now: logicalMoment(MON, '13:15'),
    profile: {
      water_target_ml: 3000,
      wake_time: '05:00:00',
      monthly_budget_inr: 18000,
      steps_min: 6000,
    },
    dayLogs: [
      { date: addDays(MON, -2), score: 80, template_id: null, updated_at: 'x', deleted_at: null },
      { date: addDays(MON, -1), score: 90, template_id: null, updated_at: 'x', deleted_at: null },
      {
        date: MON,
        score: 45,
        template_id: null,
        updated_at: '2026-11-23T07:40:00Z',
        deleted_at: null,
      },
    ],
    templates: T,
    blocks: B,
    logged: new Set(
      B.filter((b) => b.template_id === 'workday')
        .slice(0, 5)
        .map((b) => b.id),
    ),
    waterMl: 1400,
    monthSpend: 6420.5,
    top3: [
      { title: 'Pay bill', status: 'open' },
      { title: 'Review PR', status: 'done' },
    ],
    steps: 4210,
    ...over,
  });
  it('score, streak, water pace, next block, spend, top 3, steps', () => {
    const s = buildSummary(input());
    expect(s).toMatchObject({
      date: MON,
      score: 45,
      score_at: '2026-11-23T07:40:00Z',
      streak: 2,
      done: 5,
      counted: B.filter((b) => b.template_id === 'workday').length,
      water_ml: 1400,
      water_target: 3000,
      water_behind: expectedBy(13 * 60 + 15, 300, 21 * 60, 3000) - 1400,
      month_spend: 6421,
      month_budget: 18000,
      top3: [
        { title: 'Pay bill', done: false },
        { title: 'Review PR', done: true },
      ],
      steps: 4210,
      steps_min: 6000,
      template: 'Workday',
    });
    expect(s.next_block).toMatchObject({ title: 'Lunch', status: 'now' });
    expect(s.after).not.toBeNull();
  });
  it('no profile or plan; water goal reached', () => {
    const s = buildSummary(
      input({ profile: null, templates: [], dayLogs: [], waterMl: 3500, top3: [], steps: null }),
    );
    expect(s).toMatchObject({
      score: null,
      streak: 0,
      counted: 0,
      next_block: null,
      water_behind: 0,
      water_target: 3000,
      steps_min: 6000,
      template: null,
    });
  });
  it('the Edge Function copy is identical', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest-only file read
    const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
    expect(readFileSync('src/features/widgets/lib/summary.ts', 'utf8')).toBe(
      readFileSync('supabase/functions/_shared/summary.ts', 'utf8'),
    );
  });
});

describe('Scriptable script', () => {
  it('the app copy matches widgets/scriptable/LifeOS.js; URL filled in; no secrets', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest-only file read
    const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
    expect(WIDGET_SCRIPT).toBe(readFileSync('widgets/scriptable/LifeOS.js', 'utf8'));
    const s = widgetScript('https://abc.supabase.co');
    expect(s).toContain(
      "const SUMMARY_URL = 'https://abc.supabase.co/functions/v1/widget-summary';",
    );
    expect(s).not.toContain('__LIFEOS_SUMMARY_URL__');
    expect(s).toContain('Reconnect in LifeOS');
    expect(s).not.toMatch(/service_role|anon|eyJ/i);
  });
});
