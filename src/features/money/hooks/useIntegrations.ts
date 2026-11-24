import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import { useMemo, useState } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import { applyChanges } from '@/features/routine/slice';
import { mergeKeepingDeleted } from '@/features/today/lib/merge';
import { getSupabase } from '@/lib/supabase';
import { useAppDispatch } from '@/store';
import { baseApi } from '@/store/baseApi';
import { useSnackbar } from '@/ui';

import {
  type ApiTokenRow,
  type SkippedRow,
  useGetApiTokensQuery,
  useGetInboxQuery,
  useGetSkippedQuery,
} from '../api';
import { type NewExpense, planExpense } from '../lib/expense';
import { last4 } from '../lib/ingest';
import { sortTokens, tokenFromBytes } from '../lib/tokens';

export type ProcessSummary = {
  processed: number;
  expenses: number;
  duplicates: number;
  skipped: number;
  leftInInbox: number;
};

/** Tokens, inbox and skipped messages, and their actions (PRD F19). */
export function useIntegrations() {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const tq = useGetApiTokensQuery();
  const iq = useGetInboxQuery();
  const sq = useGetSkippedQuery();
  const tokenWrites = useLocalWrites('api_token');
  const skippedWrites = useLocalWrites('expense_skipped');
  const [processing, setProcessing] = useState(false);

  const tokens = useMemo(
    () => sortTokens(mergeKeepingDeleted<ApiTokenRow>(tq.data ?? [], tokenWrites)),
    [tq.data, tokenWrites],
  );
  const skipped = useMemo(
    () =>
      mergeKeepingDeleted<SkippedRow>(sq.data ?? [], skippedWrites).filter(
        (s) => !s.deleted_at && !s.overridden,
      ),
    [sq.data, skippedWrites],
  );
  /** Token rows that only exist on this phone so far (they work once synced). */
  const pendingTokens = new Set(
    tokens
      .filter((t) => !(tq.data ?? []).some((r) => r.client_id === t.client_id))
      .map((t) => t.client_id),
  );

  /** Make a token; returns the plain value, which is shown once and never stored. */
  const createToken = async (name: string): Promise<string> => {
    let token: string | null = null;
    while (!token) token = tokenFromBytes(getRandomBytes(64));
    const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, token);
    await dispatch(
      applyChanges([
        {
          op: 'upsert',
          table: 'api_token',
          row: {
            name: name.trim().slice(0, 60),
            token_hash: hash.toLowerCase(),
            last4: last4(token),
          },
        },
      ]),
    );
    return token;
  };

  const revoke = (t: ApiTokenRow) => {
    void dispatch(
      applyChanges([
        {
          op: 'upsert',
          table: 'api_token',
          clientId: t.client_id,
          row: { revoked_at: new Date().toISOString() },
        },
      ]),
    );
    showSnackbar({ message: `${t.name} revoked` });
  };

  /** Run the server's inbox processor now (needs a connection). */
  const processNow = async (): Promise<ProcessSummary | null> => {
    setProcessing(true);
    try {
      const { data, error } = await getSupabase().functions.invoke<ProcessSummary>('ingest-sms', {
        body: { process: true },
      });
      if (error || !data) throw error ?? new Error('No response');
      dispatch(baseApi.util.invalidateTags(['Expense']));
      showSnackbar({
        message: `${data.processed} processed · ${data.expenses} saved · ${data.skipped} skipped${data.leftInInbox ? ` · ${data.leftInInbox} left` : ''}`,
      });
      return data;
    } catch {
      showSnackbar({ message: 'Could not reach LifeOS. Try again when online.' });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  /** Parser Lab override: save a skipped SMS as an expense and mark it overridden. */
  const markAsExpense = (s: SkippedRow, e: NewExpense) => {
    void dispatch(
      applyChanges([
        {
          op: 'upsert',
          table: 'expense',
          row: { ...planExpense(e), source: 'sms', raw_sms: s.raw_sms },
        },
        {
          op: 'upsert',
          table: 'expense_skipped',
          clientId: s.client_id,
          row: { overridden: true },
        },
      ]),
    );
    showSnackbar({ message: 'Saved as an expense' });
  };

  return {
    tokens,
    pendingTokens,
    inbox: iq.data ?? [],
    skipped,
    processing,
    createToken,
    revoke,
    processNow,
    markAsExpense,
  };
}
