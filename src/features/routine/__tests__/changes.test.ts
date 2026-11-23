import { seedRoutine, tpl } from '@/test/routineFixtures';

import { blocksOf, draftFromBlock, newBlockDraft } from '../lib/blocks';
import {
  planArchive,
  planBlockDelete,
  planBlockRestore,
  planBlockSave,
  planDeleteTemplate,
  planDuplicate,
  planMove,
  planNewTemplate,
  planRestore,
  planSwitch,
  planTemplateRestore,
  planTemplateSave,
  removalRule,
  validateTemplateName,
} from '../lib/changes';

const NOW = Date.parse('2026-11-23T06:00:00Z');
const NOW_ISO = new Date(NOW).toISOString();
const TODAY = '2026-11-23'; // Monday
const { templates, blocks } = seedRoutine();
const [workday, weekend, rest] = templates as [
  (typeof templates)[0],
  (typeof templates)[0],
  (typeof templates)[0],
];
const wd = blocksOf(blocks, 'workday');
const workout = wd.find((b) => b.kind === 'workout')!;

describe('planBlockSave', () => {
  it('new block: client-made id, template, next sort, auto_complete by kind', () => {
    const draft = { ...newBlockDraft(wd), title: ' Stretch ', kind: 'workout' as const };
    expect(planBlockSave(null, draft, { templateId: 'workday', blocks, newId: 'new-id' })).toEqual([
      {
        op: 'upsert',
        table: 'routine_block',
        row: {
          id: 'new-id',
          template_id: 'workday',
          title: 'Stretch',
          kind: 'workout',
          start_time: '22:15',
          duration_min: 15,
          ref_slot: null,
          auto_complete: true,
          is_optional: false,
          notify: true,
          sort: 12,
        },
      },
    ]);
  });

  it('edit sends only changed fields (05:30 → 05:45 touches one block)', () => {
    const changes = planBlockSave(
      workout,
      { ...draftFromBlock(workout), start_time: '05:45' },
      { templateId: 'workday', blocks, newId: 'unused' },
    );
    expect(changes).toEqual([
      {
        op: 'upsert',
        table: 'routine_block',
        clientId: workout.client_id,
        row: { start_time: '05:45' },
      },
    ]);
  });

  it('no change → nothing; kind change carries auto_complete', () => {
    const walk = wd.find((b) => b.title === 'Evening walk')!;
    expect(
      planBlockSave(walk, draftFromBlock(walk), { templateId: 'workday', blocks, newId: 'x' }),
    ).toEqual([]);
    const [c] = planBlockSave(
      walk,
      { ...draftFromBlock(walk), kind: 'meal', ref_slot: 'dinner' },
      { templateId: 'workday', blocks, newId: 'x' },
    );
    expect(c).toMatchObject({ row: { kind: 'meal', ref_slot: 'dinner', auto_complete: true } });
    // Stored auto_complete that differs from the kind default is left alone when kind is unchanged.
    const manualWater = { ...wd[1]!, auto_complete: false };
    expect(
      planBlockSave(
        manualWater,
        { ...draftFromBlock(manualWater), notify: false },
        {
          templateId: 'workday',
          blocks,
          newId: 'x',
        },
      ),
    ).toEqual([
      {
        op: 'upsert',
        table: 'routine_block',
        clientId: manualWater.client_id,
        row: { notify: false },
      },
    ]);
  });

  it('delete is a soft delete', () => {
    expect(planBlockDelete(workout)).toEqual([
      { op: 'delete', table: 'routine_block', clientId: workout.client_id },
    ]);
  });
});

describe('planMove (times are absolute: neighbours swap start times)', () => {
  it('moves down / up, ignores the ends', () => {
    expect(planMove(blocks, 'workday', workout.client_id, 1)).toEqual([
      {
        op: 'upsert',
        table: 'routine_block',
        clientId: workout.client_id,
        row: { start_time: '07:00' },
      },
      {
        op: 'upsert',
        table: 'routine_block',
        clientId: wd[3]!.client_id,
        row: { start_time: '05:30' },
      },
    ]);
    expect(planMove(blocks, 'workday', wd[0]!.client_id, -1)).toEqual([]);
    expect(planMove(blocks, 'workday', wd[11]!.client_id, 1)).toEqual([]);
    expect(planMove(blocks, 'workday', 'missing', 1)).toEqual([]);
  });

  it('same start time → swaps sort', () => {
    const a = { ...wd[0]!, client_id: 'a', sort: 1 };
    const b = { ...wd[0]!, client_id: 'b', sort: 2 };
    expect(planMove([a, b], 'workday', 'a', 1)).toEqual([
      { op: 'upsert', table: 'routine_block', clientId: 'a', row: { sort: 2 } },
      { op: 'upsert', table: 'routine_block', clientId: 'b', row: { sort: 1 } },
    ]);
    const c = { ...b, sort: 1 };
    expect(planMove([a, c], 'workday', 'a', 1)).toEqual([
      { op: 'upsert', table: 'routine_block', clientId: 'a', row: { sort: 2 } },
    ]);
  });
});

describe('templates', () => {
  it('validateTemplateName', () => {
    expect(validateTemplateName('Workday')).toBeNull();
    expect(validateTemplateName(' ')).toMatch(/name/);
    expect(validateTemplateName('x'.repeat(61))).toMatch(/60/);
  });

  it('planTemplateSave: changed fields + updated_at (for last-edited-wins)', () => {
    expect(planTemplateSave(weekend, { name: 'Weekend', weekdays: [7, 6] }, NOW)).toEqual([]);
    expect(planTemplateSave(weekend, { name: ' Sunday ', weekdays: [7, 7] }, NOW)).toEqual([
      {
        op: 'upsert',
        table: 'routine_template',
        clientId: 'weekend-c',
        row: { name: 'Sunday', weekdays: [7], updated_at: NOW_ISO },
      },
    ]);
  });

  it('planNewTemplate picks an unused name', () => {
    const [c] = planNewTemplate(
      [...templates, tpl('n', 'New template', [], { sort: 5 })],
      'id',
      NOW,
    );
    expect(c).toMatchObject({ row: { id: 'id', name: 'New template 2', weekdays: [], sort: 6 } });
    expect(planNewTemplate(templates, 'id', NOW)[0]).toMatchObject({
      row: { name: 'New template' },
    });
  });

  it('planDuplicate copies every block onto a weekday-less copy', () => {
    let n = 0;
    const { templateId, changes } = planDuplicate(
      workday,
      templates,
      blocks,
      () => `id${n++}`,
      NOW,
    );
    expect(templateId).toBe('id0');
    expect(changes[0]).toMatchObject({
      table: 'routine_template',
      row: { id: 'id0', name: 'Workday copy', weekdays: [], is_default: false, sort: 3 },
    });
    expect(changes).toHaveLength(13);
    expect(changes[3]).toMatchObject({
      table: 'routine_block',
      row: { id: 'id3', template_id: 'id0', title: 'Workout', start_time: '05:30' },
    });
  });

  it('removalRule: used in the last 7 days → archive; only template → keep', () => {
    const ctx = {
      templates,
      today: TODAY,
      dayLogs: [] as { date: string; template_id: string | null }[],
    };
    expect(removalRule(rest, ctx)).toBe('delete');
    expect(
      removalRule(rest, { ...ctx, dayLogs: [{ date: '2026-11-17', template_id: 'rest' }] }),
    ).toBe('archive');
    expect(
      removalRule(rest, { ...ctx, dayLogs: [{ date: '2026-11-16', template_id: 'rest' }] }),
    ).toBe('delete');
    expect(
      removalRule(rest, {
        ...ctx,
        dayLogs: [{ date: TODAY, template_id: 'rest', deleted_at: 'x' } as never],
      }),
    ).toBe('delete');
    expect(removalRule(workday, { ...ctx, templates: [workday] })).toBe('keep');
  });

  it('delete soft-deletes blocks then the template, passing on the default', () => {
    const changes = planDeleteTemplate(workday, templates, blocks, NOW);
    expect(changes[0]).toEqual({
      op: 'upsert',
      table: 'routine_template',
      clientId: 'weekend-c',
      row: { is_default: true, updated_at: NOW_ISO },
    });
    expect(changes.filter((c) => c.table === 'routine_block')).toHaveLength(12);
    expect(changes.at(-1)).toEqual({
      op: 'delete',
      table: 'routine_template',
      clientId: 'workday-c',
    });
    expect(planDeleteTemplate(rest, templates, [], NOW)).toHaveLength(1);
    expect(planDeleteTemplate(workday, [workday], [], NOW)).toHaveLength(1);
  });

  it('archive frees weekdays; restore brings it back', () => {
    expect(planArchive(weekend, templates, NOW)).toEqual([
      {
        op: 'upsert',
        table: 'routine_template',
        clientId: 'weekend-c',
        row: { archived_at: NOW_ISO, weekdays: [], is_default: false, updated_at: NOW_ISO },
      },
    ]);
    expect(planRestore(weekend, NOW)[0]).toMatchObject({ row: { archived_at: null } });
  });
});

describe('planSwitch', () => {
  it('today only: stores day_log.template_id, reusing and reviving today’s row', () => {
    expect(
      planSwitch(rest, 'today', { today: TODAY, todayDayLog: null, templates, now: NOW }),
    ).toEqual([
      {
        op: 'upsert',
        table: 'day_log',
        row: { date: TODAY, template_id: 'rest', deleted_at: null },
      },
    ]);
    expect(
      planSwitch(rest, 'today', {
        today: TODAY,
        todayDayLog: { client_id: 'dl', deleted_at: 'x' },
        templates,
        now: NOW,
      })[0],
    ).toMatchObject({ clientId: 'dl', row: { deleted_at: null } });
  });

  it('from now on: also moves today’s weekday to the chosen template', () => {
    const changes = planSwitch(rest, 'always', {
      today: TODAY,
      todayDayLog: null,
      templates,
      now: NOW,
    });
    expect(changes.slice(1)).toEqual([
      {
        op: 'upsert',
        table: 'routine_template',
        clientId: 'workday-c',
        row: { weekdays: [2, 3, 4, 5], updated_at: new Date(NOW - 1).toISOString() },
      },
      {
        op: 'upsert',
        table: 'routine_template',
        clientId: 'rest-c',
        row: { weekdays: [1], updated_at: NOW_ISO },
      },
    ]);
    // Already the weekday's template: only the day_log.
    expect(
      planSwitch(workday, 'always', { today: TODAY, todayDayLog: null, templates, now: NOW }),
    ).toHaveLength(1);
  });
});

describe('undo', () => {
  it('planBlockRestore re-sends the full row with deleted_at null', () => {
    const [c] = planBlockRestore(workout);
    expect(c).toEqual({
      op: 'upsert',
      table: 'routine_block',
      clientId: workout.client_id,
      row: expect.objectContaining({
        id: workout.id,
        template_id: 'workday',
        start_time: '05:30',
        deleted_at: null,
      }),
    });
  });

  it('planTemplateRestore brings back template, blocks and the default flag', () => {
    const changes = planTemplateRestore(workday, templates, blocks, NOW);
    expect(changes[0]).toMatchObject({
      table: 'routine_template',
      clientId: 'workday-c',
      row: { id: 'workday', is_default: true, deleted_at: null, weekdays: [1, 2, 3, 4, 5] },
    });
    expect(changes.filter((c) => c.table === 'routine_block')).toHaveLength(12);
    expect(changes.at(-1)).toMatchObject({ clientId: 'weekend-c', row: { is_default: false } });
    expect(planTemplateRestore(rest, templates, blocks, NOW).at(-1)).toMatchObject({
      table: 'routine_block',
    });
  });
});
