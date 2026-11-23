-- LifeOS · F01 · seed_defaults() — PRD §6 seed data for the signed-in user.
--
-- Called by the app after every sign-in. Idempotent: each section is created only
-- when the user has no rows of that section yet (soft-deleted rows count, so a
-- template PTR deleted is never resurrected). Runs as the caller (security
-- invoker), so RLS still applies and rows are owned by auth.uid().
-- Returns which sections were created, e.g. {"profile": true, "routine": false, …}.

create or replace function public.seed_defaults()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '{}'::jsonb;
  v_today date;
  v_template uuid;
  v_plan uuid;
  v_meal uuid;
  v_dish uuid;
  v_program uuid;
  v_day uuid;
  rec record;
  ex_ids jsonb := '{}'::jsonb;
  day_ids jsonb := '{}'::jsonb;
begin
  if uid is null then
    raise exception 'seed_defaults: not signed in' using errcode = '42501';
  end if;

  -- Serialise concurrent calls for the same user (two devices signing in at once).
  perform pg_advisory_xact_lock(hashtextextended('seed_defaults:' || uid::text, 0));

  -- Logical day in IST (day starts at 03:00, PRD §4.1).
  v_today := ((now() at time zone 'Asia/Kolkata') - interval '3 hours')::date;

  -- 6.1 Profile ---------------------------------------------------------------
  if not exists (select 1 from profile where user_id = uid) then
    insert into profile (height_cm, start_weight_kg, goal_weight_kg)
    values (170, 91.0, 75.0);
    result := result || '{"profile": true}';
  else
    result := result || '{"profile": false}';
  end if;

  -- 6.2 Routine templates -----------------------------------------------------
  if not exists (select 1 from routine_template where user_id = uid) then
    for rec in
      select * from (values
        ('Workday',  array[1, 2, 3, 4, 5], true,  0),
        ('Weekend',  array[6, 7],          false, 1),
        ('Rest day', array[]::int[],       false, 2)
      ) as t(name, weekdays, is_default, sort)
    loop
      insert into routine_template (name, weekdays, is_default, sort)
      values (rec.name, rec.weekdays, rec.is_default, rec.sort)
      returning id into v_template;

      insert into routine_block
        (template_id, title, kind, start_time, duration_min, ref_slot, auto_complete, is_optional, notify, sort)
      select v_template, b.title, b.kind, b.start_time::time, b.duration_min, b.ref_slot,
             b.auto_complete, b.is_optional, b.notify, b.sort
      from (values
        ('Wake up',            'wake',      '05:00', 10, null,        false, false, true,  0),
        ('Drink 500 ml water', 'water',     '05:10', 30, null,        true,  false, true,  1),
        ('Workout',            'workout',   '05:30', 60, null,        true,  false, true,  2),
        ('Breakfast',          'meal',      '07:00', 30, 'breakfast', true,  false, true,  3),
        ('Pack lunch box',     'custom',    '07:30', 15, null,        false, false, true,  4),
        ('Lunch',              'meal',      '13:00', 30, 'lunch',     true,  false, true,  5),
        ('Snack',              'meal',      '16:30', 15, 'snack',     true,  false, true,  6),
        ('Evening walk',       'custom',    '18:30', 30, null,        false, true,  false, 7),
        ('Dinner',             'meal',      '20:00', 30, 'dinner',    true,  false, true,  8),
        ('Water target hit',   'water',     '21:00', 30, null,        true,  false, true,  9),
        ('Phone away',         'phone_off', '21:30', 30, null,        false, false, true,  10),
        ('Lights out',         'sleep',     '22:00', 15, null,        false, false, true,  11)
      ) as b(title, kind, start_time, duration_min, ref_slot, auto_complete, is_optional, notify, sort)
      where not (rec.name = 'Weekend' and b.title = 'Pack lunch box')
        and not (rec.name = 'Rest day' and b.kind = 'workout');
    end loop;
    result := result || '{"routine": true}';
  else
    result := result || '{"routine": false}';
  end if;

  -- 6.3 Meal plan "Fixed Day v1" ---------------------------------------------
  if not exists (select 1 from meal_plan where user_id = uid) then
    insert into meal_plan (name, is_active) values ('Fixed Day v1', true) returning id into v_plan;

    insert into meal (plan_id, slot, time, sort) values
      (v_plan, 'breakfast', '07:00', 0),
      (v_plan, 'lunch',     '13:00', 1),
      (v_plan, 'snack',     '16:30', 2),
      (v_plan, 'dinner',    '20:00', 3);

    for rec in
      select * from (values
        -- slot, swap_group, name, serving, kcal, protein, carbs, fat, buy, is_default, sort
        ('breakfast', 'base',    'Idli',                  '4 pcs',             240,  8, 50,  1, 'daily',  true,  0),
        ('breakfast', 'base',    'Dosa',                  '3 pcs',             330,  8, 54,  9, 'daily',  false, 1),
        ('breakfast', 'base',    'Pesarattu',             '2 pcs',             300, 16, 40,  8, 'weekly', false, 2),
        ('breakfast', 'base',    'Ragi dosa',             '3 pcs',             270,  7, 50,  5, 'weekly', false, 3),
        ('breakfast', 'side',    'Sambar',                '1 cup',             150,  7, 20,  4, 'weekly', true,  4),
        ('breakfast', 'protein', 'Boiled eggs + whites',  '3 whole + 2 whites',244, 25,  1, 15, 'weekly', true,  5),
        ('breakfast', 'protein', 'Egg podimas',           '3 whole + 2 whites',280, 25,  3, 19, 'weekly', false, 6),
        ('lunch',     'base',    'Ponni rice',            '1 cup cooked',      210,  4, 46,  1, 'pantry', true,  0),
        ('lunch',     'protein', 'Chicken curry',         '200 g raw breast',  300, 46,  4, 10, 'daily',  true,  1),
        ('lunch',     'protein', 'Fish curry',            '200 g raw',         260, 40,  4,  9, 'daily',  false, 2),
        ('lunch',     'protein', 'Egg curry',             '4 eggs',            340, 25,  6, 24, 'weekly', false, 3),
        ('lunch',     'veg',     'Vegetable poriyal',     '1 cup',             100,  3, 10,  5, 'weekly', true,  4),
        ('lunch',     'veg',     'Kootu',                 '1 cup',             150,  7, 18,  5, 'weekly', false, 5),
        ('lunch',     'dairy',   'Curd',                  '150 g',              90,  5,  7,  5, 'daily',  true,  6),
        ('snack',     'legume',  'Moong sprouts sundal',  '1 cup',             150, 12, 22,  2, 'weekly', true,  0),
        ('snack',     'legume',  'Channa sundal',         '1 cup',             210, 11, 35,  3, 'weekly', false, 1),
        ('snack',     'fruit',   'Banana',                '1',                 100,  1, 26,  0, 'daily',  true,  2),
        ('snack',     'fruit',   'Guava',                 '1',                  70,  3, 14,  1, 'weekly', false, 3),
        ('snack',     'nuts',    'Peanuts',               '20 g',              115,  5,  3, 10, 'pantry', true,  4),
        ('snack',     'nuts',    'Almonds',               '20 g',              115,  4,  4, 10, 'pantry', false, 5),
        ('snack',     'drink',   'Buttermilk',            '1 glass',            40,  3,  4,  1, 'daily',  true,  6),
        ('dinner',    'base',    'Chapati',               '2',                 240,  7, 40,  6, 'pantry', true,  0),
        ('dinner',    'base',    'Dosa',                  '2 pcs',             220,  5, 36,  6, 'daily',  false, 1),
        ('dinner',    'protein', 'Fish curry (small)',    '150 g raw',         200, 30,  4,  7, 'daily',  true,  2),
        ('dinner',    'protein', 'Paneer curry',          '100 g paneer',      290, 18,  5, 22, 'daily',  false, 3),
        ('dinner',    'protein', 'Egg curry',             '3 eggs',            255, 19,  5, 18, 'weekly', false, 4),
        ('dinner',    'veg',     'Cucumber-onion salad',  '1 bowl',             40,  1,  8,  0, 'daily',  true,  5)
      ) as d(slot, swap_group, name, serving, kcal, protein, carbs, fat, buy, is_default, sort)
    loop
      insert into dish (name, serving_text, kcal, protein_g, carbs_g, fat_g, buy)
      values (rec.name, rec.serving, rec.kcal, rec.protein, rec.carbs, rec.fat, rec.buy)
      returning id into v_dish;

      select id into v_meal from meal where plan_id = v_plan and slot = rec.slot;

      insert into meal_item (meal_id, dish_id, swap_group, is_default, sort)
      values (v_meal, v_dish, rec.swap_group, rec.is_default, rec.sort);
    end loop;
    result := result || '{"meal_plan": true}';
  else
    result := result || '{"meal_plan": false}';
  end if;

  -- 6.4 Workout program "Dumbbell Beginner 5-Day" ------------------------------
  if not exists (select 1 from workout_program where user_id = uid) then
    -- First Monday on/after today; F03 resets it on onboarding.
    insert into workout_program (name, is_active, start_date)
    values ('Dumbbell Beginner 5-Day', true,
            v_today + ((8 - extract(isodow from v_today)::int) % 7))
    returning id into v_program;

    for rec in
      select * from (values
        (1, 'Upper A',           'strength', null::int),
        (2, 'Lower A',           'strength', null),
        (3, 'Walk',              'walk',     null),
        (4, 'Upper B',           'strength', null),
        (5, 'Lower B',           'strength', null),
        (6, 'Full Body Circuit', 'circuit',  4),
        (7, 'Rest',              'rest',     null)
      ) as d(weekday, title, kind, rounds)
    loop
      insert into workout_day (program_id, weekday, title, kind, rounds)
      values (v_program, rec.weekday, rec.title, rec.kind, rec.rounds)
      returning id into v_day;
      day_ids := day_ids || jsonb_build_object(rec.weekday::text, v_day);
    end loop;

    for rec in
      select * from (values
        ('DB bench press',                'chest',      'dumbbells + bench', false, 'Elbows about 45°, lower to chest level, press up.'),
        ('One-arm DB row',                'back',       'dumbbell + bench',  true,  'Pull the elbow to your hip, back flat.'),
        ('Seated DB shoulder press',      'shoulders',  'dumbbells + bench', false, 'Brace your core, press overhead without arching.'),
        ('DB curl',                       'biceps',     'dumbbells',         false, 'Elbows pinned, no swinging.'),
        ('Overhead DB triceps extension', 'triceps',    'dumbbell',          false, 'Elbows point up, lower behind your head.'),
        ('Goblet squat',                  'legs',       'dumbbell',          false, 'Chest up, sit down between your heels.'),
        ('DB Romanian deadlift',          'hamstrings', 'dumbbells',         false, 'Hinge at the hips, soft knees, flat back.'),
        ('Reverse lunge',                 'legs',       'dumbbells',         true,  'Step back, front knee over mid-foot.'),
        ('Standing calf raise',           'calves',     'dumbbells',         false, 'Full stretch at the bottom, pause at the top.'),
        ('Plank',                         'core',       'bodyweight',        false, 'Straight line head to heels, squeeze glutes.'),
        ('Brisk walk',                    'cardio',     'none',              false, 'A pace where talking takes effort.'),
        ('Incline DB press',              'chest',      'dumbbells + bench', false, 'No incline? Flat bench, close grip.'),
        ('Chest-supported DB row',        'back',       'dumbbells + bench', false, 'Chest on the bench, squeeze shoulder blades.'),
        ('Lateral raise',                 'shoulders',  'dumbbells',         false, 'Lead with the elbows, stop at shoulder height.'),
        ('Push-up',                       'chest',      'bodyweight',        false, 'Body straight, chest to fist height.'),
        ('Hammer curl',                   'biceps',     'dumbbells',         false, 'Neutral grip, elbows still.'),
        ('DB skull crusher',              'triceps',    'dumbbells + bench', false, 'Lower to the forehead, elbows in.'),
        ('Bulgarian split squat',         'legs',       'dumbbells + bench', true,  'Rear foot on the bench, drop straight down.'),
        ('DB hip thrust',                 'glutes',     'dumbbell + bench',  false, 'Upper back on the bench, drive hips up, pause.'),
        ('Step-up on bench',              'legs',       'dumbbells + bench', true,  'Push through the top foot, control the way down.'),
        ('Single-leg RDL',                'hamstrings', 'dumbbell',          true,  'Hips square, reach back with the free leg.'),
        ('Dead bug',                      'core',       'bodyweight',        false, 'Lower back pressed down, slow reach.'),
        ('DB thruster',                   'full body',  'dumbbells',         false, 'Squat, then press overhead in one motion.'),
        ('Renegade row',                  'back',       'dumbbells',         true,  'Hips still, row one side at a time.'),
        ('Walking lunge',                 'legs',       'dumbbells',         false, 'Long steps, torso upright.')
      ) as e(name, muscle, equipment, unilateral, cue)
    loop
      insert into exercise (name, muscle, equipment, unilateral, cue)
      values (rec.name, rec.muscle, rec.equipment, rec.unilateral, rec.cue)
      returning id into v_dish;
      ex_ids := ex_ids || jsonb_build_object(rec.name, v_dish);
    end loop;

    -- Circuit: sets = rounds; rest 0 between stations, 60 s after the last one.
    for rec in
      select * from (values
        (1, 'DB bench press',                4,    8,    12, null::int, 90, 0),
        (1, 'One-arm DB row',                4,    8,    12, null,      75, 1),
        (1, 'Seated DB shoulder press',      3,    8,    12, null,      75, 2),
        (1, 'DB curl',                       3,   10,    15, null,      60, 3),
        (1, 'Overhead DB triceps extension', 3,   10,    15, null,      60, 4),
        (2, 'Goblet squat',                  4,   10,    15, null,      90, 0),
        (2, 'DB Romanian deadlift',          4,    8,    12, null,      90, 1),
        (2, 'Reverse lunge',                 3,   10,    10, null,      75, 2),
        (2, 'Standing calf raise',           3,   15,    20, null,      45, 3),
        (2, 'Plank',                         3,   30,    45, 45,        45, 4),
        (3, 'Brisk walk',                    1, null::int, null::int, 1800, 0, 0),
        (4, 'Incline DB press',              4,    8,    12, null,      90, 0),
        (4, 'Chest-supported DB row',        4,   10,    12, null,      75, 1),
        (4, 'Lateral raise',                 3,   12,    15, null,      45, 2),
        (4, 'Push-up',                       3, null,  null, null,      60, 3),
        (4, 'Hammer curl',                   3,   10,    12, null,      60, 4),
        (4, 'DB skull crusher',              3,   10,    12, null,      60, 5),
        (5, 'Bulgarian split squat',         3,    8,    12, null,      90, 0),
        (5, 'DB hip thrust',                 4,   10,    15, null,      75, 1),
        (5, 'Step-up on bench',              3,   10,    10, null,      60, 2),
        (5, 'Single-leg RDL',                3,   10,    10, null,      60, 3),
        (5, 'Dead bug',                      3,   10,    10, null,      45, 4),
        (6, 'DB thruster',                   4,   10,    10, null,       0, 0),
        (6, 'Renegade row',                  4,    8,     8, null,       0, 1),
        (6, 'Walking lunge',                 4,   12,    12, null,       0, 2),
        (6, 'Push-up',                       4,   10,    10, null,      60, 3)
      ) as w(weekday, exercise, sets, rep_min, rep_max, duration_sec, rest_sec, sort)
    loop
      insert into workout_exercise
        (workout_day_id, exercise_id, sets, rep_min, rep_max, duration_sec, rest_sec, sort)
      values ((day_ids ->> rec.weekday::text)::uuid, (ex_ids ->> rec.exercise)::uuid,
              rec.sets, rec.rep_min, rec.rep_max, rec.duration_sec, rec.rest_sec, rec.sort);
    end loop;
    result := result || '{"workout_program": true}';
  else
    result := result || '{"workout_program": false}';
  end if;

  -- Expense categories (DESIGN_NOTES A14; budgets per PRD F18) ----------------
  if not exists (select 1 from expense_category where user_id = uid) then
    insert into expense_category (name, icon, monthly_budget_inr, sort) values
      ('Food & groceries', 'shopping-basket', 6000, 0),
      ('Bills',            'receipt',         1500, 1),
      ('Transport',        'bus',              800, 2),
      ('Health',           'heart-pulse',     2000, 3),
      ('Shopping',         'shopping-bag',    1500, 4),
      ('Other',            'ellipsis',        1000, 5),
      ('Income',           'wallet',          null, 6);
    result := result || '{"expense_categories": true}';
  else
    result := result || '{"expense_categories": false}';
  end if;

  return result;
end;
$$;

revoke all on function public.seed_defaults() from public, anon;
grant execute on function public.seed_defaults() to authenticated;
