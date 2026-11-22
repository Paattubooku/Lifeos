-- F01 AC2: a second Supabase user cannot read or change PTR's rows.
--
-- Plain SQL (no pgTAP) so it runs anywhere: locally via `npm run test:db`, or
-- against the real project (psql / SQL editor). Everything happens in one
-- transaction that is rolled back, so nothing is left behind.
-- Any failed check raises an exception and aborts the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'rls-a@lifeos.test'),
  ('00000000-0000-4000-a000-00000000000b', 'rls-b@lifeos.test');

-- ---------------------------------------------------------------- user A (PTR)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

select public.seed_defaults();
insert into public.day_log (date, score, is_streak_day) values ('2026-11-20', 82, true);
insert into public.water_log (date, amount_ml) values ('2026-11-20', 500);
insert into public.food_log (date, free_text, kcal, protein_g, is_off_plan) values ('2026-11-20', 'Eggs', 140, 12, true);
insert into public.coffee_log (date) values ('2026-11-20');
insert into public.weight_log (date, weight_kg) values ('2026-11-20', 91.0);
insert into public.sleep_log (date, bed_at, wake_at) values ('2026-11-20', '2026-11-19 22:40+05:30', '2026-11-20 05:05+05:30');
insert into public.session_log (date, completion) values ('2026-11-20', 90);
insert into public.task (title) values ('Pay electricity bill');
insert into public.expense (date, amount_inr, merchant) values ('2026-11-20', 240, 'Hot N Spicy');
insert into public.api_token (name, token_hash, last4) values ('iPhone Shortcuts', 'hash-a', 'ab12');
insert into public.weekly_review (week_start, went_well) values ('2026-11-16', 'Slept on time');
insert into public.nudge_log (date, kind) values ('2026-11-20', 'fallback');

do $$
declare n int;
begin
  select count(*) into n from public.water_log;
  if n <> 1 then raise exception 'A should see their own water_log row, saw %', n; end if;
  select count(*) into n from public.v_daily_summary;
  if n <> 1 then raise exception 'A should see 1 day in v_daily_summary, saw %', n; end if;
end $$;

-- ---------------------------------------------------------------- user B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);

-- B sees nothing in any table or view.
do $$
declare t record; n bigint;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'v')
  loop
    execute format('select count(*) from public.%I', t.relname) into n;
    if n <> 0 then
      raise exception 'RLS leak: user B sees % row(s) in public.%', n, t.relname;
    end if;
  end loop;
end $$;

-- B cannot update or delete A's rows (RLS hides them: 0 rows affected).
do $$
declare n int;
begin
  update public.water_log set amount_ml = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B updated % of A''s water_log rows', n; end if;

  update public.profile set kcal_target = 1000;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B updated A''s profile'; end if;

  delete from public.expense;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B deleted % of A''s expenses', n; end if;
end $$;

-- B cannot write rows owned by A (WITH CHECK).
do $$
begin
  begin
    insert into public.water_log (user_id, date, amount_ml)
    values ('00000000-0000-4000-a000-00000000000a', '2026-11-20', 250);
    raise exception 'B inserted a row owned by A';
  exception when insufficient_privilege then
    null; -- expected: new row violates row-level security policy
  end;
end $$;

-- B's own rows work and stay private to B.
insert into public.water_log (date, amount_ml) values ('2026-11-20', 300);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
do $$
declare n int; total int;
begin
  select count(*), sum(amount_ml) into n, total from public.water_log;
  if n <> 1 or total <> 500 then
    raise exception 'A should still see only their 500 ml row (saw % rows, % ml)', n, total;
  end if;
  select kcal_target into n from public.profile;
  if n <> 2200 then raise exception 'A''s profile was changed by B (kcal_target %)', n; end if;
end $$;

-- ---------------------------------------------------------------- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare t record; n bigint;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'v')
  loop
    begin
      execute format('select count(*) from public.%I', t.relname) into n;
      if n <> 0 then raise exception 'RLS leak: anon sees % row(s) in public.%', n, t.relname; end if;
    exception when insufficient_privilege then
      null; -- no grant at all is also fine
    end;
  end loop;

  begin
    perform public.seed_defaults();
    raise exception 'anon was able to run seed_defaults()';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
do $$ begin raise notice 'rls.sql: all checks passed'; end $$;
rollback;
