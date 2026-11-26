import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useState } from 'react';

import { selectUser } from '@/features/auth/selectors';
import { runSync } from '@/features/sync/slice';
import { todayLogical } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSnackbar } from '@/ui';

import { EXPORT_PREFIX, clearExportFiles } from '../lib/exportFiles';
import {
  buildExport,
  csvZip,
  EXPORT_TABLES,
  type ExportDoc,
  type Row,
  sizeText,
} from '../lib/exportData';

const PAGE = 1000;

/** Every row of every table for the signed-in user (RLS scopes it), paged. */
async function fetchAll(): Promise<Partial<Record<(typeof EXPORT_TABLES)[number], Row[]>>> {
  const c = getSupabase();
  const out: Partial<Record<(typeof EXPORT_TABLES)[number], Row[]>> = {};
  for (const t of EXPORT_TABLES) {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await c
        .from(t)
        .select('*')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${t}: ${error.message}`);
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    out[t] = rows;
  }
  return out;
}

function writeFile(name: string, content: string | Uint8Array): string {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(content);
  return f.uri;
}

/** Export all data as JSON or CSV (zip of one file per table) and open the share sheet (PRD F23). */
export function useExport() {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const user = useAppSelector(selectUser);
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null);
  const [last, setLast] = useState<{ rows: number; size: string } | null>(null);

  const run = async (kind: 'json' | 'csv') => {
    setBusy(kind);
    try {
      // Unsynced changes go up first so the export has everything.
      await dispatch(runSync());
      const doc: ExportDoc = buildExport(
        await fetchAll(),
        new Date().toISOString(),
        user?.email ?? null,
      );
      const date = todayLogical();
      const json = JSON.stringify(doc, null, 1);
      const uri =
        kind === 'json'
          ? writeFile(`${EXPORT_PREFIX}${date}.json`, json)
          : writeFile(`${EXPORT_PREFIX}${date}-csv.zip`, csvZip(doc, date));
      const rows = Object.values(doc.counts).reduce((s, n) => s + n, 0);
      setLast({ rows, size: sizeText(json.length) });
      if (await isAvailableAsync())
        await shareAsync(uri, {
          mimeType: kind === 'json' ? 'application/json' : 'application/zip',
          dialogTitle: 'Export Life data',
          UTI: kind === 'json' ? 'public.json' : 'public.zip-archive',
        });
      showSnackbar({ message: `Exported ${rows} rows` });
    } catch {
      showSnackbar({ message: 'Export needs a connection. Try again when online.' });
    } finally {
      // The share sheet has closed (or failed): don't keep a full copy on the phone.
      clearExportFiles();
      setBusy(null);
    }
  };

  return { busy, last, exportJson: () => run('json'), exportCsv: () => run('csv') };
}
