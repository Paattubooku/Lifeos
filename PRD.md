# LifeOS — Product Requirements Document

Version 1.2 · 2026-11-23 (reference repos mapped; designs reconciled, see `design/DESIGN_NOTES.md`) · Owner: PTR · Builder: Claude Code

---

## 0. How to use this document (read first, Claude Code)

1. This PRD is the single source of truth. If something here conflicts with code in `reference/`, this PRD wins.
2. Build **one feature at a time**, in the exact order of [Section 12 — Build order](#12-build-order). Each feature has an ID (`F00`…`F25`), a spec, acceptance criteria and required tests.
3. A feature is **done** only when every acceptance criterion passes, `npm run typecheck && npm run lint && npm test` is green, and `PROGRESS.md` is updated.
4. After each feature, **stop**, summarise what was built and how to verify it on the phone, and wait for PTR to say "next".
5. PTR's old apps (GitHub `Paattubooku/*`, cloned into `reference/`, see §2) are **feature references only**. Section 2.2 lists exactly which files to port into which LifeOS feature; §2.3 lists what must not be copied. Never import from `reference/`, never modify it, never copy their architecture wholesale.
6. When a detail is not specified, choose the simplest option that satisfies the acceptance criteria, write the decision in `DECISIONS.md`, and continue. Ask PTR only when a choice is irreversible (schema change on shipped data, paid service, deleting data).

---

## 1. Product overview

**LifeOS** is a personal, single-user mobile app that runs PTR's day from 5:00 am wake to 10:00 pm sleep: routine, water, food, training, body weight, sleep, tasks and money in one place.

It replaces four half-built apps whose features overlap (all three track water and/or meals) and none of which reached daily use.

### 1.1 User

One user: PTR. Frontend developer, desk job, office days with a packed lunch box, India (IST, `Asia/Kolkata`). Goal 91 kg → 75 kg, height 170 cm. Non-vegetarian, South Indian (Tamil Nadu) food, no fridge at home, cooks fresh daily in 20–30 min per meal, no protein powder. Trains at home 5:30–6:30 am with adjustable dumbbells (2–20 kg per hand) and a flat bench, beginner. Target wake 5:00, sleep 10:00 pm. Has a doomscrolling habit and prefers technical constraints over willpower.

### 1.2 Goals (first 12 weeks of use)

| Goal | Metric | Target |
|---|---|---|
| Daily use | Days with a `day_log` row | ≥ 80 of 84 |
| Weight | 7-day average weight | 91 → ~85 kg (≈0.5 kg/week) |
| Routine | Wake ≤ 5:15 and in bed ≤ 10:15 | ≥ 5 days/week |
| Food | Days within ±10% kcal and ≥ 150 g protein | ≥ 6 days/week |
| Training | Sessions completed (≥ 80% sets logged) | 5/week |

### 1.3 Product principles

- **Two taps max** for any daily action from app open.
- **Offline first.** Every action works with no network; sync is invisible.
- **Plans vs logs.** Plans describe what should happen; logs record what did. Editing a plan never rewrites past logs.
- **Honest numbers.** Show averages and trends, not single noisy data points.
- **Few, useful reminders.** At most 10 per day; silent when nothing is due.

### 1.4 Non-goals

Social, public launch, AI coach/chat, food database search, barcode scanning, web version, Apple Watch app, payments.

---

## 2. Reference repos (feature reference only)

PTR's old apps are on GitHub (`github.com/Paattubooku`). Clone them read-only into `reference/` before building:

```bash
mkdir -p reference && cd reference
for r in Tracker My-Tracker OwnTracker Pulse Food-Tracker AutoFit; do gh repo clone Paattubooku/$r -- --depth 1; done
```

`reference/` is git-ignored in LifeOS. Never import from it, never modify it.

### 2.1 What each repo is

| Repo | Stack | What it is | Last push |
|---|---|---|---|
| **My-Tracker** ("HydroFlow") | Vite + React + Supabase | Water tracker with a **pace-aware reminder engine** + **ICICI SMS expense tracker** (inbox queue, 3-stage classifier, Parser Lab). Best-documented repo (`README.md`). | Jul 2026 |
| **OwnTracker** | Vite + React + Supabase + Vercel API | Earlier HydroFlow: same water + expense, with a `api/expenses/webhook.ts` endpoint | Jul 2026 |
| **Tracker** ("Trackr") | Vite + React + Supabase + Vercel API | Dashboard + Water + Expenses + **Todos (priority, due date)** + `api/parse-sms.ts` with a large **merchant → category keyword map** + **Scriptable iPhone widgets** (water, expense, todo) | Jul 2026 |
| **Pulse** | Next.js 16 + Drizzle + Postgres | Water + expenses with **API keys and quick-log endpoints for iPhone Shortcuts/Siri**, categories with icons/colours, payment methods, recurring flag, tags, generic custom trackers, Scriptable widgets | Jul 2026 |
| **Food-Tracker** ("Agon") | Vite + React + Vercel API + Supabase | Meal logging, food database, **AI photo meal scan + nutrition estimate** (Gemini/Groq/OpenRouter/HF cascade), **grocery list**, **rule-based daily insights**, **weight prediction** (linear regression + 7,700 kcal/kg), health score | Mar 2026 |
| **AutoFit** | Vite + React + Vercel API + Supabase | Daily 0–3 score (food plan done, steps ≥ 6,000, workout done), perfect-day streaks, **accountability features**: missed-day recovery, failure interrupt, fallback mode, reality check, weekly grade, calorie-deficit estimate, time-aware step suggestions, Gemini meal/fitness plan generator (BMR/TDEE) | Mar 2026 |

Not on GitHub: the Stitch-designed **daily-challenge-tracker** and the **morning-routine-tracker**. If PTR adds them to `reference/` locally, use them; otherwise this PRD fully specifies their features (Today, routine blocks, streaks, weight log).

Ignore: `Agent`, `YT`, `YT-shorts`, `Mutual-fund-analyzer`, `tunetrek-*`, `Music-streaming-app`.

### 2.2 What to port, file by file

| Port this | From | Into LifeOS | Used by |
|---|---|---|---|
| SMS classifier: reject rules (bill reminder, failed autopay, statement, fee/promo noise), 7 extraction rules (UPI debit/credit, IMPS credit, cardless ATM, credit-card spend, bill auto-debit paid, card autopay confirmation), `DD-MMM-YY` / `DD-MM-YYYY` date normalisation, `stableHash()` synthetic refs, `inferCategory()` | `My-Tracker/src/lib/expenseParser.ts` (+ its 7 sample SMS in `src/components/expenses/ParserLabTab.tsx`) | `src/features/money/lib/smsParser.ts` + `supabase/functions/_shared/smsParser.ts` | F19 |
| Merchant keyword → category map (Food, Transport, Shopping, Entertainment, Bills, Health, Education, Subscriptions) | `Tracker/api/parse-sms.ts` (`CATEGORIES`) | merged into `inferCategory()` | F18, F19 |
| Inbox-queue pattern: raw SMS → `expense_inbox` → classify → `expense` or `expense_skipped`; delete from inbox only after success; failures stay for retry | `My-Tracker/README.md` §7.2, `My-Tracker/src/lib/expenses.ts` | `supabase/functions/ingest-sms` + `src/features/money/` | F19 |
| Pace-aware water reminder (10-step algorithm: disabled → sleeping → goal reached → cooldown → expected = elapsed/waking × goal → gap → urgency low ≤ 200 / medium ≤ 500 / high > 500 → message → suggested amount = gap rounded to 50, clamped 50–500) | `My-Tracker/src/lib/reminderEngine.ts`, `src/lib/timeUtils.ts`, `src/types/index.ts` (`URGENCY_MESSAGES`) | `src/features/water/lib/pace.ts` | F07, F15 |
| Water stats: current streak (today may be incomplete), best streak, 7-day average | `My-Tracker/src/lib/reminderEngine.ts` (`getStats`) | `src/features/water/selectors.ts` | F07 |
| Expense analytics: today / month / income, month-over-month %, 14-day bars, range 7D/30D/90D/month/all, category % with drill-down, day-of-week pattern, top 8 payees | `My-Tracker/src/hooks/useExpenseAnalytics.ts`, `src/components/expenses/*Tab.tsx` | `src/features/money/selectors.ts` | F18 |
| Quick-log API for iPhone Shortcuts / Siri (log water, log expense with one HTTP call, API key auth) | `Pulse/src/app/api/v1/quick/{water,expense}/route.ts`, `Pulse/src/db/schema.ts` (`api_keys`) | `supabase/functions/quick-log` | F19 |
| Payment method, recurring flag on expenses | `Pulse/src/db/schema.ts` | `expense` table | F18 |
| Todo priority (high/medium/low), due date, overdue highlight, sort by priority then due date | `Tracker/src/components/TodoTracker.tsx` | `src/features/tasks/` | F17 |
| Scriptable widgets (water ring, month spend, todos) | `Tracker/scriptable/*.js`, `Pulse/public/scriptable/*.js` | `widgets/scriptable/*.js` reading `widget-summary` | F22 |
| Weight prediction: linear regression over recent weights + calorie-based change (deficit × days ÷ 7,700) | `Food-Tracker/api/prediction.js` | `src/features/body/lib/projection.ts` | F13 |
| Daily food insights: over / approaching kcal goal, protein low, carbs > 55%, fat > 35%, weekly weight trend up/down | `Food-Tracker/api/insights.js` | `src/features/food/lib/insights.ts` (on device, no AI) | F08 |
| Grocery list aggregation | `Food-Tracker/api/grocery.js` | `src/features/food/lib/shopping.ts` | F10 |
| BMR (Mifflin-St Jeor) / TDEE, calorie-deficit card (target deficit 250–500 kcal) | `AutoFit/api/generate-plan.js` (pre-calc block), `src/components/CalorieDeficit.tsx` | `src/features/body/lib/energy.ts` | F13 |
| Missed-day recovery, fallback mode (low-score rescue actions), failure interrupt, reality check, weekly grade | `AutoFit/src/components/{MissedDayRecovery,FallbackMode,FailureInterrupt,RealityCheck,WeeklyScore}.tsx`, `api/trigger-interrupt.js` | `src/features/accountability/` | F24 |
| Time-aware step suggestion (steps remaining ÷ hours left until 22:00), min target 6,000 + stretch +4,000 | `AutoFit/src/components/StepTracker.tsx` | `src/features/steps/` | F21 |

### 2.3 What NOT to copy (known problems in the old repos)

- **Allow-all RLS policies** (`USING (true)`) in My-Tracker/OwnTracker/AutoFit. LifeOS uses per-user RLS (§5).
- **Custom password table** (`AutoFit` `app_users.password_hash`) and service-role key in serverless APIs. LifeOS uses Supabase Auth.
- **AI keys in the browser** (`VITE_GEMINI_API_KEY` in My-Tracker). Any AI call in LifeOS goes through an Edge Function.
- **Shortcut inserting into Supabase with the anon key** (My-Tracker inbox). LifeOS ingests through an Edge Function with a hashed token.
- **UTC dates** (`water_logs.date` in UTC). LifeOS uses IST logical days (§4.1).
- **`.env` committed** (AutoFit tracks `.env` in git). LifeOS ignores `.env*` except `.env.example`.
- Hard-coded meal calories (AutoFit `CalorieDeficit.tsx`) and the 10-minute bodyweight `DEFAULT_WORKOUT`. LifeOS uses its own plan data (§6).
- `$` currency defaults (Tracker). LifeOS is INR only.

---

## 3. Tech stack and architecture

| Layer | Choice |
|---|---|
| App | Expo (latest stable SDK), React Native, TypeScript `strict: true` |
| Navigation | Expo Router (file-based), bottom tabs |
| State | Redux Toolkit; RTK Query for server reads; feature slices for local state |
| Local persistence | `react-native-mmkv` (Redux persist + sync queue) |
| Backend | Supabase: Postgres, Auth, Row Level Security, Edge Functions (F19 only) |
| Notifications | `expo-notifications`, local scheduling only (no push server) |
| Charts | `react-native-gifted-charts` (or `victory-native` if needed; record in DECISIONS.md) |
| Health data | `react-native-health` (iOS) / Health Connect (Android) — F21 only |
| Testing | Jest + React Native Testing Library; Maestro for end-to-end flows |
| Lint/format | ESLint (expo config + typescript-eslint), Prettier |
| Builds | EAS Build (development + preview profiles); EAS Update for OTA |

Target both iOS and Android. PTR's main device decides the default build profile (see Section 14).

### 3.1 Folder structure

```
lifeos/
  app/                          # Expo Router
    _layout.tsx
    (auth)/sign-in.tsx
    onboarding/[step].tsx
    (tabs)/_layout.tsx
    (tabs)/today.tsx
    (tabs)/food.tsx
    (tabs)/train.tsx
    (tabs)/progress.tsx
    (tabs)/more.tsx
    session/[date].tsx          # workout session logger
    meal/[slot].tsx             # meal detail + swaps
    routine/edit.tsx
    settings/*.tsx
  src/
    features/
      profile/ routine/ today/ water/ food/ workout/ body/ sleep/
      notifications/ progress/ tasks/ money/ review/ steps/ accountability/
        components/  hooks/  slice.ts  api.ts  selectors.ts  lib/  __tests__/
    lib/
      supabase.ts   sync.ts   storage.ts   dates.ts   ids.ts   logger.ts
    store/          index.ts  baseApi.ts  persist.ts
    ui/             Button.tsx Card.tsx Ring.tsx ProgressBar.tsx Sheet.tsx
                    Chip.tsx ListRow.tsx Fab.tsx EmptyState.tsx theme.ts
    types/          supabase.ts (generated)  domain.ts
  supabase/
    migrations/     0001_init.sql …
    seed.sql
    functions/_shared/smsParser.ts
    functions/ingest-sms/index.ts
    functions/quick-log/index.ts
    functions/widget-summary/index.ts
  widgets/scriptable/         # F22 option A
  reference/                  # git-ignored clones of old repos (§2)
  e2e/              *.yaml (Maestro)
  PRD.md  CLAUDE.md  PROGRESS.md  DECISIONS.md  LATER.md
```

### 3.2 Data flow

```
UI → dispatch(action) → slice updates instantly (optimistic)
                      → sync queue (MMKV) stores mutation {client_id, table, op, row}
sync worker (on app foreground, on network regain, every 60 s while open)
   → upsert to Supabase by client_id → mark synced / retry with backoff (1s,5s,30s,2m,10m)
RTK Query reads → cache → merged with unsynced local rows by client_id
```

---

## 4. Global rules and definitions

### 4.1 Dates and time

- Time zone: always `Asia/Kolkata`. Store timestamps as `timestamptz`; store calendar days as `date` / `'YYYY-MM-DD'` strings.
- **Logical day:** a day runs 03:00 → 02:59 next calendar day. Anything logged before 03:00 belongs to the previous date (so a late bedtime log at 00:30 belongs to "yesterday").
- All date maths goes through `src/lib/dates.ts` (`logicalDate(ts)`, `todayLogical()`, `addDays`, `weekStart` (Monday)). No raw `new Date().toISOString().slice(0,10)` anywhere — lint rule or code review.

### 4.2 Day score

- **Counted blocks** for a day = the blocks of that day's routine template, minus blocks with `is_optional = true`, minus blocks skipped **with a reason**.
- **Score** = `done ÷ counted`, 0–100%, rounded to an integer. If counted = 0, score = 100. Water and protein are shown beside the ring as sub-stats; they enter the score only through their blocks (meal blocks, Water target block).
- Blocks that auto-complete (see F05) count as done when their condition is met.
- A **streak day** = score ≥ 70%. A **grace-eligible day** = score 50–69%. A **breaking day** = score < 50% (or no `day_log`).

### 4.3 Streak

- Current streak = consecutive days in the current run, counting streak days and grace days used (design: "12-day streak · 1 grace left").
- **Grace:** a grace-eligible day (50–69%) keeps the run alive if no grace was used in the previous 14 days (rolling). Otherwise it breaks the run.
- A breaking day (< 50% or missing) always ends the run.
- Today never breaks a streak until the logical day ends.
- Show: current streak, best streak (with date range), grace status ("1 grace left" / "grace used Sun 20 Dec"), and the 30-day heatmap (< 50, 50–69, 70–79, 80–89, 90+).

### 4.4 Units and formats

kg (1 decimal), ml, kcal (integer), grams protein (integer), INR `₹` with Indian digit grouping (`₹1,23,456`), 12-hour clock in UI (`5:30 am`), 24-hour in storage.

### 4.5 Accessibility and UX

Dark theme default (light available). Minimum touch target 44×44. All interactive elements have `accessibilityLabel`. Haptic feedback on tick/log. Every destructive action has undo (snackbar, 5 s) instead of a confirm dialog.

---

## 5. Data model (Supabase)

All tables: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users default auth.uid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` (trigger). All **log** tables also: `client_id uuid not null unique` (idempotent offline upserts), `deleted_at timestamptz null` (soft delete).

RLS on every table: `using (user_id = auth.uid()) with check (user_id = auth.uid())`.

### 5.1 Profile and routine

| Table | Columns |
|---|---|
| `profile` (one row) | `height_cm int`, `start_weight_kg numeric(4,1)`, `goal_weight_kg numeric(4,1)`, `water_target_ml int default 3000`, `kcal_target int default 2200`, `protein_target_g int default 150`, `wake_time time default '05:00'`, `sleep_time time default '22:00'`, `phone_off_time time default '21:30'`, `sex text check in ('male','female') default 'male'`, `birth_year int default 1997`, `steps_min int default 6000`, `activity_factor numeric(3,2) default 1.40`, `monthly_budget_inr int default 18000`, `water_reminder_interval_min int default 90`, `weigh_in_mode text check in ('daily','weekly') default 'daily'`, `weigh_in_weekday int default 1`, `coffee_limit int default 2`, `theme text default 'dark'`, `onboarded_at timestamptz` |
| `routine_template` | `name text`, `weekdays int[]` (1=Mon…7=Sun), `is_default bool`, `sort int` |
| `routine_block` | `template_id uuid fk`, `title text`, `kind text check in ('wake','water','workout','meal','task','sleep','phone_off','custom')`, `start_time time`, `duration_min int`, `ref_slot text null` (meal slot), `auto_complete bool default false`, `is_optional bool default false`, `notify bool default true`, `sort int` |

### 5.2 Daily logs

| Table | Columns |
|---|---|
| `day_log` | `date date`, `template_id uuid`, `score int`, `is_streak_day bool`, `note text`; unique `(user_id, date)` |
| `block_log` | `date date`, `block_id uuid`, `status text check in ('done','skipped')`, `skip_reason text check in ('sick','travel','rest','other') null`, `done_at timestamptz`; unique `(user_id, date, block_id)` |
| `water_log` | `date date`, `amount_ml int check (amount_ml between 1 and 2000)`, `logged_at timestamptz` |

### 5.3 Food

| Table | Columns |
|---|---|
| `meal_plan` | `name text`, `is_active bool` |
| `meal` | `plan_id fk`, `slot text check in ('breakfast','lunch','snack','dinner')`, `time time`, `sort int` |
| `dish` | `name text`, `serving_text text`, `kcal int`, `protein_g numeric(5,1)`, `carbs_g numeric(5,1)`, `fat_g numeric(5,1)`, `buy text check in ('daily','weekly','pantry')`, `shopping_items jsonb` (`[{item, qty, unit, price_inr?}]`) |
| `meal_item` | `meal_id fk`, `dish_id fk`, `swap_group text`, `is_default bool`, `sort int` — items in the same meal with the same `swap_group` are alternatives; exactly one `is_default` per group |
| `food_log` | `date date`, `meal_id uuid null`, `dish_id uuid null`, `swap_group text null`, `free_text text null`, `portion numeric(3,2) default 1` (1, 0.75, 0.5, 0), `kcal int`, `protein_g numeric(5,1)` (already × portion), `is_off_plan bool`, `logged_at timestamptz` |
| `coffee_log` | `date date`, `logged_at timestamptz` |

### 5.4 Training and body

| Table | Columns |
|---|---|
| `workout_program` | `name text`, `is_active bool`, `start_date date` |
| `workout_day` | `program_id fk`, `weekday int`, `title text`, `kind text check in ('strength','circuit','rest','walk')`, `rounds int null` |
| `exercise` | `name text`, `muscle text`, `equipment text`, `unilateral bool`, `cue text`, `video_url text null` |
| `workout_exercise` | `workout_day_id fk`, `exercise_id fk`, `sets int`, `rep_min int`, `rep_max int`, `duration_sec int null`, `rest_sec int`, `sort int` |
| `session_log` | `date date`, `workout_day_id uuid`, `started_at`, `finished_at`, `completion int` (0–100); unique `(user_id, date)` |
| `set_log` | `session_id uuid`, `date date`, `exercise_id uuid`, `set_no int`, `weight_kg numeric(4,1)`, `reps int null`, `duration_sec int null`, `rpe int null` |
| `weight_log` | `date date`, `weight_kg numeric(4,1)`, `note text null` (e.g. `salty`); unique `(user_id, date)` |
| `session_override` | `date date`, `workout_day_id uuid` — "Move to tomorrow" (F05/F11); unique `(user_id, date)` |
| `sleep_log` | `date date` (the logical day the night ends), `bed_at timestamptz`, `wake_at timestamptz`, `phone_off_kept bool null`; unique `(user_id, date)` |
| `steps_log` (F21) | `date date`, `steps int`, `source text`; unique `(user_id, date)` |

### 5.5 Tasks, money, review

| Table | Columns |
|---|---|
| `task` | `title text`, `priority text check in ('high','medium','low') default 'medium'`, `due_date date null`, `is_top3 bool`, `status text check in ('open','done')`, `done_at`, `sort int` |
| `expense_category` | `name text`, `icon text`, `monthly_budget_inr int null`, `sort int` |
| `expense` | `date date`, `amount_inr numeric(10,2)`, `category_id fk null`, `merchant text`, `note text`, `direction text check in ('debit','credit') default 'debit'`, `payment_method text check in ('upi','cash','card','netbanking','other') default 'upi'`, `is_recurring bool default false`, `source text check in ('manual','sms','quick')`, `txn_ref text null` (UPI/IMPS/Txn ID or `stableHash`), `parse_rule text null`, `raw_sms text null`; unique `(user_id, txn_ref)` where `txn_ref is not null` |
| `api_token` | `name text`, `token_hash text unique`, `last4 text`, `last_used_at`, `revoked_at` — F19, F22 |
| `expense_inbox` | `raw_sms text`, `received_at timestamptz`, `attempts int default 0`, `last_error text` — F19 queue |
| `expense_skipped` | `raw_sms text`, `received_at`, `stage text`, `rule text`, `classification text` (bill_reminder, failed_autopay, statement_notice, noise, unmatched), `overridden bool default false` — F19 |
| `weekly_review` | `week_start date`, `summary jsonb`, `grade text`, `went_well text`, `change_next_week text`; unique `(user_id, week_start)` |
| `nudge_log` | `date date`, `kind text` (missed_day, interrupt_11, interrupt_15, interrupt_19, fallback, reality_weight, reality_audit), `shown_at`, `dismissed_at` — F24 |

### 5.6 Views

- `v_daily_summary(date, water_ml, kcal, protein_g, coffee_count, session_completion, score, weight_kg, sleep_hours)`
- `v_weight_trend(date, weight_kg, avg7)` — 7-day trailing average over logged days.
- `v_weekly_rollup(week_start, avg_score, streak_days, sessions, avg_protein, avg_kcal, weight_change, avg_sleep_hours, spend_inr)`

Generate types with `supabase gen types typescript` into `src/types/supabase.ts` after every migration.

---

## 6. Seed data (`supabase/seed.sql`)

All nutrition values are **approximate** and editable in-app (F08). PTR will correct them after weighing portions in week 1.

### 6.1 Profile defaults

sex male, birth year 1997, height 170, start 91.0, goal 75.0, water 3000, kcal 2200, protein 150, wake 05:00, sleep 22:00, phone off 21:30, coffee limit 2.

### 6.2 Routine templates

**Workday** (Mon–Fri) and **Weekend** (Sat–Sun) share this default; Weekend drops "Pack lunch". **Rest day** template has no workout block.

| Time | Block | kind | auto_complete |
|---|---|---|---|
| 05:00 | Wake up | wake | no |
| 05:10 | Drink 500 ml water | water | yes (≥ 500 ml logged before 05:40) |
| 05:30 | Workout (60 min) | workout | yes (session completion ≥ 80%) |
| 07:00 | Breakfast | meal (breakfast) | yes (meal logged) |
| 07:30 | Pack lunch box | custom | no |
| 13:00 | Lunch | meal (lunch) | yes |
| 16:30 | Snack | meal (snack) | yes |
| 18:30 | Evening walk (optional, 30 min, `is_optional`) | custom | no |
| 20:00 | Dinner | meal (dinner) | yes |
| 21:00 | Water target hit | water | yes (≥ water target) |
| 21:30 | Phone away | phone_off | no |
| 22:00 | Lights out | sleep | no |

"Evening walk" is seeded with `notify=false` and `is_optional=true`, so a Workday has **11 counted blocks** (design: "1 of 11 done").

### 6.3 Meal plan — "Fixed Day v1"

| Meal (time) | swap_group | Dish (default first) | Serving | kcal | P | C | F | buy |
|---|---|---|---|---|---|---|---|---|
| Breakfast 07:00 | base | **Idli** | 4 pcs | 240 | 8 | 50 | 1 | daily (batter) |
| | base | Dosa | 3 pcs | 330 | 8 | 54 | 9 | daily |
| | base | Pesarattu | 2 pcs | 300 | 16 | 40 | 8 | weekly |
| | base | Ragi dosa | 3 pcs | 270 | 7 | 50 | 5 | weekly |
| | side | **Sambar** | 1 cup | 150 | 7 | 20 | 4 | weekly |
| | protein | **Boiled eggs + whites** | 3 whole + 2 whites | 244 | 25 | 1 | 15 | weekly |
| | protein | Egg podimas | 3 whole + 2 whites | 280 | 25 | 3 | 19 | weekly |
| Lunch 13:00 (packed) | base | **Ponni rice** | 1 cup cooked | 210 | 4 | 46 | 1 | pantry |
| | protein | **Chicken curry** | 200 g raw breast | 300 | 46 | 4 | 10 | daily |
| | protein | Fish curry | 200 g raw | 260 | 40 | 4 | 9 | daily |
| | protein | Egg curry | 4 eggs | 340 | 25 | 6 | 24 | weekly |
| | veg | **Vegetable poriyal** | 1 cup | 100 | 3 | 10 | 5 | weekly |
| | veg | Kootu | 1 cup | 150 | 7 | 18 | 5 | weekly |
| | dairy | **Curd** | 150 g | 90 | 5 | 7 | 5 | daily |
| Snack 16:30 | legume | **Moong sprouts sundal** | 1 cup | 150 | 12 | 22 | 2 | weekly |
| | legume | Channa sundal | 1 cup | 210 | 11 | 35 | 3 | weekly |
| | fruit | **Banana** | 1 | 100 | 1 | 26 | 0 | daily |
| | fruit | Guava | 1 | 70 | 3 | 14 | 1 | weekly |
| | nuts | **Peanuts** | 20 g | 115 | 5 | 3 | 10 | pantry |
| | nuts | Almonds | 20 g | 115 | 4 | 4 | 10 | pantry |
| | drink | **Buttermilk** | 1 glass | 40 | 3 | 4 | 1 | daily |
| Dinner 20:00 | base | **Chapati** | 2 | 240 | 7 | 40 | 6 | pantry |
| | base | Dosa | 2 | 220 | 5 | 36 | 6 | daily |
| | protein | **Fish curry (small)** | 150 g raw | 200 | 30 | 4 | 7 | daily |
| | protein | Paneer curry | 100 g paneer | 290 | 18 | 5 | 22 | daily |
| | protein | Egg curry | 3 eggs | 255 | 19 | 5 | 18 | weekly |
| | veg | **Cucumber-onion salad** | 1 bowl | 40 | 1 | 8 | 0 | daily |

Default day ≈ 2,260 kcal (incl. 2 coffees at 20 kcal each), ≈ 157 g protein.

Coffee: black, half sugar, 20 kcal, 0 g protein. Limit 2.

### 6.4 Workout program — "Dumbbell Beginner 5-Day" (start date = first Monday after onboarding)

| Weekday | Title | kind | Exercise | Sets × reps | Rest |
|---|---|---|---|---|---|
| Mon | Upper A | strength | DB bench press | 4 × 8–12 | 90 s |
| | | | One-arm DB row (each side) | 4 × 8–12 | 75 s |
| | | | Seated DB shoulder press | 3 × 8–12 | 75 s |
| | | | DB curl | 3 × 10–15 | 60 s |
| | | | Overhead DB triceps extension | 3 × 10–15 | 60 s |
| Tue | Lower A | strength | Goblet squat | 4 × 10–15 | 90 s |
| | | | DB Romanian deadlift | 4 × 8–12 | 90 s |
| | | | Reverse lunge (each leg) | 3 × 10 | 75 s |
| | | | Standing calf raise | 3 × 15–20 | 45 s |
| | | | Plank | 3 × 30–45 s | 45 s |
| Wed | Walk | walk | Brisk walk | 1 × 30 min | — |
| Thu | Upper B | strength | Incline DB press (flat close-grip if no incline) | 4 × 8–12 | 90 s |
| | | | Chest-supported DB row | 4 × 10–12 | 75 s |
| | | | Lateral raise | 3 × 12–15 | 45 s |
| | | | Push-up | 3 × max | 60 s |
| | | | Hammer curl | 3 × 10–12 | 60 s |
| | | | DB skull crusher | 3 × 10–12 | 60 s |
| Fri | Lower B | strength | Bulgarian split squat (each leg) | 3 × 8–12 | 90 s |
| | | | DB hip thrust | 4 × 10–15 | 75 s |
| | | | Step-up on bench (each leg) | 3 × 10 | 60 s |
| | | | Single-leg RDL (each leg) | 3 × 10 | 60 s |
| | | | Dead bug | 3 × 10 | 45 s |
| Sat | Full Body Circuit | circuit (4 rounds, 60 s between rounds) | DB thruster 10 · Renegade row 8/side · Walking lunge 12 · Push-up 10 | 4 rounds | 60 s |
| Sun | Rest | rest | — | — | — |

Equipment constraint: max 20 kg per hand. Never seed or suggest an exercise needing a barbell, pull-up bar, cable or machine.

---

## 7. Navigation and design system

### 7.1 Tabs

| Tab | Route | Purpose | Primary action |
|---|---|---|---|
| Today | `/(tabs)/today` | Run the day | Tick current block |
| Food | `/(tabs)/food` | Meals, swaps, coffee, shopping | Tick a meal |
| Train | `/(tabs)/train` | Today's session, program, history | Start / log set |
| Progress | `/(tabs)/progress` | Weight, streaks, sleep, weekly review | Log weigh-in |
| More | `/(tabs)/more` | Routine editor, tasks, money, reminders, settings | — |

**Global water FAB** on Today, Food and Train: tap = +200 ml, long-press = sheet with 500 / 750 / custom.

### 7.2 Theme tokens (`src/ui/theme.ts`)

From the approved design (`design/screens/Main.png`). Each accent has a base and a lighter "on dark" step.

| Token | Dark | Light | Meaning |
|---|---|---|---|
| canvas | `#0A0F1C` | `#F8FAFC` | screen background |
| raised | `#131B2E` | `#FFFFFF` | cards, sheets |
| recessed | `#1A2338` | `#F1F5F9` | tracks, inputs, chips |
| text | `#F1F5F9` | `#0F172A` | primary text |
| textSecondary | `#94A3B8` | `#64748B` | secondary text |
| primary ("act now") | `#60A5FA` → `#3B82F6`; buttons `#2563EB` + white | `#2563EB` → `#1D4ED8` | the one current action, current block |
| water | `#38BDF8` → `#7DD3FC` | `#0369A1` → `#38BDF8` | hydration |
| protein / strength | `#A78BFA` → `#C4B5FD` | `#7C3AED` → `#8B5CF6` | protein, training |
| calories / metabolism | `#FB923C` → `#FDBA74` | `#C2410C` → `#FB923C` | kcal, coffee warnings |
| success (done, streak) | `#34D399` | `#047857` | done, streaks |
| danger (deficit, delete) | `#FB7185` | `#E11D48` | overdue, over budget, delete |

Type: **Plus Jakarta Sans** (display and numbers, 500–800) + **Inter** (body, 400–700), bundled via `@expo-google-fonts`, tabular figures for numbers. Sizes 48 / 36 / 28 / 20 / 16 / 14 / 12. Spacing 4/8/12/16/24/32. Radius 12 buttons, 16 cards, 999 chips and toggles. Theme options System / Light / Dark, default **Dark**. Exact values: read `design/source/Main.dc.html`.

**Screens:** `design/INDEX.md` maps all 69 designed screens (light + dark) to features. `design/DESIGN_NOTES.md` lists every design ↔ PRD conflict and which one wins. Designs win on visuals, layout and copy; this PRD wins on data, formulas and seed values.

### 7.3 Shared components

`Button`, `Card`, `Ring` (score/progress ring), `ProgressBar` (with optional "pace" marker), `Sheet` (bottom sheet), `Chip`, `ListRow` (with checkbox + swipe actions), `Fab`, `EmptyState`, `Snackbar` (undo), `NumberStepper`, `TimePicker`. Each has a test and an accessibility label prop.

---

## 8. Feature specifications

Format for each feature: **Reference · Goal · Scope · Edge cases · Acceptance criteria (AC) · Tests**. "Reference" names the exact old-repo files to read first (§2.2).

### F00 — Project scaffold

- **Goal:** runnable Expo app with tabs, theme, store and tooling.
- **Scope:** Expo + TS strict, Expo Router with 5 empty tabs, Redux store with persist (MMKV), theme provider (dark default), ESLint, Prettier, Jest + RNTL configured, `npm` scripts: `start`, `typecheck`, `lint`, `test`, `test:watch`, `e2e`. EAS config with `development` and `preview` profiles. `.env.example` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `PROGRESS.md`, `DECISIONS.md`, `LATER.md`, `.gitignore` and `.env.example` already exist in the repo; extend them, do not recreate.
- **AC:**
  1. `npx expo start` runs; app opens on a device with 5 tabs, dark theme.
  2. `typecheck`, `lint`, `test` all pass with at least one sample test per `ui/` component created.
  3. `.env` is git-ignored.

### F01 — Supabase, auth and schema

- **Goal:** secure backend with the full schema and seed.
- **Scope:** migrations for every table/view in Section 5, RLS policies, `updated_at` triggers, seed.sql (Section 6) seeded for the signed-in user via an RPC `seed_defaults()` (idempotent; runs on first sign-in). Email + password sign-in (single account; no sign-up screen in production builds — sign-up only via a dev flag). Session persisted securely (`expo-secure-store`). Generated types committed.
- **Edge cases:** expired session → silent refresh; offline at launch with a stored session → app opens normally.
- **AC:**
  1. Signing in once keeps the user signed in across restarts.
  2. A second Supabase user cannot read PTR's rows (RLS test via SQL in `supabase/tests/rls.sql`).
  3. `seed_defaults()` run twice creates no duplicates.
- **Tests:** RLS SQL test; unit test for auth slice; type generation is current (`npm run typecheck`).

### F02 — Offline storage and sync engine

- **Goal:** every write is instant and survives offline/app kill.
- **Scope:** `src/lib/sync.ts`: mutation queue in MMKV (`{client_id, table, op: 'upsert'|'soft_delete', row, attempts, next_try_at}`), worker triggers (foreground, NetInfo reconnect, 60 s interval while foreground), upsert `onConflict: 'client_id'`, exponential backoff (1 s, 5 s, 30 s, 2 m, 10 m, then every 10 m), dead-letter after 20 attempts with a visible "Sync issue" badge in More. Selectors merge server data with unsynced local rows by `client_id`. Settings shows "Last synced" and "Pending: n".
- **Edge cases:** same row edited twice before sync → queue collapses to the latest upsert; soft delete of an unsynced row → drop both from queue.
- **AC:**
  1. In airplane mode, logging 5 water entries, killing the app, reopening, then reconnecting results in exactly 5 rows in Supabase.
  2. Pending count returns to 0 within 60 s of reconnect.
- **Tests:** unit tests for queue collapse, backoff schedule, merge selector; integration test with a mocked Supabase client.

### F03 — Onboarding and profile

- **Goal:** set targets in under 2 minutes.
- **Scope:** 4 steps: (1) body: height, current weight (creates first `weight_log`), goal weight; (2) day: wake, sleep, phone-off times; (3) targets: water ml, kcal, protein g, coffee limit — prefilled with defaults; (4) notifications permission + summary. Settings → Profile edits the same fields later.
- **AC:**
  1. Completing onboarding sets `profile.onboarded_at`, creates today's `day_log`, and lands on Today.
  2. Skipping notification permission still completes onboarding; Settings shows "Reminders off — enable".
  3. Block times are absolute. Changing wake time in settings updates only the `wake` block's time in every template; other blocks keep their times.

### F04 — Routine templates and editor

- **Reference:** none on GitHub (morning-routine-tracker is not pushed); build from this spec.
- **Goal:** define what a day looks like.
- **Scope:** list templates (Workday, Weekend, Rest day); edit a template: add/edit/delete/reorder blocks (title, kind, start time, duration, meal slot for meal blocks, notify on/off); assign weekdays; duplicate template. Today uses the template whose `weekdays` contains today's weekday; a manual "Switch template for today" stores `day_log.template_id`.
- **Edge cases:** two templates claim the same weekday → last edited wins, show warning; a template referenced by any `day_log` in the last 7 days cannot be deleted; offer "Archive" instead (add `archived_at timestamptz` to `routine_template`).
- **AC:**
  1. Editing Workday's 05:30 block to 05:45 changes tomorrow's Today timeline and tomorrow's reminder, not past logs.
  2. Switching today to Rest day removes the workout block from today's score.

### F05 — Today screen

- **Reference:** `AutoFit/src/components/{Dashboard,DailyStatus,ScoreDisplay,StreakDisplay}.tsx` for the daily-status idea (LifeOS generalises AutoFit's fixed 0–3 score to a block-based %).
- **Goal:** one screen that runs the day.
- **Scope:**
  - Header: date, template chip (tap to switch), score `Ring`, current streak.
  - Timeline list of blocks ordered by time. States: upcoming, current (highlighted, countdown "next block in 25 min"), done (tick), skipped (grey, reason), overdue (amber after start + duration + 30 min).
  - Tap row = toggle done (haptic, undo snackbar). Long-press = skip sheet with reason (sick/travel/rest/other) or "unskip" (design `Sheet-SkipBlock`). For workout blocks the sheet also offers **"Move to tomorrow"**: that session moves to tomorrow's workout slot and the rest of the week shifts by one day, with Sunday rest absorbing the shift (store as `session_override(date, workout_day_id)`). Optional blocks are shown with "optional · not counted".
  - Auto-complete blocks show a hint ("auto: 500 ml") and complete themselves when the condition is met (water/meal/workout/water target). They can also be ticked manually.
  - Inline mini-widgets: water progress bar under water blocks; meal row shows dish names + kcal; workout row shows session title + "Start".
  - End-of-day card from phone-off time: score, open items, buttons "Log weight", "Log sleep", "Write a note".
- **Edge cases:** opening the app after midnight but before 03:00 still shows the previous logical day; crossing 03:00 while open rolls over within 1 minute.
- **AC:**
  1. Ticking a block updates the ring immediately and persists offline.
  2. Logging 500 ml at 05:15 auto-completes "Drink 500 ml water".
  3. The current block is highlighted correctly at any time of day (unit test on a time-mocked selector).
- **Tests:** selectors `currentBlock(now)`, `blockState`, `autoComplete` rules, `dayScore`; RNTL test for tick + undo.

### F06 — Day scoring and streaks

- **Goal:** honest daily score and streaks (Section 4.2–4.3).
- **Scope:** pure functions in `features/today/selectors.ts`: `computeScore(blocks, blockLogs, autoState)`, `computeStreak(dayLogs, today)` returning `{current, best, graceUsed}`; `day_log.score` and `is_streak_day` upserted whenever a block changes and at logical day end (on next app open, finalise any past days that have no final score). Per-block streaks for the routine editor ("Wake: 12 days").
- **AC:**
  1. Unit tests cover: perfect day, 69% vs 70% boundary, 49% vs 50% boundary, optional blocks ignored, skipped-with-reason excluded, empty plan = 100, a grace day keeps the streak, a second grace day within 14 days breaks it, a grace day 15 days after the last one is allowed, < 50% breaks, missing day_log breaks, today never breaks the streak.

### F07 — Water

- **Reference:** `My-Tracker` water feature (`src/pages/HydrationPage.tsx`, `src/lib/reminderEngine.ts`, `src/lib/timeUtils.ts`, `src/components/{ProgressCircle,QuickAddButtons,TodayLogs,StatsCard}.tsx`); custom stepper from `Tracker/src/components/WaterTracker.tsx`.
- **Goal:** hit 3 L without thinking.
- **Scope:**
  - Water card on Today + full screen (from FAB long-press or More): progress ring (colour shifts as % rises, as in My-Tracker `ProgressCircle`), quick-add 200 / 500 / 750 ml (PTR's choice; the reference used 100–500), custom amount stepper (50 ml steps, 50–2,000 ml), today's log with timestamps, swipe-to-delete with undo, "Undo last".
  - **Pace engine** `src/features/water/lib/pace.ts`, ported from `reminderEngine.ts` steps 3 and 6–9, using `profile.wake_time` and the **Water target block time** (default 21:00; design: "Pace runs 5:00 am → 9:00 pm") in IST (not a stored UTC offset): `expected = clamp((now − wake) ÷ (waterTargetTime − wake), 0, 1) × target`; `gap = expected − actual`; urgency `low` ≤ 200 ml, `medium` ≤ 500, `high` > 500; `suggested = clamp(round50(gap), 50, 500)`. Returns `{status: 'sleeping'|'goal_reached'|'on_track'|'behind', expected, gap, urgency, suggested}`.
  - Behind-pace banner: "350 ml behind. Drink 350 ml now" with a one-tap button that logs `suggested`.
  - Stats (port `getStats`): current streak of days at goal (today may be incomplete), best streak, 7-day average, 7-day bars vs goal.
- **AC:**
  1. Wake 05:00, water target 21:00, target 3,000 ml: at 13:00 expected = 1,500 ml; at 14:20 expected = 1,750 ml (design `Water`).
  2. Gap 180 → urgency low, suggested 200; gap 620 → high, suggested 500.
  3. Entries outside 1–2,000 ml are rejected with an inline error.
  4. Hitting the target triggers a one-time success haptic + toast per day.
- **Tests:** port the reference's pacing cases plus boundary tests at wake, sleep and 200/500 ml gaps.

### F08 — Food: meal plan, logging and swaps

- **Reference:** `Food-Tracker` (`src/components/{MealCard,MacroBar,CalorieRing}.tsx`, `api/insights.js`); `AutoFit/src/components/FoodPlan.tsx` (fixed daily plan with meal timings). LifeOS's plan data comes from §6, not from AutoFit's Gemini generator.
- **Goal:** eat the plan; know the totals.
- **Scope:**
  - Food tab: 4 meal cards (time, default dishes, kcal, protein). "Eaten as planned" tick logs one `food_log` per dish in the meal.
  - Meal detail `/meal/[slot]`: each swap group shows the chosen dish; tapping opens a sheet with the group's alternatives; choosing one updates today's log (or the planned view if not yet eaten). "Make this the default" updates `meal_item.is_default`.
  - Daily totals bar: kcal vs target, protein vs target (two `ProgressBar`s, protein in protein colour).
  - **Daily insights** (port the rules in `Food-Tracker/api/insights.js` to on-device pure functions in `food/lib/insights.ts`, no AI): kcal over target (danger), within 200 kcal of target before dinner (warning), protein < 70% of target after 16:30 (warning, suggests eggs / chicken / paneer / sundal), carbs > 55% of kcal (info), fat > 35% (warning). Show at most 2 insight chips under the totals bar.
  - Plan editor (More → Meal plan): CRUD dishes (name, serving, kcal, P/C/F, buy, shopping items), add/remove dishes to meals, set swap groups. Changes apply from today onward; past logs keep their stored kcal/protein.
- **Edge cases:** partially eaten meal → per-dish ticks plus a **portion picker All / ¾ / ½ / None** in meal detail (design `Food-MealDetail`); kcal and protein scale by portion; Food tab shows "ate ½". Un-tick removes the log (undo).
- **AC:**
  1. Ticking all 4 meals with defaults shows ≈2,220 kcal / ≈157 g protein (coffee excluded) from seed data.
  2. Swapping Idli → Dosa at breakfast changes the totals by +90 kcal.
  3. Editing a dish's kcal does not change yesterday's totals.
  4. Unit tests for every insight rule threshold.

### F09 — Off-plan food and coffee

- **Goal:** log reality, not only the plan.
- **Scope:** "+ Off-plan" on Food tab: free text, kcal (required, quick chips 100/250/500), protein (optional), meal slot or "other". Coffee counter chip on Food tab header: tap +1, long-press −1. At limit: chip turns amber; above limit: red + gentle warning toast, still logged.
- **AC:**
  1. Off-plan items appear in totals and in the day's list marked "off-plan".
  2. Third coffee is logged and shows the warning; `v_daily_summary.coffee_count` = 3.

### F10 — Shopping list

- **Reference:** `Food-Tracker/api/grocery.js`, `src/components/GroceryList.tsx` (aggregation logic only).
- **Goal:** no-fridge friendly grocery list.
- **Scope:** generated from the active plan's **default** dishes × N days (default 7, adjustable 1–7), aggregated by item and unit from `dish.shopping_items`, grouped "Buy daily" / "Buy weekly" / "Pantry". Checkboxes stored locally per week (MMKV only; not synced). Share as plain text (native share sheet). If shopping items have an optional `price_inr`, show "est. ₹1,480" in the header; otherwise hide it.
- **AC:**
  1. Changing days from 7 to 3 rescales quantities.
  2. Share output is readable plain text grouped by section.

### F11 — Workout program and session logger

- **Reference:** `AutoFit/src/components/WorkoutModule.tsx` (per-exercise checklist, completion confirm). LifeOS replaces its 10-minute bodyweight routine with the §6.4 program and real set logging.
- **Goal:** log every set in under 5 seconds.
- **Scope:**
  - Train tab: today's `workout_day` card (title, exercises, est. duration) + "Start session"; week strip showing Mon–Sun with done/missed; program view; exercise library list.
  - Session screen `/session/[date]`: one exercise at a time (swipe/next), target sets × reps, **last session's weight × reps per set shown as placeholder**, `NumberStepper` for weight (step 0.5 kg below 10 kg, 1 kg above; max 20 kg per hand; unilateral exercises note "per hand/per side"), reps stepper, "Log set" → starts rest timer (background-safe using timestamps + local notification when rest ends). Timed exercises (plank) use a countdown. Circuit days show rounds × stations with a round counter.
  - Finish → `session_log.completion` = logged sets ÷ planned sets × 100. ≥ 80% auto-completes the Today workout block.
  - Walk days: single "Done (30 min)" button. Rest days: "Rest day — nothing to do".
- **Edge cases:** app killed mid-session → session resumes; rest timer still correct.
- **AC:**
  1. Logging a set pre-fills next set with the same weight/reps.
  2. Rest timer notification fires when the app is backgrounded.
  3. Completion 80% auto-ticks the Today workout block.

### F12 — Progressive overload and exercise history

- **Goal:** get stronger on purpose.
- **Scope:** rule per exercise after a session: if **every** working set hit `rep_max`, next session suggests +1 kg (+0.5 kg if current < 10 kg); if current weight is already 20 kg, suggest +1 rep target (beyond rep_max) or "slow 3-second lowering" cue. If ≥ 2 sets missed `rep_min`, suggest same weight. Suggestions shown as a chip on the exercise ("Try 12 kg") and accepted with one tap. Exercise history screen: table of past sessions + a line chart of best set (est. 1RM via Epley `w × (1 + reps/30)`).
- **AC:** unit tests for each rule branch incl. the 20 kg cap.

### F13 — Body: weight and energy balance

- **Reference:** `Food-Tracker/api/prediction.js` + `src/components/{WeightChart,WeightPrediction}.tsx`; `AutoFit/api/weight-trend.js`, `src/components/{WeightTracker,WeightChart,CalorieDeficit}.tsx`; BMR/TDEE block in `AutoFit/api/generate-plan.js`.
- **Goal:** see the real trend and whether the deficit is real.
- **Scope:**
  - Weigh-in entry (one per logical day; editing replaces it) from Progress tab and end-of-day card; reminder per `weigh_in_mode`.
  - Chart: daily points (faint) + 7-day average line (bold) + goal line at 75 kg; range toggles 4W / 12W / All.
  - Stats: current 7-day avg, change vs 7 days ago, total lost.
  - **Projection** (`body/lib/projection.ts`, ported from `prediction.js`): (a) trend method = linear regression over the last 28 days of 7-day averages → kg/week and projected date to goal; (b) intake method = avg daily deficit over last 14 days × days ÷ 7,700 kcal/kg. Show both; hide under 14 data points ("Not enough data"); if slope ≥ 0 show "Trend is flat or rising".
  - **Energy card** (`body/lib/energy.ts`, from AutoFit; design `Prog-Energy`): BMR by Mifflin-St Jeor (male: 10w + 6.25h − 5a + 5) using `profile.sex`, `birth_year`, height and latest 7-day avg weight; TDEE = BMR × `profile.activity_factor` (default 1.4). Deficit = TDEE − logged kcal. Zones: < 300 "Too small", 300–700 "On target", > 700 "Too aggressive", each with a one-line fix (e.g. "drop 1 chapati and the peanuts"). **Measured TDEE:** after 28 days with ≥ 20 weigh-ins and ≥ 20 food-logged days, measured TDEE = avg intake + (−trend kg/day × 7,700); show "Check against the scale" and switch to it. Card shown after dinner is logged or after 21:00.
- **AC:**
  1. 7-day average matches `v_weight_trend` within 0.1 kg.
  2. Projection hidden with < 14 data points; regression unit-tested against the reference implementation's outputs for the same inputs.
  3. BMR for 91 kg, 170 cm, 29 y, male = 1,833 kcal (±1); for 88.4 kg = 1,807 (±1); age = current year − `birth_year`.

### F14 — Sleep and phone-off

- **Goal:** protect 10 pm–5 am.
- **Scope:** Today "Phone away" block tick sets `sleep_log.phone_off_kept=true` for the night. Morning prompt (first app open after wake time): "Went to bed at __, woke at __" with defaults = sleep_time / now; two taps to confirm. Progress shows a 14-day bar chart of hours slept with target band (7 h) and bedtime consistency (std dev of bed time, shown as "±25 min"). Settings page "Screen Time setup" with step-by-step text for iOS Downtime 21:30–05:00 (and Android Digital Wellbeing Bedtime mode) — informational, no API.
- **AC:**
  1. Bed 22:40 and wake 05:05 → 6.4 h, attributed to the morning's logical date.
  2. Wake ≤ 05:15 auto-ticks the Wake block for that day.

### F15 — Notifications

- **Goal:** right nudge, right time, ≤ 10/day.
- **Scope:** `features/notifications/schedule.ts` builds the next 2 days of local notifications from templates + profile, rebuilt on: app open, template edit, profile edit, and at a daily 03:05 background task (Expo BackgroundFetch, best-effort). Default schedule:

| Time | Title / body | Deep link | Condition |
|---|---|---|---|
| wake_time | "Good morning. 500 ml water first." | /today | always |
| workout −5 min | "Upper A in 5 min" | /session/[date] | strength/circuit days |
| each meal time | "Breakfast: Idli + Sambar + Eggs" | /meal/[slot] | cancelled if meal already logged |
| 07:30 workdays | "Pack lunch box" | /today | workdays |
| 09:00, 10:30 … 19:30 | "Water: 350 ml behind — drink 350 ml" (copy per urgency from My-Tracker `URGENCY_MESSAGES`) | water sheet | pace engine (F07): notify only when gap ≥ 300 ml; at schedule-build time and on every water log, cancel checks that would be on pace; 90-min cooldown (reference: `min_interval_mins`) |
| phone_off_time | "Phone away. Today: 78%" | /today | always |
| Sun 20:00 | "Weekly review" | /progress/review | from F20 |
| weigh-in day 05:15 | "Weigh in before breakfast" | /progress | per weigh_in_mode |

  Settings → Reminders: toggle per type, quiet mode for today. Hard cap: never schedule more than 10 per logical day; drop lowest priority first (water checks).
- **AC:**
  1. Unit test: schedule builder for a workday produces ≤ 10 items in correct order.
  2. Logging breakfast before 07:00 cancels the 07:00 reminder.
  3. Tapping a notification opens the correct screen.

### F16 — Progress tab

- **Goal:** one place to see if it's working.
- **Scope:** sections: Weight (F13 chart), Streaks (current/best/grace + 30-day calendar heatmap coloured by score), Food (14-day protein and kcal bars vs targets), Training (sessions per week, last 8 weeks), Sleep (F14 chart), Water (14-day bars). Each section header taps into its detail screen.
- **AC:** all charts render with empty states when no data exists; 30-day heatmap matches `day_log.score`.

### F17 — Tasks

- **Reference:** `Tracker/src/components/TodoTracker.tsx` (priority high/medium/low, due date, overdue in red, pending sorted by priority then due date, completed list), `Tracker/scriptable/todo-widget.js`.
- **Goal:** three things that matter today, nothing more.
- **Scope:** More → Tasks: quick add (title; optional priority, default medium; optional due date), pending list sorted by priority weight (high 3, medium 2, low 1) then due date, overdue due dates in danger colour, completed list (collapsible, last 14 days). "Today's top 3" (max 3; adding a 4th asks which to swap out). Top 3 appear on Today as a compact card between the 09:00 and 18:00 blocks. Unfinished top-3 items are suggested again tomorrow, not auto-added.
- **AC:**
  1. Cannot have more than 3 `is_top3` open tasks.
  2. Sorting matches the reference order (unit test).
  3. Completing a task updates Today immediately.

### F18 — Money: expenses, budgets and analytics

- **Reference:** `My-Tracker` expense UI (`src/pages/ExpensesPage.tsx`, `src/components/expenses/{OverviewTab,TransactionsTab,AnalyticsTab,AddExpenseForm,CategoryBadge}.tsx`, `src/hooks/{useExpenseAnalytics,useExpenseFilters}.ts`); `Tracker/src/components/ExpenseTracker.tsx` (budget progress, category donut); `Pulse/src/db/schema.ts` (payment method, recurring).
- **Goal:** know where money goes, food spend especially (₹8–10k/month plan).
- **Scope:**
  - Add expense in ≤ 5 s: amount keypad, category chips, payment method (UPI default, cash, card, other), optional payee/note, date defaults to today, "recurring" toggle (monthly bills).
  - Categories (design `Money-Budgets`; editable with icon + monthly budget): Food & groceries (₹6,000), Bills (₹1,500), Transport (₹800), Health (₹2,000), Shopping (₹1,500), Other (₹1,000); `Income` for credits. The SMS keyword map (§2.2) maps its extra reference categories into these six (Subscriptions → Bills, Entertainment/Education → Other, Cash/Transfer → Other).
  - Overall monthly budget `profile.monthly_budget_inr` (default ₹18,000) with "₹X left · ₹Y/day" and an even-pace tick; unallocated = overall − sum of categories.
  - **Overview:** today's spend, this month's spend vs total budget, income this month, month-over-month % (reference: "12% higher than last month"), 14-day spend bars, last 5 transactions.
  - **Transactions:** filter chips All / Spent / Received, category filter, search by payee, paged 15 at a time, swipe delete with undo (no confirm dialogs).
  - **Analytics** (client-side, port `useExpenseAnalytics`): range 7D / 30D / 90D / This month / All; total and average transaction; daily trend (max 90 days); category % bars (tap → Transactions pre-filtered); day-of-week pattern; top 8 payees.
  - Budgets: per-category bar turns amber at 80%, red at 100%.
- **AC:**
  1. Spend totals exclude credits; income shown separately.
  2. Analytics numbers match the reference hook for the same fixture data (port its logic and write fixture tests).
  3. Category drill-down opens Transactions with that filter applied.

### F19 — External ingest: bank SMS import + Shortcuts quick-log

- **Reference:** `My-Tracker/src/lib/expenseParser.ts` (**port it whole**), its 7 sample SMS in `src/components/expenses/ParserLabTab.tsx`, inbox flow in `src/lib/expenses.ts` and `README.md` §7; merchant map in `Tracker/api/parse-sms.ts`; webhook shape in `OwnTracker/api/expenses/webhook.ts`; quick-log endpoints + API keys in `Pulse/src/app/api/v1/quick/*` and `Pulse/src/db/schema.ts`.
- **Goal:** expenses log themselves; water and expenses can be logged from Siri/Shortcuts without opening the app.
- **Scope:**
  - **Parser** `money/lib/smsParser.ts` (shared copy in `supabase/functions/_shared/`): three stages exactly as the reference — A) reject rules (bill reminder, please-ignore reminder, failed autopay / CBS rejection, statement notice, fee-change noise, promo noise, **plus a new OTP rule**: "OTP" / "one time password" / "do not share") → `skipped` with a reason; B) ordered extraction rules (UPI debit, UPI credit, IMPS credit, cardless ATM withdrawal, credit-card spend, bill auto-debit paid, credit-card autopay confirmation), first match wins, dates normalised from `DD-MMM-YY` / `DD-MM-YYYY`; C) no match → `unmatched` (no AI in v1). References: UPI/IMPS/Txn ID, else `stableHash(raw)` (FNV-1a, as in the reference) for dedupe. Category via merged keyword map (§2.2).
  - **Inbox queue** (reference pattern, made secure): Edge Function `ingest-sms` accepts `POST {"text": "<sms>", "received_at"?: iso}` with `Authorization: Bearer <token>` (design `Integrations`); writes the raw text to `expense_inbox`, then processes it immediately: success → `expense` (`source='sms'`) or `expense_skipped` (with stage + rule + reason), then deletes the inbox row; parser exception → row stays in inbox and is retried on the next call or from the app. Duplicate reference → `{duplicate:true}`.
  - **Quick-log** Edge Function `quick-log`: `POST /quick-log/water {"ml": 500}` or `POST /quick-log/expense {"amount": 240, "category"?, "payee"?, "note"?}` with the same token auth; inserts with a server-generated `client_id`. Used by an iPhone Shortcut ("Log 500 ml") and Siri.
  - **Tokens:** Settings → Integrations → create token (named, e.g. "iPhone Shortcuts"), format `lifeos_pat_<32 chars>`, shown once with a copy button, stored as SHA-256 plus the last 4 characters in `api_token` with `last_used_at`; revoke.
  - Setup guides show the **real** function URLs (`https://<project-ref>.supabase.co/functions/v1/ingest-sms`, `…/quick-log/water`) from config, not the placeholder `api.lifeos.app` used in the design.
  - **Parser Lab** (Settings → Integrations): inbox count + "Process now", paste an SMS to dry-run (shows stage, rule, extracted fields, writes nothing), list of skipped messages with "Mark as expense" override. Include the reference's 7 sample messages as one-tap examples.
  - **Setup guides** in Settings: iOS Shortcuts automation ("When I receive a message from ICICI… → Get contents of URL POST"), Shortcut for quick water log. Android in-app SMS reading only if PTR's main phone is Android (see §14).
  - Gemini fallback (reference stage C): `LATER.md`.
- **AC:**
  1. All 7 reference samples classify exactly as in the reference (fixture tests), plus each reject rule has a test.
  2. Posting the same SMS twice creates one expense; a credit-card SMS without a ref dedupes via `stableHash`.
  3. Forced parser error leaves the row in `expense_inbox`; next run processes it.
  4. Revoked or wrong token → 401; tokens never stored in plain text.
  5. Quick-log water appears in the app after the next sync.

### F20 — Weekly review

- **Goal:** one honest look back, one change forward.
- **Scope:** Sunday 20:00 reminder → Review screen: auto summary from `v_weekly_rollup` (avg score, streak days, sessions, avg protein/kcal, weight change of 7-day avg, avg sleep, spend), worst block of the week (lowest completion %), two text fields: "What went well", "What I change next week". Saved to `weekly_review`. Monday's Today header shows last week's "change" text for the whole day.
- **AC:** review can be completed in under 2 minutes; Monday header shows the saved text; past reviews list in Progress.

### F21 — Steps

- **Reference:** `AutoFit/src/components/StepTracker.tsx` (min target + stretch target, time-aware suggestion).
- **Goal:** passive activity tracking.
- **Scope:** read today's and the last 30 days' step counts from Apple Health (`react-native-health`) or Health Connect (Android). Requires a development build (not Expo Go). Steps target in profile: minimum 6,000, stretch = minimum + 4,000 (AutoFit). Today header chip + Progress 14-day bars. Time-aware hint: `remaining ÷ hours left until sleep_time` → "2,400 steps left: a 25-min walk after dinner". Manual entry fallback if Health permission is denied. Optional routine block kind `steps` with auto-complete at target.
- **AC:** permission denied → feature hides gracefully with a "Connect Health" button.

### F22 — Home-screen widgets (optional, last)

- **Reference:** `Tracker/scriptable/{water-widget,expense-widget,todo-widget}.js`, `My-Tracker/scriptable/HydroFlow-Widget.js`, `Pulse/public/scriptable/*.js`.
- **Goal:** see score, water and spend without opening the app.
- **Scope:** **Option A (default, iOS, fast):** Edge Function `widget-summary` (token auth, read-only) returning `{score, streak, water_ml, water_target, next_block, month_spend, top3}`; port the reference Scriptable widgets to read it (`widgets/scriptable/*.js`) with setup steps in Settings. **Option B (native):** WidgetKit via `expo-apple-targets` / `react-native-android-widget`. Do Option B only if PTR asks; log it in `LATER.md`.
- **AC:** widget shows data no older than its refresh interval; wrong token shows "Reconnect in LifeOS".

### F23 — Settings, data export and polish

- **Scope:** Settings: profile/targets, theme, reminders, routine templates, meal plan editor, workout program editor (edit sets/reps/rest; swap exercise from library), sync status, SMS import setup, Screen Time setup guide, export all data as JSON + CSV per table (share sheet), sign out. App icon + splash. Empty states everywhere. Performance: Today renders in < 300 ms on a mid-range phone with 1 year of data (indexes on `(user_id, date)` for all log tables).
- **AC:** export produces valid JSON containing every table; cold start to interactive Today < 2 s on PTR's phone.

### F24 — Accountability nudges

- **Reference:** `AutoFit/src/components/{MissedDayRecovery,FallbackMode,FailureInterrupt,RealityCheck,WeeklyScore}.tsx`, `AutoFit/api/trigger-interrupt.js`.
- **Goal:** catch a bad day before it becomes a bad week. Blunt copy, no motivational fluff.
- **Scope** (`src/features/accountability/`, pure rule functions + Today cards):
  - **Missed-day recovery:** if yesterday was not a streak day, Today shows a card at first open: "Yesterday: 54%. Missed: workout, dinner. Today's one non-negotiable: ___" (pick one block to pin to the top). Dismissible per day.
  - **Failure interrupt** (design `Acc-Interrupt`): when **≥ 3 counted blocks are overdue** → high-urgency notification + full-width red Today card: "Do ONE thing now: <easiest open block>" with a one-tap done button and "Not now (snooze 15 min)". Re-evaluated on app open and every block start; max 3 a day.
  - **Fallback mode** (design `Acc-Fallback`): after 18:00 if score < 50%, Today shows 4 rescue actions: eat 2 boiled eggs (logs off-plan 140 kcal / 12 g protein), walk 1,000 steps (10 min), drink 500 ml water (logs it), 30-s plank. Each is one tap and shows its **computed** score gain ("+6 pts"); the header says what all 4 would lift the day to and whether that saves the streak via grace. Each action is added as an ad-hoc counted block for the day.
  - **Reality check** (design `Acc-Reality`): (a) 7-day average weight up ≥ 0.4 kg over 10–14 days while average day score ≥ 75% and logged deficit ≥ 300 kcal/day → card with the two contradicting numbers, a 4-item honesty checklist (exact portions, no unlogged snacks, eating out logged honestly, every set done), and two buttons: **"Strict week: weigh food for 7 days"** (sets a 7-day flag that shows "weigh it" on each meal) and **"It's water (new workout, salty meals)"** (dismisses for 7 days); (b) 7 straight days at 100% → "Audit day" prompt. Max once per 7 days each.
  - **Weekly grade** on Progress and in F20: avg score ≥ 90 Excellent, 80–89 Good, 70–79 OK, < 70 Needs work.
  - **Missed-day recovery** (design `Acc-Recovery`): pick one of yesterday's missed blocks (or a key block today) as "today's one non-negotiable" → pinned at the top of Today with a "Lock it in" button; the card shows grace status.
  - Every nudge type can be switched off in Settings → Reminders.
- **AC:** unit tests for every trigger condition and its once-per-period limit; nudges never exceed the 10-notifications/day cap (they take priority over water checks).

### F25 — Multiple accounts (added 2026-11-24 at PTR's request)

- **Decisions (PTR):** open sign-up; email + password; first-run setup asks every needed question and uses PTR's plan as the example for the answers.
- **Goal:** anyone can create their own LifeOS account; nobody ever sees another person's data.
- **Scope:**
  - **Data isolation** stays as built: every row has `user_id` + RLS "own rows"; `seed_defaults()` seeds per user.
  - **Sign-up screen** in every build: email, password (≥ 8), confirm password; with email confirmation on, "Open the link we sent to …, then sign in".
  - **First-run setup, 5 steps:** (1) About you: sex, birth year, height, activity level; (2) Weight: current, goal, weigh-in daily/weekly; (3) Day: wake, phone-off, sleep; (4) Targets: water, kcal, protein, coffee, steps minimum, monthly budget — suggested from the answers; (5) Notifications + summary + "your starting plan". Personal numbers start blank with PTR's values as "e.g." hints. A new account's profile has no body numbers until then.
  - **Starting plan:** every account gets the §6 example plan (routine, meals, workouts, categories). Finishing setup fits every routine block and meal time to the person's wake → sleep day (same position in the day, rounded to 5 min); wake, phone-off and sleep blocks take the answers.
  - **One phone, several accounts:** signing out, or a different account signing in, clears cached data, per-feature state and scheduled reminders. Unsent writes stay tagged with their account and are only pushed or shown for it.
  - **Delete account** in Settings (type DELETE): Edge Function `delete-account` (session JWT only, never a personal access token) deletes the login; all rows cascade.
  - Settings → Profile also edits sex, birth year and activity level.
- **AC:**
  1. A second account on the same phone sees none of the first account's data or reminders.
  2. A new account cannot reach Today before answering steps 1–2.
  3. A 07:00–23:30 person's routine starts at 07:00 with blocks in the same order.
  4. Deleting an account removes its login and every row; its unsent writes are dropped.

---

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Any tap → UI update < 100 ms; Today < 300 ms render |
| Offline | Every feature except SMS import, quick-log, widgets and steps works fully offline |
| Security | RLS on all tables; anon key only in app; no service-role key in the app; ingest tokens hashed; no secrets committed |
| Privacy | No analytics SDKs, no third-party trackers |
| Reliability | Sync loses zero writes across app kills (F02 AC) |
| Accessibility | Labels on all controls; dynamic font up to 130% without clipping on Today |

---

## 10. Testing and quality gates

- Unit tests (Jest) for every selector and `lib/` function. **Coverage ≥ 90% on `selectors.ts` and `lib/` files**; ≥ 70% overall.
- Component tests (RNTL) for: Today row tick/undo, water FAB, meal tick + swap, set logger, weigh-in entry.
- Maestro flows (`e2e/`): `tick_block.yaml`, `log_water.yaml`, `log_set.yaml`, `eat_meal_with_swap.yaml`.
- SQL: `supabase/tests/rls.sql` proving cross-user isolation.
- Before marking any feature done: `npm run typecheck && npm run lint && npm test` green, and manual check steps listed in `PROGRESS.md`.

---

## 11. Release and environments

- Supabase: one project (`lifeos`), migrations applied via Supabase CLI or the Supabase MCP; never edit schema in the dashboard by hand.
- Builds: EAS `development` (with dev client, needed from F11 rest notifications / F21 Health) and `preview` (internal distribution). OTA updates via EAS Update on the `preview` channel.
- Versioning: semver; bump minor per completed milestone (M1 = 0.1.0 …).

---

## 12. Build order

Build strictly in this order. Stop after each feature for PTR's "next".

| # | Feature | Milestone | Depends on |
|---|---|---|---|
| 1 | F00 Project scaffold | M0 Foundation | — |
| 2 | F01 Supabase, auth, schema, seed | M0 | F00 |
| 3 | F02 Offline storage and sync | M0 | F01 |
| 4 | F03 Onboarding and profile | M0 | F02 |
| 5 | F04 Routine templates and editor | M1 Run the day | F03 |
| 6 | F05 Today screen | M1 | F04 |
| 7 | F06 Scoring and streaks | M1 | F05 |
| 8 | F07 Water | M1 | F05 |
| 9 | F08 Food: plan, logging, swaps | M2 Eat the plan | F05 |
| 10 | F09 Off-plan food and coffee | M2 | F08 |
| 11 | F10 Shopping list | M2 | F08 |
| 12 | F15 Notifications | M2 | F04, F07, F08 |
| 13 | F11 Workout program and session logger | M3 Train and track | F05 |
| 14 | F12 Progressive overload and history | M3 | F11 |
| 15 | F13 Body: weight | M3 | F03 |
| 16 | F14 Sleep and phone-off | M3 | F05 |
| 17 | F16 Progress tab | M3 | F06, F08, F11, F13, F14 |
| 18 | F17 Tasks | M4 Life admin | F05 |
| 19 | F18 Money: manual + budgets | M4 | F02 |
| 20 | F20 Weekly review | M4 | F16 |
| 21 | F24 Accountability nudges | M4 | F06, F15 |
| 22 | F19 SMS import + Shortcuts quick-log | M5 Automation | F18 |
| 23 | F21 Steps | M5 | F16 |
| 24 | F23 Settings, export, polish | M5 | all |
| 25 | F22 Home-screen widgets (optional) | M5 | F19, F23 |
| 26 | F25 Multiple accounts (added later) | M6 | F01, F03, F23 |

**Milestone gates (PTR, not Claude Code):** after M1 and after M3, PTR uses the app for 7 consecutive days before asking for the next milestone. Claude Code should remind PTR of this when a milestone completes.

---

## 13. Out of scope (log ideas in `LATER.md`)

AI coach or chat, LLM meal generation (AutoFit `generate-plan.js`), AI photo meal scanning and nutrition estimation (Food-Tracker `analyze-image.js`, `estimate-nutrition.js`), Gemini SMS fallback, generic custom trackers and tags (Pulse), food database / barcode, social sharing, Apple Watch, web dashboard, trading journal (The Desk) and AI paper trader, AutoFit features, in-app purchases.

---

## 14. Open decisions (defaults Claude Code should use until PTR says otherwise)

| Decision | Default |
|---|---|
| Main phone (iPhone or Android) | Build and test on both; prefer iOS instructions for SMS (Shortcuts). PTR to confirm before F19 and F21. |
| Apple Developer account | Not assumed. Use Expo Go until F11; then a development build (free provisioning re-signs every 7 days). Ask PTR before F11. |
| Weigh-in daily or weekly | `daily` (changeable in settings) |
| Meal plan and workout values | Seed values in Section 6; PTR edits in-app after week 1 |
| Chart library | `react-native-gifted-charts` |
