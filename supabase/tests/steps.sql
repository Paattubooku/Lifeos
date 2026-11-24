-- F21: a steps block is allowed; steps_log is one row per day.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000fa') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fa","role":"authenticated"}', true);
do $$
declare tid uuid;
begin
  insert into public.routine_template (name) values ('T') returning id into tid;
  insert into public.routine_block (template_id, title, kind, start_time, duration_min, auto_complete)
    values (tid, '6,000 steps', 'steps', '19:00', 30, true);
  begin
    insert into public.routine_block (template_id, title, kind, start_time, duration_min)
      values (tid, 'x', 'nope', '19:00', 30);
    raise exception 'FAIL: unknown kind accepted';
  exception when check_violation then null;
  end;
  insert into public.steps_log (date, steps, source) values ('2026-11-24', 4200, 'health');
  begin
    insert into public.steps_log (date, steps) values ('2026-11-24', 10);
    raise exception 'FAIL: two steps rows for one day';
  exception when unique_violation then null;
  end;
  raise notice 'steps.sql ok';
end $$;
rollback;
