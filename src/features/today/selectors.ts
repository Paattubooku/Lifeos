import type { BlockLike } from '@/features/routine/lib/blocks';

import { type AutoInputs, type AutoStatus, autoStatus } from './lib/auto';
import { type BlockState, blockState, currentBlock, nextBlock } from './lib/timeline';

export type SkipReason = 'sick' | 'travel' | 'rest' | 'other';

export type BlockLogLike = {
  client_id: string;
  block_id: string;
  status: 'done' | 'skipped' | string;
  skip_reason?: string | null;
  done_at?: string | null;
  deleted_at?: string | null;
};

export type DayRow = {
  block: BlockLike;
  log: BlockLogLike | null;
  auto: AutoStatus;
  state: BlockState;
};

/** One live log per block (the newest edit wins if two devices raced). */
export function logsByBlock(logs: readonly BlockLogLike[]): Map<string, BlockLogLike> {
  const map = new Map<string, BlockLogLike>();
  for (const l of logs) if (!l.deleted_at) map.set(l.block_id, l);
  return map;
}

export function isDone(row: Pick<DayRow, 'log' | 'auto'>): boolean {
  return row.log?.status === 'done' || row.auto.done;
}

/** Skipped with a reason leaves the denominator (PRD §4.2, DESIGN_NOTES B2). */
export function isExcused(row: Pick<DayRow, 'log' | 'auto'>): boolean {
  return !isDone(row) && row.log?.status === 'skipped' && Boolean(row.log.skip_reason);
}

export type Score = { done: number; counted: number; score: number };

/**
 * PRD §4.2: counted = the day's blocks − optional − skipped with a reason;
 * score = done ÷ counted, rounded; 100 when nothing is counted.
 */
export function computeScore(rows: readonly Pick<DayRow, 'block' | 'log' | 'auto'>[]): Score {
  const counted = rows.filter((r) => !r.block.is_optional && !isExcused(r));
  const done = counted.filter(isDone).length;
  return {
    done,
    counted: counted.length,
    score: counted.length === 0 ? 100 : Math.round((done / counted.length) * 100),
  };
}

/** Every block of the day with its log, auto-complete status and state at `nowMin`. */
export function buildDay(
  blocks: readonly BlockLike[],
  logs: readonly BlockLogLike[],
  inputs: AutoInputs,
  nowMin: number,
) {
  const byBlock = logsByBlock(logs);
  const rows: DayRow[] = blocks.map((block) => {
    const log = byBlock.get(block.id) ?? null;
    const auto = autoStatus(block, blocks, inputs);
    const status = log?.status === 'done' || log?.status === 'skipped' ? log.status : null;
    return { block, log, auto, state: blockState(block, { nowMin, status, autoDone: auto.done }) };
  });
  const states = new Map(rows.map((r) => [r.block.client_id, r.state]));
  const current = currentBlock(blocks, states);
  const next = nextBlock(blocks, nowMin);
  return {
    rows,
    score: computeScore(rows),
    current: rows.find((r) => r.block.client_id === current?.client_id) ?? null,
    next: rows.find((r) => r.block.client_id === next?.client_id) ?? null,
  };
}

/** Counted blocks still open (not done, not excused) — the end-of-day list. */
export function openRows(rows: readonly DayRow[]): DayRow[] {
  return rows.filter((r) => !r.block.is_optional && !isDone(r) && !isExcused(r));
}
