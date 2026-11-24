-- LifeOS · F25 · delete account removes every trace of the user.
-- auth.users ON DELETE CASCADE already removes every LifeOS row and the auth
-- tables that reference the user. Two auth tables hold the user id without a
-- foreign key (PKCE flow state, orphaned refresh tokens); the delete-account
-- Edge Function calls this first. Server only: service_role may execute it.
create or replace function public.purge_auth_leftovers(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regclass('auth.flow_state') is not null then
    execute 'delete from auth.flow_state where user_id = $1' using target;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'delete from auth.refresh_tokens where user_id = $1' using target::text;
  end if;
end;
$$;

revoke all on function public.purge_auth_leftovers(uuid) from public, anon, authenticated;
grant execute on function public.purge_auth_leftovers(uuid) to service_role;
