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
  raise notice 'views.sql: all checks passed';
end $$;

rollback;
