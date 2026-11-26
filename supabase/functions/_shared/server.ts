// Deno-only helpers for the Life Edge Functions (not part of the app bundle).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { bearer, isTokenShaped, sha256Hex } from './ingest.ts';

export type Admin = SupabaseClient;

/** Service-role client: server only. Every query below is scoped to one user_id. */
export function admin(): Admin {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * The caller's user id, or null (→ 401). Accepts a personal access token
 * (`lifeos_pat_…`, looked up by SHA-256, must not be revoked) or the app's
 * own signed-in session JWT (Parser Lab "Process now").
 */
export async function authenticate(req: Request, db: Admin): Promise<string | null> {
  const token = bearer(req.headers.get('Authorization'));
  if (!token) return null;
  if (isTokenShaped(token)) {
    const hash = await sha256Hex(token);
    const { data, error } = await db
      .from('api_token')
      .select('id, user_id')
      .eq('token_hash', hash)
      .is('revoked_at', null)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) return null;
    await db.from('api_token').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
    return data.user_id as string;
  }
  if (token.startsWith('lifeos_pat_')) return null;
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function categoriesOf(db: Admin, userId: string) {
  const { data } = await db
    .from('expense_category')
    .select('id, name')
    .eq('user_id', userId)
    .is('deleted_at', null);
  return (data ?? []) as { id: string; name: string }[];
}
