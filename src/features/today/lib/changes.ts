import type { Change } from '@/features/routine/lib/changes';
import type { DateString } from '@/lib/dates';

import type { BlockLogLike, SkipReason } from '../selectors';

export type BlockStatus = { status: 'done' } | { status: 'skipped'; reason: SkipReason } | null;

/**
 * Set a block's log for the day: reuse the day's row for that block
 * (unique per user/date/block), revive it if deleted, or soft-delete it to clear.
 */
export function planBlockStatus(
  blockId: string,
  date: DateString,
  log: Pick<BlockLogLike, 'client_id' | 'deleted_at'> | null,
  next: BlockStatus,
  now: number,
): Change[] {
  if (!next)
    return log && !log.deleted_at
      ? [{ op: 'delete', table: 'block_log', clientId: log.client_id }]
      : [];
  return [
    {
      op: 'upsert',
      table: 'block_log',
      ...(log ? { clientId: log.client_id } : {}),
      row: {
        date,
        block_id: blockId,
        status: next.status,
        skip_reason: next.status === 'skipped' ? next.reason : null,
        done_at: next.status === 'done' ? new Date(now).toISOString() : null,
        deleted_at: null,
      },
    },
  ];
}

/** The status a log row represents (for Undo). */
export function statusOf(
  log: Pick<BlockLogLike, 'status' | 'skip_reason' | 'deleted_at'> | null,
): BlockStatus {
  if (!log || log.deleted_at) return null;
  if (log.status === 'done') return { status: 'done' };
  if (log.status === 'skipped')
    return { status: 'skipped', reason: (log.skip_reason ?? 'other') as SkipReason };
  return null;
}

export function planWater(date: DateString, ml: number, now: number): Change[] {
  return [
    {
      op: 'upsert',
      table: 'water_log',
      row: { date, amount_ml: ml, logged_at: new Date(now).toISOString() },
    },
  ];
}

/** day_log.note on today's row (reused / revived like every per-day row). */
export function planNote(
  date: DateString,
  dayLog: { client_id: string } | null,
  note: string,
  templateId: string | null,
): Change[] {
  const text = note.trim();
  return [
    {
      op: 'upsert',
      table: 'day_log',
      ...(dayLog ? { clientId: dayLog.client_id } : {}),
      row: {
        date,
        note: text.length > 0 ? text.slice(0, 500) : null,
        deleted_at: null,
        ...(dayLog ? {} : { template_id: templateId }),
      },
    },
  ];
}

/** Last night's sleep, stored on the logical day the night ends (PRD §5). */
export function planSleep(
  date: DateString,
  existing: { client_id: string } | null,
  bedAt: number,
  wakeAt: number,
): Change[] {
  return [
    {
      op: 'upsert',
      table: 'sleep_log',
      ...(existing ? { clientId: existing.client_id } : {}),
      row: {
        date,
        bed_at: new Date(bedAt).toISOString(),
        wake_at: new Date(wakeAt).toISOString(),
        deleted_at: null,
      },
    },
  ];
}
