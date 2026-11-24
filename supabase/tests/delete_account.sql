-- F25: deleting the login removes every LifeOS row of that user, nobody else's,
-- and only the server may call purge_auth_leftovers.
begin;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000d7'),
  ('00000000-0000-0000-0000-0000000000d8') on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}', true);
select public.seed_defaults();
insert into public.weight_log (date, weight_kg) values ('2026-11-24', 70);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d8","role":"authenticated"}', true);
select public.seed_defaults();

do $$
begin
  begin
    perform public.purge_auth_leftovers('00000000-0000-0000-0000-0000000000d8');
    raise exception 'FAIL: a signed-in user may call purge_auth_leftovers';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select public.purge_auth_leftovers('00000000-0000-0000-0000-0000000000d7');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d7';

do $$
declare
  t text;
  left_rows bigint;
  other_rows bigint := 0;
  n bigint;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('select count(*) from public.%I where user_id = $1', t)
      into left_rows using '00000000-0000-0000-0000-0000000000d7'::uuid;
    if left_rows > 0 then
      raise exception 'FAIL: % still has % rows of the deleted user', t, left_rows;
    end if;
    execute format('select count(*) from public.%I where user_id = $1', t)
      into n using '00000000-0000-0000-0000-0000000000d8'::uuid;
    other_rows := other_rows + n;
  end loop;
  if other_rows = 0 then raise exception 'FAIL: the other user lost their data'; end if;
  raise notice 'delete_account.sql: every row gone, other user kept % rows', other_rows;
end $$;
rollback;
