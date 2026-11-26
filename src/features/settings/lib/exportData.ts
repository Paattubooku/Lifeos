import { strToU8, zipSync } from 'fflate';

/**
 * Every Life table, exported per user (PRD F23 AC: "valid JSON containing
 * every table"). A test checks this list against src/types/supabase.ts.
 */
export const EXPORT_TABLES = [
  'profile',
  'routine_template',
  'routine_block',
  'day_log',
  'block_log',
  'water_log',
  'meal_plan',
  'meal',
  'dish',
  'meal_item',
  'food_log',
  'coffee_log',
  'workout_program',
  'workout_day',
  'exercise',
  'workout_exercise',
  'session_log',
  'set_log',
  'weight_log',
  'session_override',
  'sleep_log',
  'steps_log',
  'task',
  'expense_category',
  'expense',
  'api_token',
  'expense_inbox',
  'expense_skipped',
  'weekly_review',
  'nudge_log',
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

/** Columns never exported: token hashes are credentials, not data. */
export const OMIT: Partial<Record<ExportTable, readonly string[]>> = { api_token: ['token_hash'] };

export type Row = Record<string, unknown>;

export function clean(table: ExportTable, rows: readonly Row[]): Row[] {
  const omit = OMIT[table] ?? [];
  return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !omit.includes(k))));
}

/** RFC 4180 CSV: header from every key seen; quotes, commas and newlines escaped; JSON for objects. */
export function toCsv(rows: readonly Row[]): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

export type ExportDoc = {
  app: 'Life';
  version: 1;
  exported_at: string;
  user: string | null;
  counts: Record<ExportTable, number>;
  tables: Record<ExportTable, Row[]>;
};

export function buildExport(
  data: Partial<Record<ExportTable, readonly Row[]>>,
  exportedAt: string,
  user: string | null,
): ExportDoc {
  const tables = Object.fromEntries(
    EXPORT_TABLES.map((t) => [t, clean(t, data[t] ?? [])]),
  ) as Record<ExportTable, Row[]>;
  const counts = Object.fromEntries(EXPORT_TABLES.map((t) => [t, tables[t].length])) as Record<
    ExportTable,
    number
  >;
  return { app: 'Life', version: 1, exported_at: exportedAt, user, counts, tables };
}

/** One CSV per table in a zip (`lifeos-<date>/<table>.csv`). */
export function csvZip(doc: ExportDoc, date: string): Uint8Array {
  const dir = `lifeos-${date}`;
  const files: Record<string, Uint8Array> = {};
  for (const t of EXPORT_TABLES) files[`${dir}/${t}.csv`] = strToU8(toCsv(doc.tables[t]));
  files[`${dir}/README.txt`] = strToU8(
    `Life export ${doc.exported_at}\nOne CSV per table; dates are IST logical days, times are UTC.\n`,
  );
  return zipSync(files);
}

/** "~1.2 MB" for the data card. */
export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  return `~${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
