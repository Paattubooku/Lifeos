// GET or POST /functions/v1/widget-summary
// Authorization: Bearer lifeos_pat_…  (read-only: this function never writes data)
// PRD F22: what the home-screen widgets show (score, streak, water, next block, spend, top 3).
import { admin, authenticate, json } from '../_shared/server.ts';
import { addDays, buildSummary, istNow } from '../_shared/summary.ts';

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, { error: 'Use GET' });
  const db = admin();
  const userId = await authenticate(req, db);
  if (!userId) return json(401, { error: 'Reconnect in Life' });

  const now = Date.now();
  const { today } = istNow(now);
  const month = `${today.slice(0, 7)}-01`;
  const mine = <T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>) =>
    Promise.resolve(q).then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.data;
    });

  try {
    const [profile, dayLogs, templates, blocks, blockLogs, water, spend, tasks, steps] =
      await Promise.all([
        mine(
          db
            .from('profile')
            .select('water_target_ml, wake_time, monthly_budget_inr, steps_min')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .maybeSingle(),
        ),
        mine(
          db
            .from('day_log')
            .select('date, score, template_id, updated_at, deleted_at')
            .eq('user_id', userId)
            .gte('date', addDays(today, -400)),
        ),
        mine(
          db
            .from('routine_template')
            .select('id, name, weekdays, is_default, archived_at, deleted_at, updated_at')
            .eq('user_id', userId),
        ),
        mine(
          db
            .from('routine_block')
            .select('id, template_id, title, kind, start_time, duration_min, deleted_at')
            .eq('user_id', userId)
            .is('deleted_at', null),
        ),
        mine(
          db
            .from('block_log')
            .select('block_id, status')
            .eq('user_id', userId)
            .eq('date', today)
            .is('deleted_at', null),
        ),
        mine(
          db
            .from('water_log')
            .select('amount_ml')
            .eq('user_id', userId)
            .eq('date', today)
            .is('deleted_at', null),
        ),
        mine(
          db
            .from('expense')
            .select('amount_inr')
            .eq('user_id', userId)
            .eq('direction', 'debit')
            .gte('date', month)
            .lte('date', today)
            .is('deleted_at', null),
        ),
        mine(
          db
            .from('task')
            .select('title, status, priority, due_date')
            .eq('user_id', userId)
            .eq('is_top3', true)
            .eq('top3_date', today)
            .is('deleted_at', null),
        ),
        mine(
          db
            .from('steps_log')
            .select('steps')
            .eq('user_id', userId)
            .eq('date', today)
            .is('deleted_at', null)
            .maybeSingle(),
        ),
      ]);

    const summary = buildSummary({
      now,
      profile: profile as never,
      dayLogs: (dayLogs ?? []) as never,
      templates: (templates ?? []) as never,
      blocks: (blocks ?? []) as never,
      logged: new Set(
        ((blockLogs ?? []) as { block_id: string; status: string }[])
          .filter((l) => l.status === 'done' || l.status === 'skipped')
          .map((l) => l.block_id),
      ),
      waterMl: ((water ?? []) as { amount_ml: number }[]).reduce((s, w) => s + w.amount_ml, 0),
      monthSpend: ((spend ?? []) as { amount_inr: number | string }[]).reduce(
        (s, e) => s + Number(e.amount_inr),
        0,
      ),
      top3: (tasks ?? []) as { title: string; status: string }[],
      steps: (steps as { steps: number } | null)?.steps ?? null,
    });
    return json(200, summary);
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Could not build the summary' });
  }
});
