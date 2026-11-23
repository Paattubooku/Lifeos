import { planBlockStatus, planNote, planSleep, planWater, statusOf } from '../lib/changes';

const NOW = Date.parse('2026-11-23T07:45:00Z');
const D = '2026-11-23';

describe('block_log changes', () => {
  it('tick creates or reuses the day’s row', () => {
    expect(planBlockStatus('b', D, null, { status: 'done' }, NOW)).toEqual([
      {
        op: 'upsert',
        table: 'block_log',
        row: {
          date: D,
          block_id: 'b',
          status: 'done',
          skip_reason: null,
          done_at: new Date(NOW).toISOString(),
          deleted_at: null,
        },
      },
    ]);
    expect(
      planBlockStatus(
        'b',
        D,
        { client_id: 'l', deleted_at: 'x' },
        { status: 'skipped', reason: 'sick' },
        NOW,
      )[0],
    ).toMatchObject({
      clientId: 'l',
      row: { status: 'skipped', skip_reason: 'sick', done_at: null, deleted_at: null },
    });
  });

  it('clear soft-deletes a live row; nothing to clear → no change', () => {
    expect(planBlockStatus('b', D, { client_id: 'l' }, null, NOW)).toEqual([
      { op: 'delete', table: 'block_log', clientId: 'l' },
    ]);
    expect(planBlockStatus('b', D, null, null, NOW)).toEqual([]);
    expect(planBlockStatus('b', D, { client_id: 'l', deleted_at: 'x' }, null, NOW)).toEqual([]);
  });

  it('statusOf', () => {
    expect(statusOf(null)).toBeNull();
    expect(statusOf({ status: 'done', deleted_at: 'x' })).toBeNull();
    expect(statusOf({ status: 'done' })).toEqual({ status: 'done' });
    expect(statusOf({ status: 'skipped', skip_reason: 'rest' })).toEqual({
      status: 'skipped',
      reason: 'rest',
    });
    expect(statusOf({ status: 'skipped' })).toEqual({ status: 'skipped', reason: 'other' });
    expect(statusOf({ status: 'weird' })).toBeNull();
  });
});

describe('other writes', () => {
  it('water, note, sleep', () => {
    expect(planWater(D, 500, NOW)[0]).toMatchObject({
      table: 'water_log',
      row: { date: D, amount_ml: 500 },
    });
    expect(planNote(D, null, '  long day  ', 'tpl')[0]).toMatchObject({
      row: { note: 'long day', template_id: 'tpl' },
    });
    expect(planNote(D, { client_id: 'dl' }, ' ', null)[0]).toEqual({
      op: 'upsert',
      table: 'day_log',
      clientId: 'dl',
      row: { date: D, note: null, deleted_at: null },
    });
    expect(planSleep(D, { client_id: 's' }, NOW - 8 * 3600e3, NOW)[0]).toMatchObject({
      clientId: 's',
      row: { date: D, wake_at: new Date(NOW).toISOString() },
    });
    expect(planSleep(D, null, 0, 1)[0]).not.toHaveProperty('clientId');
  });
});
