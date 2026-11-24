-- F01 AC3: seed_defaults() run twice creates no duplicates, and the seed matches PRD §6.
-- Rolled back at the end; safe to run against the real project.

begin;

insert into auth.users (id, email) values ('00000000-0000-4000-a000-0000000000c1', 'seed@lifeos.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}', true);

do $$
declare
  first jsonb;
  second jsonb;
  counts_before jsonb;
  counts_after jsonb;
  n int;
  kcal int;
  protein numeric;
  p record;
begin
  first := public.seed_defaults();
  if first <> '{"profile": true, "routine": true, "meal_plan": true, "workout_program": true, "expense_categories": true}'::jsonb then
    raise exception 'first seed should create every section, got %', first;
  end if;

  select jsonb_build_object(
    'profile', (select count(*) from public.profile),
    'routine_template', (select count(*) from public.routine_template),
    'routine_block', (select count(*) from public.routine_block),
    'meal_plan', (select count(*) from public.meal_plan),
    'meal', (select count(*) from public.meal),
    'dish', (select count(*) from public.dish),
    'meal_item', (select count(*) from public.meal_item),
    'workout_program', (select count(*) from public.workout_program),
    'workout_day', (select count(*) from public.workout_day),
    'exercise', (select count(*) from public.exercise),
    'workout_exercise', (select count(*) from public.workout_exercise),
    'expense_category', (select count(*) from public.expense_category)
  ) into counts_before;

  second := public.seed_defaults();
  if second <> '{"profile": false, "routine": false, "meal_plan": false, "workout_program": false, "expense_categories": false}'::jsonb then
    raise exception 'second seed should create nothing, got %', second;
  end if;

  select jsonb_build_object(
    'profile', (select count(*) from public.profile),
    'routine_template', (select count(*) from public.routine_template),
    'routine_block', (select count(*) from public.routine_block),
    'meal_plan', (select count(*) from public.meal_plan),
    'meal', (select count(*) from public.meal),
    'dish', (select count(*) from public.dish),
    'meal_item', (select count(*) from public.meal_item),
    'workout_program', (select count(*) from public.workout_program),
    'workout_day', (select count(*) from public.workout_day),
    'exercise', (select count(*) from public.exercise),
    'workout_exercise', (select count(*) from public.workout_exercise),
    'expense_category', (select count(*) from public.expense_category)
  ) into counts_after;

  if counts_before <> counts_after then
    raise exception 'seed_defaults twice changed row counts: % -> %', counts_before, counts_after;
  end if;

  if counts_after <> '{"profile": 1, "routine_template": 3, "routine_block": 34, "meal_plan": 1, "meal": 4,
      "dish": 27, "meal_item": 27, "workout_program": 1, "workout_day": 7, "exercise": 25,
      "workout_exercise": 26, "expense_category": 7}'::jsonb then
    raise exception 'unexpected seed counts: %', counts_after;
  end if;

  -- 6.1 profile defaults
  select * into p from public.profile;
  if p.height_cm is not null or p.start_weight_kg is not null or p.goal_weight_kg is not null -- F25: asked at setup
     or p.water_target_ml <> 3000 or p.kcal_target <> 2200 or p.protein_target_g <> 150
     or p.wake_time <> '05:00' or p.sleep_time <> '22:00' or p.phone_off_time <> '21:30'
     or p.coffee_limit <> 2 or p.sex <> 'male' or p.birth_year <> 1997 or p.theme <> 'dark'
     or p.onboarded_at is not null then
    raise exception 'profile defaults wrong: %', row_to_json(p);
  end if;

  -- 6.2 Workday has 11 counted blocks (Evening walk is optional and silent)
  select count(*) into n
  from public.routine_block b join public.routine_template t on t.id = b.template_id
  where t.name = 'Workday' and not b.is_optional;
  if n <> 11 then raise exception 'Workday should have 11 counted blocks, has %', n; end if;

  if not exists (select 1 from public.routine_block where title = 'Evening walk' and is_optional and not notify) then
    raise exception 'Evening walk must be optional with notify off';
  end if;
  if exists (select 1 from public.routine_block b join public.routine_template t on t.id = b.template_id
             where t.name = 'Weekend' and b.title = 'Pack lunch box') then
    raise exception 'Weekend must not have Pack lunch box';
  end if;
  if exists (select 1 from public.routine_block b join public.routine_template t on t.id = b.template_id
             where t.name = 'Rest day' and b.kind = 'workout') then
    raise exception 'Rest day must not have a workout block';
  end if;

  -- 6.3 default day ≈ 2,220 kcal / 157 g protein (coffee excluded), one default per swap group
  select sum(d.kcal), sum(d.protein_g) into kcal, protein
  from public.meal_item mi join public.dish d on d.id = mi.dish_id
  where mi.is_default;
  if kcal <> 2219 or protein <> 157 then
    raise exception 'default plan should be 2219 kcal / 157 g protein, is % / %', kcal, protein;
  end if;

  if exists (select meal_id, swap_group from public.meal_item group by 1, 2
             having count(*) filter (where is_default) <> 1) then
    raise exception 'every swap group needs exactly one default dish';
  end if;

  -- 6.4 program: Monday start, Sunday rest, circuit 4 rounds, no barbell/cable/machine
  if extract(isodow from (select start_date from public.workout_program)) <> 1 then
    raise exception 'program must start on a Monday';
  end if;
  if (select kind from public.workout_day where weekday = 7) <> 'rest'
     or (select rounds from public.workout_day where weekday = 6) <> 4 then
    raise exception 'workout days wrong';
  end if;
  if exists (select 1 from public.exercise where equipment ~* '(barbell|cable|machine|pull-up)') then
    raise exception 'seed must not need a barbell, cable, machine or pull-up bar';
  end if;

  raise notice 'seed.sql: all checks passed (%)', counts_after;
end $$;

reset role;
rollback;
