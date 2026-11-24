-- F17 AC1: no more than 3 open top-3 tasks for a day.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

insert into public.task (title, is_top3, top3_date) values
  ('a', true, '2026-11-24'), ('b', true, '2026-11-24'), ('c', true, '2026-11-24'),
  ('old', true, '2026-11-23');

do $$
declare cid uuid;
begin
  begin
    insert into public.task (title, is_top3, top3_date) values ('d', true, '2026-11-24');
    raise exception 'FAIL: a 4th top-3 task was accepted';
  exception when check_violation then null;
  end;
  -- a done one frees its slot; re-saving a top-3 row is fine
  update public.task set status = 'done' where title = 'a';
  insert into public.task (title, is_top3, top3_date) values ('d', true, '2026-11-24');
  select client_id into cid from public.task where title = 'b';
  insert into public.task (client_id, title, is_top3, top3_date) values (cid, 'b2', true, '2026-11-24')
    on conflict (client_id) do update set title = excluded.title;
  begin
    insert into public.task (title, is_top3) values ('no date', true);
    raise exception 'FAIL: top 3 without a date';
  exception when check_violation then null;
  end;
  raise notice 'tasks.sql ok';
end $$;
rollback;
