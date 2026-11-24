-- F24: new nudge kinds and the ref column.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000fb') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fb","role":"authenticated"}', true);
do $$
begin
  insert into public.nudge_log (date, kind, ref) values ('2026-11-24', 'pinned', 'block-1');
  insert into public.nudge_log (date, kind) values ('2026-11-24', 'rescue_eggs'), ('2026-11-24', 'interrupt'), ('2026-11-24', 'strict_week');
  begin
    insert into public.nudge_log (date, kind) values ('2026-11-24', 'nope');
    raise exception 'FAIL: unknown kind accepted';
  exception when check_violation then null;
  end;
  raise notice 'nudges.sql ok';
end $$;
rollback;
