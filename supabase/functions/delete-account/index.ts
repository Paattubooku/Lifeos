// POST /functions/v1/delete-account   {"confirm": "DELETE"}
// Authorization: Bearer <the app's signed-in session JWT>
//
// F25: deletes the caller's login. Every LifeOS table references auth.users with
// ON DELETE CASCADE, so all of that person's rows go with it. Personal access
// tokens (lifeos_pat_…) are refused: a token pasted into Shortcuts must never be
// able to delete the account.
import { bearer } from '../_shared/ingest.ts';
import { admin, json, readJson } from '../_shared/server.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const token = bearer(req.headers.get('Authorization'));
  if (!token || token.startsWith('lifeos_pat_')) return json(401, { error: 'Sign in again' });

  const db = admin();
  const { data } = await db.auth.getUser(token);
  const userId = data.user?.id;
  if (!userId) return json(401, { error: 'Sign in again' });

  const body = (await readJson(req)) as { confirm?: unknown } | null;
  if (body?.confirm !== 'DELETE') return json(400, { error: 'Confirm with "DELETE"' });

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return json(500, { error: error.message });
  return json(200, { ok: true });
});
