import { addDays, type DateString, isoWeekday } from '@/lib/dates';
import type { SyncTable } from '@/lib/sync';

import { autoCompletes, type BlockDraft, type BlockLike, blocksOf, dayMinutes } from './blocks';
import { activeTemplates, type TemplateLike } from './templates';

type Row = Record<string, unknown>;

/** One queued write: an optimistic upsert or a soft delete (both go through the sync queue). */
export type Change =
  | { op: 'upsert'; table: SyncTable; row: Row; clientId?: string }
  | { op: 'delete'; table: SyncTable; clientId: string };

export type TemplateRowLike = TemplateLike & {
  client_id: string;
  name: string;
  sort: number;
};

const maxSort = (rows: readonly { sort: number }[]) =>
  rows.reduce((m, r) => Math.max(m, r.sort), -1);

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function blockRow(d: BlockDraft): Row {
  return {
    title: d.title.trim(),
    kind: d.kind,
    start_time: d.start_time,
    duration_min: d.duration_min,
    ref_slot: d.kind === 'meal' ? d.ref_slot : null,
    auto_complete: autoCompletes(d.kind),
    is_optional: d.is_optional,
    notify: d.notify,
  };
}

/**
 * Save from the block sheet. A new block gets a client-made `id` so it can be
 * referenced before it syncs; an edit sends only the changed fields.
 * Block times are absolute (PRD F03 AC3): no other block moves.
 */
export function planBlockSave(
  original: BlockLike | null,
  draft: BlockDraft,
  ctx: { templateId: string; blocks: readonly BlockLike[]; newId: string },
): Change[] {
  const row = blockRow(draft);
  if (!original) {
    const siblings = ctx.blocks.filter((b) => b.template_id === ctx.templateId && !b.deleted_at);
    return [
      {
        op: 'upsert',
        table: 'routine_block',
        row: { id: ctx.newId, template_id: ctx.templateId, ...row, sort: maxSort(siblings) + 1 },
      },
    ];
  }
  const before: Row = {
    title: original.title,
    kind: original.kind,
    start_time: original.start_time.slice(0, 5),
    duration_min: original.duration_min,
    ref_slot: original.ref_slot,
    auto_complete: original.auto_complete,
    is_optional: original.is_optional,
    notify: original.notify,
  };
  const changed = Object.fromEntries(Object.entries(row).filter(([k, v]) => before[k] !== v));
  // auto_complete follows a kind change only; an untouched kind keeps the stored value.
  if (!('kind' in changed)) delete changed.auto_complete;
  if (Object.keys(changed).length === 0) return [];
  return [{ op: 'upsert', table: 'routine_block', clientId: original.client_id, row: changed }];
}

export function planBlockDelete(block: Pick<BlockLike, 'client_id'>): Change[] {
  return [{ op: 'delete', table: 'routine_block', clientId: block.client_id }];
}

/**
 * Move a block one place up or down the timeline. Times are absolute, so the
 * two blocks swap start times (the slot stays, the activity moves).
 */
export function planMove(
  blocks: readonly BlockLike[],
  templateId: string,
  clientId: string,
  direction: -1 | 1,
): Change[] {
  const list = blocksOf(blocks, templateId);
  const i = list.findIndex((b) => b.client_id === clientId);
  const j = i + direction;
  const a = list[i];
  const b = list[j];
  if (!a || !b) return [];
  if (dayMinutes(a.start_time) === dayMinutes(b.start_time)) {
    // Same time: order by `sort` instead.
    if (a.sort === b.sort)
      return [
        {
          op: 'upsert',
          table: 'routine_block',
          clientId: a.client_id,
          row: { sort: a.sort + direction },
        },
      ];
    return [
      { op: 'upsert', table: 'routine_block', clientId: a.client_id, row: { sort: b.sort } },
      { op: 'upsert', table: 'routine_block', clientId: b.client_id, row: { sort: a.sort } },
    ];
  }
  return [
    {
      op: 'upsert',
      table: 'routine_block',
      clientId: a.client_id,
      row: { start_time: b.start_time.slice(0, 5) },
    },
    {
      op: 'upsert',
      table: 'routine_block',
      clientId: b.client_id,
      row: { start_time: a.start_time.slice(0, 5) },
    },
  ];
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const iso = (now: number) => new Date(now).toISOString();

export function validateTemplateName(name: string): string | null {
  const n = name.trim();
  if (n.length === 0) return 'Give the template a name.';
  if (n.length > 60) return 'Keep the name under 60 characters.';
  return null;
}

/**
 * Rename / reassign weekdays. `updated_at` is sent so "last edited wins" works
 * on this phone before the server's trigger stamps the real time.
 */
export function planTemplateSave(
  t: TemplateRowLike & { name: string },
  next: { name: string; weekdays: readonly number[] },
  now: number,
): Change[] {
  const row: Row = {};
  const name = next.name.trim();
  if (name !== t.name) row.name = name;
  const days = [...new Set(next.weekdays)].sort((a, b) => a - b);
  const current = [...t.weekdays].sort((a, b) => a - b);
  if (days.join() !== current.join()) row.weekdays = days;
  if (Object.keys(row).length === 0) return [];
  return [
    {
      op: 'upsert',
      table: 'routine_template',
      clientId: t.client_id,
      row: { ...row, updated_at: iso(now) },
    },
  ];
}

function uniqueName(
  base: string,
  templates: readonly { name: string; deleted_at?: string | null }[],
) {
  const taken = new Set(templates.filter((t) => !t.deleted_at).map((t) => t.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`)) return `${base} ${i}`.slice(0, 60);
}

export function planNewTemplate(
  templates: readonly TemplateRowLike[],
  newId: string,
  now: number,
): Change[] {
  return [
    {
      op: 'upsert',
      table: 'routine_template',
      row: {
        id: newId,
        name: uniqueName('New template', templates),
        weekdays: [],
        is_default: false,
        sort: maxSort(templates) + 1,
        updated_at: iso(now),
      },
    },
  ];
}

/** Copy a template and its blocks. The copy claims no weekdays (no surprise conflicts). */
export function planDuplicate(
  t: TemplateRowLike,
  templates: readonly TemplateRowLike[],
  blocks: readonly BlockLike[],
  newId: () => string,
  now: number,
): { templateId: string; changes: Change[] } {
  const templateId = newId();
  const changes: Change[] = [
    {
      op: 'upsert',
      table: 'routine_template',
      row: {
        id: templateId,
        name: uniqueName(`${t.name} copy`.slice(0, 60), templates),
        weekdays: [],
        is_default: false,
        sort: maxSort(templates) + 1,
        updated_at: iso(now),
      },
    },
  ];
  for (const b of blocksOf(blocks, t.id)) {
    changes.push({
      op: 'upsert',
      table: 'routine_block',
      row: {
        id: newId(),
        template_id: templateId,
        title: b.title,
        kind: b.kind,
        start_time: b.start_time.slice(0, 5),
        duration_min: b.duration_min,
        ref_slot: b.ref_slot,
        auto_complete: b.auto_complete,
        is_optional: b.is_optional,
        notify: b.notify,
        sort: b.sort,
      },
    });
  }
  return { templateId, changes };
}

export type DayLogRef = {
  date: DateString;
  template_id: string | null;
  deleted_at?: string | null;
};

/**
 * PRD F04: a template referenced by any day_log in the last 7 days (today
 * included) can't be deleted — offer Archive. The last active template can't
 * go at all (Today needs a plan).
 */
export function removalRule(
  t: TemplateRowLike,
  ctx: { templates: readonly TemplateRowLike[]; dayLogs: readonly DayLogRef[]; today: DateString },
): 'delete' | 'archive' | 'keep' {
  const others = activeTemplates(ctx.templates).filter((o) => o.id !== t.id);
  if (others.length === 0) return 'keep';
  const from = addDays(ctx.today, -6);
  const used = ctx.dayLogs.some(
    (d) => !d.deleted_at && d.template_id === t.id && d.date >= from && d.date <= ctx.today,
  );
  return used ? 'archive' : 'delete';
}

/** Hand the default role to the next active template if `t` had it. */
function passDefault(t: TemplateRowLike, templates: readonly TemplateRowLike[], now: number) {
  if (!t.is_default) return [];
  const next = activeTemplates(templates).find((o) => o.id !== t.id);
  return next
    ? [
        {
          op: 'upsert' as const,
          table: 'routine_template' as const,
          clientId: next.client_id,
          row: { is_default: true, updated_at: iso(now) },
        },
      ]
    : [];
}

export function planDeleteTemplate(
  t: TemplateRowLike,
  templates: readonly TemplateRowLike[],
  blocks: readonly BlockLike[],
  now: number,
): Change[] {
  return [
    ...passDefault(t, templates, now),
    ...blocksOf(blocks, t.id).map((b): Change => ({
      op: 'delete',
      table: 'routine_block',
      clientId: b.client_id,
    })),
    { op: 'delete', table: 'routine_template', clientId: t.client_id },
  ];
}

/** Archive: hidden and frees its weekdays; past days still show it. */
export function planArchive(
  t: TemplateRowLike,
  templates: readonly TemplateRowLike[],
  now: number,
): Change[] {
  return [
    ...passDefault(t, templates, now),
    {
      op: 'upsert',
      table: 'routine_template',
      clientId: t.client_id,
      row: { archived_at: iso(now), weekdays: [], is_default: false, updated_at: iso(now) },
    },
  ];
}

export function planRestore(t: TemplateRowLike, now: number): Change[] {
  return [
    {
      op: 'upsert',
      table: 'routine_template',
      clientId: t.client_id,
      row: { archived_at: null, updated_at: iso(now) },
    },
  ];
}

// ---------------------------------------------------------------------------
// Switch template (Today)
// ---------------------------------------------------------------------------

export type SwitchScope = 'today' | 'always';

/**
 * "Switch template for today" stores `day_log.template_id` (reusing today's
 * row). "From now on" also gives today's weekday to the chosen template and
 * takes it from the others.
 */
export function planSwitch(
  target: TemplateRowLike,
  scope: SwitchScope,
  ctx: {
    today: DateString;
    todayDayLog: { client_id: string; deleted_at?: string | null } | null;
    templates: readonly TemplateRowLike[];
    now: number;
  },
): Change[] {
  const changes: Change[] = [
    {
      op: 'upsert',
      table: 'day_log',
      ...(ctx.todayDayLog ? { clientId: ctx.todayDayLog.client_id } : {}),
      row: { date: ctx.today, template_id: target.id, deleted_at: null },
    },
  ];
  if (scope === 'always') {
    const day = isoWeekday(ctx.today);
    for (const t of activeTemplates(ctx.templates)) {
      if (t.id === target.id || !t.weekdays.includes(day)) continue;
      changes.push({
        op: 'upsert',
        table: 'routine_template',
        clientId: t.client_id,
        row: { weekdays: t.weekdays.filter((d) => d !== day), updated_at: iso(ctx.now - 1) },
      });
    }
    if (!target.weekdays.includes(day)) {
      changes.push({
        op: 'upsert',
        table: 'routine_template',
        clientId: target.client_id,
        row: {
          weekdays: [...target.weekdays, day].sort((a, b) => a - b),
          updated_at: iso(ctx.now),
        },
      });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Undo (PRD §4.5: destructive actions offer Undo for 5 s)
// ---------------------------------------------------------------------------

function fullBlockRow(b: BlockLike): Row {
  return {
    id: b.id,
    template_id: b.template_id,
    title: b.title,
    kind: b.kind,
    start_time: b.start_time.slice(0, 5),
    duration_min: b.duration_min,
    ref_slot: b.ref_slot,
    auto_complete: b.auto_complete,
    is_optional: b.is_optional,
    notify: b.notify,
    sort: b.sort,
    deleted_at: null,
  };
}

/**
 * Undo a block delete: the whole row again, so it works whether the delete
 * already reached the server (revive) or cancelled an unsynced insert (re-create).
 */
export function planBlockRestore(b: BlockLike): Change[] {
  return [{ op: 'upsert', table: 'routine_block', clientId: b.client_id, row: fullBlockRow(b) }];
}

/** Undo a template delete: template, its blocks, and the default flag back where it was. */
export function planTemplateRestore(
  t: TemplateRowLike,
  templates: readonly TemplateRowLike[],
  blocks: readonly BlockLike[],
  now: number,
): Change[] {
  const changes: Change[] = [
    {
      op: 'upsert',
      table: 'routine_template',
      clientId: t.client_id,
      row: {
        id: t.id,
        name: t.name,
        weekdays: t.weekdays,
        is_default: t.is_default,
        sort: t.sort,
        archived_at: t.archived_at ?? null,
        deleted_at: null,
        updated_at: iso(now),
      },
    },
    ...blocksOf(blocks, t.id).map((b): Change => ({
      op: 'upsert',
      table: 'routine_block',
      clientId: b.client_id,
      row: fullBlockRow(b),
    })),
  ];
  const heir = t.is_default ? activeTemplates(templates).find((o) => o.id !== t.id) : undefined;
  if (heir && !heir.is_default)
    changes.push({
      op: 'upsert',
      table: 'routine_template',
      clientId: heir.client_id,
      row: { is_default: false, updated_at: iso(now) },
    });
  return changes;
}
