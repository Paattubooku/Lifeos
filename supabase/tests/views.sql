-- F09 AC2: a third coffee is logged and v_daily_summary.coffee_count = 3;
-- off-plan food counts in the day's kcal and protein (F09 AC1).
-- Rolled back at the end; safe to run against the real project.

begin;

insert into auth.users (id, email) values ('00000000-0000-4000-a000-0000000000d1', 'views@lifeos.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true);

do $$
declare
  s record;
  n int;
  avgs text;
begin
  insert into public.coffee_log (client_id, date) values
    (gen_random_uuid(), '2026-11-23'),
    (gen_random_uuid(), '2026-11-23'),
    (gen_random_uuid(), '2026-11-23');
  -- a deleted coffee doesn't count
  insert into public.coffee_log (client_id, date, deleted_at) values (gen_random_uuid(), '2026-11-23', now());

  insert into public.food_log (client_id, date, free_text, kcal, protein_g, is_off_plan)
    values (gen_random_uuid(), '2026-11-23', 'Masala vada ×2', 250, 8, true);

  select * into s from public.v_daily_summary where date = '2026-11-23';
  if s.coffee_count <> 3 then
    raise exception 'coffee_count should be 3, got %', s.coffee_count;
  end if;
  if s.kcal <> 250 or s.protein_g <> 8 then
    raise exception 'off-plan food should be in the summary (250 kcal, 8 g), got % kcal, % g', s.kcal, s.protein_g;
  end if;

  select count(*) into n from public.v_daily_summary;
  if n <> 1 then raise exception 'expected one summary day, got %', n; end if;
  -- F13 AC1: the app's 7-day average (body/lib/weight.ts) uses the same window;
  -- these weigh-ins and averages are the ones in weight.test.ts.
  insert into public.weight_log (client_id, date, weight_kg) values
    (gen_random_uuid(), '2026-12-01', 91), (gen_random_uuid(), '2026-12-02', 90.8),
    (gen_random_uuid(), '2026-12-04', 90.5), (gen_random_uuid(), '2026-12-05', 90.4),
    (gen_random_uuid(), '2026-12-06', 90.1), (gen_random_uuid(), '2026-12-07', 90.2),
    (gen_random_uuid(), '2026-12-08', 89.9);
  select string_agg(avg7::text, ',' order by date) into avgs
    from public.v_weight_trend where date between '2026-12-01' and '2026-12-08';
  if avgs <> '91.00,90.90,90.77,90.68,90.56,90.50,90.32' then
    raise exception 'v_weight_trend avg7 should match the app, got %', avgs;
  end if;

  raise notice 'views.sql: all checks passed';
end $$;

rollback;
