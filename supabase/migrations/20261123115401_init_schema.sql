-- LifeOS · F01 · core schema (PRD §5)
--
-- Every table gets the same base columns:
--   id, user_id (owner, defaults to the signed-in user), client_id (idempotent
--   offline upserts from the sync queue, F02), created_at, updated_at (trigger),
--   deleted_at (soft delete).
-- PRD §5 asks for client_id/deleted_at on log tables; LifeOS also edits plans
-- offline (routine editor, meal plan, program), so every user table gets them
-- (DECISIONS.md, F01). client_id defaults to a random uuid so server-side
-- inserts (seed_defaults, Edge Functions) need not supply one.
--
-- Row Level Security on every table: a user sees and writes only their own rows.
-- References from logs to plan rows are plain uuids (no FK) so that editing or
-- deleting a plan never rewrites past logs (PRD §1.3).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Adds the shared columns, trigger, RLS policy and (user_id[, date]) index.
-- Used only inside this migration; execute is revoked at the end.
create or replace function public._lifeos_prepare_table(t text, has_date boolean)
returns void
language plpgsql
as $$
begin
  execute format($f$
    alter table public.%1$I
      add column user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
      add column client_id uuid not null default gen_random_uuid(),
      add column created_at timestamptz not null default now(),
      add column updated_at timestamptz not null default now(),
      add column deleted_at timestamptz,
      add constraint %1$s_client_id_key unique (client_id)
  $f$, t);

  execute format(
    'create trigger %1$s_set_updated_at before update on public.%1$I
       for each row execute function public.set_updated_at()', t);

  execute format('alter table public.%I enable row level security', t);
  execute format($f$
    create policy "own rows" on public.%1$I
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()))
  $f$, t);

  if has_date then
    execute format('create index %1$s_user_date_idx on public.%1$I (user_id, date)', t);
  else
    execute format('create index %1$s_user_idx on public.%1$I (user_id)', t);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5.1 Profile and routine
-- ---------------------------------------------------------------------------

create table public.profile (
  id uuid primary key default gen_random_uuid(),
  height_cm int check (height_cm between 100 and 250),
  start_weight_kg numeric(4,1) check (start_weight_kg > 0),
  goal_weight_kg numeric(4,1) check (goal_weight_kg > 0),
  water_target_ml int not null default 3000 check (water_target_ml between 500 and 10000),
  kcal_target int not null default 2200 check (kcal_target between 800 and 6000),
  protein_target_g int not null default 150 check (protein_target_g between 0 and 400),
  wake_time time not null default '05:00',
  sleep_time time not null default '22:00',
  phone_off_time time not null default '21:30',
  sex text not null default 'male' check (sex in ('male', 'female')),
  birth_year int not null default 1997 check (birth_year between 1900 and 2100),
  steps_min int not null default 6000 check (steps_min >= 0),
  activity_factor numeric(3,2) not null default 1.40 check (activity_factor between 1.0 and 2.5),
  monthly_budget_inr int not null default 18000 check (monthly_budget_inr >= 0),
  water_reminder_interval_min int not null default 90 check (water_reminder_interval_min > 0),
  weigh_in_mode text not null default 'daily' check (weigh_in_mode in ('daily', 'weekly')),
  weigh_in_weekday int not null default 1 check (weigh_in_weekday between 1 and 7),
  coffee_limit int not null default 2 check (coffee_limit >= 0),
  theme text not null default 'dark' check (theme in ('system', 'light', 'dark')),
  onboarded_at timestamptz
);
select public._lifeos_prepare_table('profile', false);
alter table public.profile add constraint profile_user_id_key unique (user_id);

create table public.routine_template (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  weekdays int[] not null default '{}' check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]),
  is_default boolean not null default false,
  sort int not null default 0
);
select public._lifeos_prepare_table('routine_template', false);

create table public.routine_block (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.routine_template (id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  kind text not null check (kind in ('wake', 'water', 'workout', 'meal', 'task', 'sleep', 'phone_off', 'custom')),
  start_time time not null,
  duration_min int not null default 0 check (duration_min between 0 and 600),
  ref_slot text check (ref_slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  auto_complete boolean not null default false,
  is_optional boolean not null default false,
  notify boolean not null default true,
  sort int not null default 0,
  constraint routine_block_meal_slot check (kind <> 'meal' or ref_slot is not null)
);
select public._lifeos_prepare_table('routine_block', false);
create index routine_block_template_idx on public.routine_block (template_id);

-- ---------------------------------------------------------------------------
-- 5.2 Daily logs
-- ---------------------------------------------------------------------------

create table public.day_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  template_id uuid,
  score int check (score between 0 and 100),
  is_streak_day boolean,
  note text
);
select public._lifeos_prepare_table('day_log', true);
alter table public.day_log add constraint day_log_user_date_key unique (user_id, date);

create table public.block_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  block_id uuid not null,
  status text not null check (status in ('done', 'skipped')),
  skip_reason text check (skip_reason in ('sick', 'travel', 'rest', 'other')),
  done_at timestamptz,
  constraint block_log_reason_only_when_skipped check (status = 'skipped' or skip_reason is null)
);
select public._lifeos_prepare_table('block_log', true);
alter table public.block_log add constraint block_log_user_date_block_key unique (user_id, date, block_id);

create table public.water_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount_ml int not null check (amount_ml between 1 and 2000),
  logged_at timestamptz not null default now()
);
select public._lifeos_prepare_table('water_log', true);

-- ---------------------------------------------------------------------------
-- 5.3 Food
-- ---------------------------------------------------------------------------

create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  is_active boolean not null default false
);
select public._lifeos_prepare_table('meal_plan', false);

create table public.meal (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plan (id) on delete cascade,
  slot text not null check (slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  time time not null,
  sort int not null default 0
);
select public._lifeos_prepare_table('meal', false);
create index meal_plan_idx on public.meal (plan_id);

create table public.dish (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  serving_text text not null default '',
  kcal int not null check (kcal >= 0),
  protein_g numeric(5,1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(5,1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(5,1) not null default 0 check (fat_g >= 0),
  buy text not null default 'daily' check (buy in ('daily', 'weekly', 'pantry')),
  -- [{item, qty, unit, price_inr?}] — F10
  shopping_items jsonb not null default '[]' check (jsonb_typeof(shopping_items) = 'array')
);
select public._lifeos_prepare_table('dish', false);

create table public.meal_item (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meal (id) on delete cascade,
  dish_id uuid not null references public.dish (id) on delete cascade,
  swap_group text not null,
  is_default boolean not null default false,
  sort int not null default 0
);
select public._lifeos_prepare_table('meal_item', false);
create index meal_item_meal_idx on public.meal_item (meal_id);
create index meal_item_dish_idx on public.meal_item (dish_id);
-- At most one default per swap group (PRD §5.3 "exactly one" — the app keeps at least one).
create unique index meal_item_one_default_per_group
  on public.meal_item (meal_id, swap_group)
  where is_default and deleted_at is null;

create table public.food_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  meal_id uuid,
  dish_id uuid,
  swap_group text,
  free_text text,
  portion numeric(3,2) not null default 1 check (portion in (1, 0.75, 0.5, 0)),
  kcal int not null check (kcal >= 0),
  protein_g numeric(5,1) not null default 0 check (protein_g >= 0),
  is_off_plan boolean not null default false,
  logged_at timestamptz not null default now(),
  constraint food_log_has_item check (dish_id is not null or free_text is not null)
);
select public._lifeos_prepare_table('food_log', true);

create table public.coffee_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  logged_at timestamptz not null default now()
);
select public._lifeos_prepare_table('coffee_log', true);

-- ---------------------------------------------------------------------------
-- 5.4 Training and body
-- ---------------------------------------------------------------------------

create table public.workout_program (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  is_active boolean not null default false,
  start_date date
);
select public._lifeos_prepare_table('workout_program', false);

create table public.workout_day (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.workout_program (id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  title text not null,
  kind text not null check (kind in ('strength', 'circuit', 'rest', 'walk')),
  rounds int check (rounds > 0)
);
select public._lifeos_prepare_table('workout_day', false);
create index workout_day_program_idx on public.workout_day (program_id);
create unique index workout_day_one_per_weekday
  on public.workout_day (program_id, weekday)
  where deleted_at is null;

create table public.exercise (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  muscle text not null default '',
  equipment text not null default 'dumbbell',
  unilateral boolean not null default false,
  cue text not null default '',
  video_url text
);
select public._lifeos_prepare_table('exercise', false);

-- Reps: rep_min/rep_max (both null = "max" / AMRAP). Timed exercises set
-- duration_sec and use rep_min/rep_max as the seconds range (DECISIONS.md, F01).
create table public.workout_exercise (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_day (id) on delete cascade,
  exercise_id uuid not null references public.exercise (id) on delete cascade,
  sets int not null check (sets > 0),
  rep_min int check (rep_min > 0),
  rep_max int check (rep_max > 0),
  duration_sec int check (duration_sec > 0),
  rest_sec int not null default 0 check (rest_sec >= 0),
  sort int not null default 0,
  constraint workout_exercise_rep_range check (rep_min is null or rep_max is null or rep_min <= rep_max)
);
select public._lifeos_prepare_table('workout_exercise', false);
create index workout_exercise_day_idx on public.workout_exercise (workout_day_id);
create index workout_exercise_exercise_idx on public.workout_exercise (exercise_id);

create table public.session_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  workout_day_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  completion int check (completion between 0 and 100)
);
select public._lifeos_prepare_table('session_log', true);
alter table public.session_log add constraint session_log_user_date_key unique (user_id, date);

create table public.set_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  date date not null,
  exercise_id uuid not null,
  set_no int not null check (set_no > 0),
  weight_kg numeric(4,1) check (weight_kg >= 0),
  reps int check (reps >= 0),
  duration_sec int check (duration_sec >= 0),
  rpe int check (rpe between 1 and 10)
);
select public._lifeos_prepare_table('set_log', true);
create index set_log_session_idx on public.set_log (session_id);
create index set_log_exercise_idx on public.set_log (user_id, exercise_id, date);

create table public.weight_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  weight_kg numeric(4,1) not null check (weight_kg between 20 and 300),
  note text
);
select public._lifeos_prepare_table('weight_log', true);
alter table public.weight_log add constraint weight_log_user_date_key unique (user_id, date);

create table public.session_override (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  workout_day_id uuid not null
);
select public._lifeos_prepare_table('session_override', true);
alter table public.session_override add constraint session_override_user_date_key unique (user_id, date);

create table public.sleep_log (
  id uuid primary key default gen_random_uuid(),
  date date not null, -- the logical day the night ends
  bed_at timestamptz,
  wake_at timestamptz,
  phone_off_kept boolean,
  constraint sleep_log_wake_after_bed check (bed_at is null or wake_at is null or wake_at > bed_at)
);
select public._lifeos_prepare_table('sleep_log', true);
alter table public.sleep_log add constraint sleep_log_user_date_key unique (user_id, date);

create table public.steps_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  steps int not null check (steps >= 0),
  source text not null default 'manual'
);
select public._lifeos_prepare_table('steps_log', true);
alter table public.steps_log add constraint steps_log_user_date_key unique (user_id, date);

-- ---------------------------------------------------------------------------
-- 5.5 Tasks, money, review
-- ---------------------------------------------------------------------------

create table public.task (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  is_top3 boolean not null default false,
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  sort int not null default 0
);
select public._lifeos_prepare_table('task', false);

create table public.expense_category (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  icon text not null default 'ellipsis',
  monthly_budget_inr int check (monthly_budget_inr >= 0),
  sort int not null default 0
);
select public._lifeos_prepare_table('expense_category', false);

create table public.expense (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount_inr numeric(10,2) not null check (amount_inr > 0),
  category_id uuid references public.expense_category (id) on delete set null,
  merchant text,
  note text,
  direction text not null default 'debit' check (direction in ('debit', 'credit')),
  payment_method text not null default 'upi' check (payment_method in ('upi', 'cash', 'card', 'netbanking', 'other')),
  is_recurring boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'sms', 'quick')),
  txn_ref text,
  parse_rule text,
  raw_sms text
);
select public._lifeos_prepare_table('expense', true);
create index expense_category_idx on public.expense (category_id);
create unique index expense_user_txn_ref_key on public.expense (user_id, txn_ref) where txn_ref is not null;

create table public.api_token (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  token_hash text not null unique,
  last4 text not null check (length(last4) = 4),
  last_used_at timestamptz,
  revoked_at timestamptz
);
select public._lifeos_prepare_table('api_token', false);

create table public.expense_inbox (
  id uuid primary key default gen_random_uuid(),
  raw_sms text not null,
  received_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text
);
select public._lifeos_prepare_table('expense_inbox', false);

create table public.expense_skipped (
  id uuid primary key default gen_random_uuid(),
  raw_sms text not null,
  received_at timestamptz not null default now(),
  stage text,
  rule text,
  classification text check (classification in ('bill_reminder', 'failed_autopay', 'statement_notice', 'noise', 'otp', 'unmatched')),
  overridden boolean not null default false
);
select public._lifeos_prepare_table('expense_skipped', false);

create table public.weekly_review (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  summary jsonb not null default '{}',
  grade text,
  went_well text,
  change_next_week text
);
select public._lifeos_prepare_table('weekly_review', false);
alter table public.weekly_review add constraint weekly_review_user_week_key unique (user_id, week_start);

create table public.nudge_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (kind in ('missed_day', 'interrupt_11', 'interrupt_15', 'interrupt_19', 'fallback', 'reality_weight', 'reality_audit')),
  shown_at timestamptz not null default now(),
  dismissed_at timestamptz
);
select public._lifeos_prepare_table('nudge_log', true);

-- Kept (not dropped) so the migration has no destructive statements; nobody can call it.
revoke all on function public._lifeos_prepare_table(text, boolean) from public, anon, authenticated;
