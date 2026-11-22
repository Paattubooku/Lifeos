-- LifeOS · F01 · summary views (PRD §5.6)
--
-- All views are security_invoker, so the caller's RLS applies: a user only ever
-- aggregates their own rows. Soft-deleted rows are excluded everywhere.
-- `kcal` is food only; the app adds coffee kcal (20 each, PRD §6.3) on top.

create view public.v_daily_summary
with (security_invoker = on) as
with days as (
  select user_id, date from public.day_log where deleted_at is null
  union select user_id, date from public.water_log where deleted_at is null
  union select user_id, date from public.food_log where deleted_at is null
  union select user_id, date from public.coffee_log where deleted_at is null
  union select user_id, date from public.session_log where deleted_at is null
  union select user_id, date from public.weight_log where deleted_at is null
  union select user_id, date from public.sleep_log where deleted_at is null
)
select
  d.user_id,
  d.date,
  coalesce((select sum(w.amount_ml) from public.water_log w
            where w.user_id = d.user_id and w.date = d.date and w.deleted_at is null), 0)::int as water_ml,
  coalesce((select sum(f.kcal) from public.food_log f
            where f.user_id = d.user_id and f.date = d.date and f.deleted_at is null), 0)::int as kcal,
  coalesce((select sum(f.protein_g) from public.food_log f
            where f.user_id = d.user_id and f.date = d.date and f.deleted_at is null), 0)::numeric(6,1) as protein_g,
  (select count(*) from public.coffee_log c
   where c.user_id = d.user_id and c.date = d.date and c.deleted_at is null)::int as coffee_count,
  (select s.completion from public.session_log s
   where s.user_id = d.user_id and s.date = d.date and s.deleted_at is null) as session_completion,
  (select l.score from public.day_log l
   where l.user_id = d.user_id and l.date = d.date and l.deleted_at is null) as score,
  (select wl.weight_kg from public.weight_log wl
   where wl.user_id = d.user_id and wl.date = d.date and wl.deleted_at is null) as weight_kg,
  (select round((extract(epoch from (sl.wake_at - sl.bed_at)) / 3600)::numeric, 1)
   from public.sleep_log sl
   where sl.user_id = d.user_id and sl.date = d.date and sl.deleted_at is null) as sleep_hours
from days d;

-- 7-day trailing average over logged days (calendar window date-6 … date).
create view public.v_weight_trend
with (security_invoker = on) as
select
  user_id,
  date,
  weight_kg,
  round(avg(weight_kg) over (
    partition by user_id
    order by date
    range between interval '6 days' preceding and current row
  ), 2) as avg7
from public.weight_log
where deleted_at is null;

-- Weeks start on Monday (ISO), matching dates.ts weekStart.
create view public.v_weekly_rollup
with (security_invoker = on) as
with weeks as (
  select user_id, date_trunc('week', date)::date as week_start from public.v_daily_summary
  union
  select user_id, date_trunc('week', date)::date from public.expense where deleted_at is null
)
select
  w.user_id,
  w.week_start,
  (select round(avg(l.score))::int from public.day_log l
   where l.user_id = w.user_id and l.deleted_at is null
     and l.date between w.week_start and w.week_start + 6) as avg_score,
  (select count(*)::int from public.day_log l
   where l.user_id = w.user_id and l.deleted_at is null and l.is_streak_day
     and l.date between w.week_start and w.week_start + 6) as streak_days,
  (select count(*)::int from public.session_log s
   where s.user_id = w.user_id and s.deleted_at is null and s.completion >= 80
     and s.date between w.week_start and w.week_start + 6) as sessions,
  (select round(avg(ds.protein_g), 1) from public.v_daily_summary ds
   where ds.user_id = w.user_id and ds.kcal > 0
     and ds.date between w.week_start and w.week_start + 6) as avg_protein,
  (select round(avg(ds.kcal))::int from public.v_daily_summary ds
   where ds.user_id = w.user_id and ds.kcal > 0
     and ds.date between w.week_start and w.week_start + 6) as avg_kcal,
  (select t.avg7 from public.v_weight_trend t
   where t.user_id = w.user_id and t.date <= w.week_start + 6 and t.date >= w.week_start
   order by t.date desc limit 1)
  -
  (select t.avg7 from public.v_weight_trend t
   where t.user_id = w.user_id and t.date < w.week_start
   order by t.date desc limit 1) as weight_change,
  (select round(avg(ds.sleep_hours), 1) from public.v_daily_summary ds
   where ds.user_id = w.user_id and ds.sleep_hours is not null
     and ds.date between w.week_start and w.week_start + 6) as avg_sleep_hours,
  coalesce((select sum(e.amount_inr) from public.expense e
            where e.user_id = w.user_id and e.deleted_at is null and e.direction = 'debit'
              and e.date between w.week_start and w.week_start + 6), 0)::numeric(12,2) as spend_inr
from weeks w;
