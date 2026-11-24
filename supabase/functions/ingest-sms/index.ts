// POST /functions/v1/ingest-sms  {"text": "<bank SMS>", "received_at"?: iso}
// Authorization: Bearer lifeos_pat_…  (or the app's session for {"process": true})
// PRD F19: raw SMS → expense_inbox → classify → expense / expense_skipped.
import {
  categoryIdFor,
  type IngestStore,
  ingestResponse,
  parseIngestBody,
  processInbox,
} from '../_shared/ingest.ts';
import { admin, authenticate, categoriesOf, json, readJson } from '../_shared/server.ts';
import { classifySms } from '../_shared/smsParser.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const db = admin();
  const userId = await authenticate(req, db);
  if (!userId) return json(401, { error: 'Invalid or revoked token' });

  const body = await readJson(req);
  const cats = await categoriesOf(db, userId);
  const store: IngestStore = {
    pendingInbox: async (limit) => {
      const { data, error } = await db
        .from('expense_inbox')
        .select('id, raw_sms, received_at, attempts')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('received_at')
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    insertExpense: async (row) => {
      const { error } = await db.from('expense').insert({ ...row, user_id: userId });
      if (!error) return 'inserted';
      if (error.code === '23505') return 'duplicate';
      throw new Error(error.message);
    },
    insertSkipped: async (row) => {
      const { error } = await db.from('expense_skipped').insert({ ...row, user_id: userId });
      if (error) throw new Error(error.message);
    },
    deleteInbox: async (id) => {
      const { error } = await db.from('expense_inbox').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    markFailed: async (id, lastError, attempts) => {
      await db
        .from('expense_inbox')
        .update({ last_error: lastError, attempts })
        .eq('id', id)
        .eq('user_id', userId);
    },
    categoryId: (key) => categoryIdFor(key, cats),
  };

  // The app's Parser Lab: retry whatever is waiting.
  if ((body as { process?: unknown } | null)?.process === true) {
    const r = await processInbox(store, classifySms);
    const { outcomes: _o, ...summary } = r;
    return json(200, summary);
  }

  const input = parseIngestBody(body, Date.now());
  if (!input.ok) return json(400, { error: input.error });
  const { data, error } = await db
    .from('expense_inbox')
    .insert({ user_id: userId, raw_sms: input.text, received_at: input.receivedAt })
    .select('id')
    .single();
  if (error || !data) return json(500, { error: error?.message ?? 'Could not queue the SMS' });

  const r = await processInbox(store, classifySms);
  return json(200, { ...ingestResponse(r.outcomes[data.id]), processed: r.processed });
});
