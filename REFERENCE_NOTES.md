# REFERENCE_NOTES.md

Read-only study of `reference/` (shallow clones of `Paattubooku/{Tracker,My-Tracker,OwnTracker,Pulse,Food-Tracker,AutoFit}`) against `PRD.md` §2.2.
Nothing in `reference/` is imported, edited or committed (`reference/` is in `.gitignore`).

**Result: every file named in §2.2 and in the §8 "Reference" lines exists.** Differences from the PRD are flagged per row as **Gap**. Where the PRD and a reference file disagree, the PRD wins (PRD §0.1), so a Gap is a "build this fresh" note, not a blocker.

## Cross-cutting findings (read these first)

1. **No reference repo has any test file** (0 `*.test.*` / `*.spec.*` in all six). Three ACs say "match the reference":
   - F07 "port the reference's pacing cases" — there are none to port.
   - F13 AC2 "regression tested against the reference's outputs".
   - F18 AC2 "analytics match the reference hook".

   **Plan:** before porting each, run the reference function in a scratch dir on hand-picked inputs, freeze the outputs as golden fixtures, and test the port against them (adapted where the PRD deliberately differs). I'll list those deviations in `DECISIONS.md`.
2. **All reference date logic is UTC or device-local** (`toISOString().split('T')[0]`, `getDay()`, `new Date(y, m, 1)`). Every port goes through `src/lib/dates.ts` with IST and the 03:00 logical day. Fixtures must therefore use fixed timestamps, not "today".
3. **Several §2.2 rows are thinner than the PRD implies.** `grocery.js` (F10) is not an aggregator, and the AutoFit accountability components (F24) are UI stubs with no rule logic. Those are new builds with reference "flavour" only (rows 12, 14).
4. **Reference security anti-patterns confirmed** (§2.3): allow-all RLS and anon-key writes (My-Tracker `expenses.ts`), a shared-secret header (OwnTracker webhook), plaintext API keys in `api_keys.key` (Pulse), service-role/anon key inside Scriptable widget scripts, a Gemini key in the browser (`expenseParser.ts` stage C). None of this is carried over.

## Row-by-row (PRD §2.2)

Legend: ✅ file exists · **Read** = read in full or the relevant section · **Skimmed** = read the relevant part only.

### 1. SMS classifier → `money/lib/smsParser.ts` + `_shared/smsParser.ts` (F19)
✅ `My-Tracker/src/lib/expenseParser.ts` (494 lines, **Read**), ✅ 7 samples in `ParserLabTab.tsx` L22–30 (**Read**)
- Port stage A as-is: 6 reject rules (`bill_reminder_auto_debit`, `bill_reminder_please_ignore`, `failed_autopay_cbs_rejection`, `statement_notice`, `fee_change_noise`, `generic_promo_noise`), all lowercase `includes` tests.
- Port stage B as-is: 7 ordered regex rules (`upi_debit`, `upi_credit`, `imps_credit`, `cardless_atm_withdrawal`, `credit_card_spend`, `bill_autodebit_paid`, `credit_card_autopay_confirmation`), first match wins. Keep `parseIciciDate` (DD-MMM-YY, DD-MM-YYYY), `stableHash` (FNV-1a + second mix) and `sig_` + hash synthetic refs for the two ref-less rules.
- Take the 7 sample SMS verbatim as fixtures (expected: UPI debit, UPI credit, bill reminder → skip, failed autopay → skip, ATM → debit, card spend → debit, statement → skip).
- Drop stage C (Gemini) entirely and the `ClassificationError` class; keep the "parser exception ⇒ stay in inbox" behaviour via a plain thrown error.
- **Gap:** no OTP rule (PRD A16: add `otp`, `one time password`, `do not share`; the reference has none).
- **Gap:** unmatched messages return `not_a_transaction/noise` with `stage: 'unmatched_default'`. The PRD wants classification `unmatched` (a visible state in the Parser Lab), so I'll add that to the type.
- **Gap:** `parseIciciDate` falls back to today's UTC date on a parse failure. That would silently mis-date; I'll return `null`/`unmatched` instead.
- **Gap:** categories are `food|bills|cash|card|shopping|transfer|income|other`; LifeOS has 6 categories + Income, so `cash`/`card`/`transfer` → Other (PRD §8 F18).
- Edge cases worth noting for tests: `upi_credit` also requires a trailing `.` before `UPI:`; `bill_autodebit_paid` strips a trailing `-ICICI Bank` from the Txn ID.

### 2. Merchant → category map → merged into `inferCategory()` (F18, F19)
✅ `Tracker/api/parse-sms.ts` (265 lines, **Read** L1–140: `CATEGORIES`, `categorize`, date parsing, an older ad-hoc parser)
- Port the keyword lists for Food, Transport, Shopping, Bills, Health; fold Entertainment, Education → Other and Subscriptions → Bills (PRD F18). Match on upper-cased payee `includes`, first category wins in declaration order.
- Merge with `expenseParser`'s own regex hints (`swiggy`, `zomato`, `juice`, `fibernet`, `electricity`…), which are Tamil Nadu-specific and more relevant to PTR than some of the generic list.
- **Gap:** `includes` on short tokens is risky (`OLA` matches "COLA"/"VIOLA", `NATURAL`, `MESS`, `SWEET`, `LIC`, `EMI`). I'll use word-boundary matching and test it. Default is `UPI` there; LifeOS default is Other.
- Skip the rest of that file (the old parser duplicates `expenseParser`, and it also skips credits).

### 3. Inbox-queue pattern → `ingest-sms` + `money/` (F19)
✅ `My-Tracker/src/lib/expenses.ts` (**Read**), ✅ `My-Tracker/README.md` §7.2/§7.5 (**Skimmed**; §7 headings confirmed)
- Port the loop shape: classify → insert `expense` (upsert, `ignoreDuplicates` on the ref) or `expense_skipped` → delete the inbox row only after success; any throw leaves the row for retry. Oldest first, capped at 200.
- Port the result counters (`debitsLogged`, `creditsLogged`, `duplicatesIgnored`, `skippedNonTransactional`, `leftInInboxDueToError`) for the Parser Lab "Process now" result.
- **Gap:** the reference writes via the browser anon key; LifeOS does it in an Edge Function with a hashed token, under per-user RLS, with `user_id` set from the token.
- **Gap:** manual expenses use `manual_${Date.now()}…` as `upi_ref`. LifeOS uses `client_id` and a null `txn_ref` for manual rows.
- **Gap:** the reference's duplicate detection is "upsert returned 0 rows". The PRD wants an explicit `{duplicate:true}` response. Postgres `ON CONFLICT DO NOTHING RETURNING` gives that, but the unique index is partial (`where txn_ref is not null`), so the conflict target must repeat the predicate.

### 4. Pace-aware water reminder → `water/lib/pace.ts` (F07, F15)
✅ `My-Tracker/src/lib/reminderEngine.ts` (294 lines, **Read**), ✅ `timeUtils.ts` (**Read**), ✅ `types/index.ts` (`URGENCY_MESSAGES`, **Read**)
- Port as pure `pace(now, profile, loggedMl)`: `calculateExpectedIntake`, `classifyUrgency` (>500 high, >200 medium, else low; matches the PRD), `calculateSuggestedAmount` (round to 50, clamp 50–500).
- Port the 3 urgency message templates; rewrite wording without emoji/"Severe deficit" language, in the PRD tone ("350 ml behind. Drink 350 ml now").
- Drop all I/O (`getAllSettings`, `addReminderLog`, `updateSettings`) and the cooldown, which moves to the F15 scheduler (90 min).
- **Gap:** the reference's window is wake → *sleep* (22:00) and it suppresses as `sleeping` outside it. PRD A6: wake → **water-target block time** (21:00), with `expected` clamped to the target after that. So 13:00 → 1,500 and 14:20 → 1,750 ml (I checked: (13−5)/(21−5)·3000 = 1,500 ✓; 9⅓/16·3000 = 1,750 ✓).
- **Gap:** it uses a stored `+05:30` offset string and `getUTCHours`. LifeOS uses IST via `dates.ts`.
- **Gap:** `Math.round` on expected. Keep it (the PRD examples are integers), but this decides boundary tests at exactly 200/500.
- **Gap:** the reference's default cooldown is 60 min (`min_interval_mins`), the PRD is 90, and "notify only when gap ≥ 300" (A7) is new.

### 5. Water stats → `water/selectors.ts` (F07)
✅ `reminderEngine.ts` `getStats` (L245–294, **Read**)
- Port current-streak (scan back from today; an incomplete *today* doesn't break it) and best-streak and 7-day average.
- **Gap:** it only sees a 7-day window, so "best streak" is the best within 7 days. PRD F07 wants a real best streak over all history. I'll compute over all `v_daily_summary` rows.
- **Gap:** `history7Days` is assumed to be 7 consecutive days. A day with no rows must count as 0, so I need an explicit date range. The reference's 7-day average divides by 7 even if the user is new, which I'll keep.

### 6. Expense analytics → `money/selectors.ts` (F18)
✅ `My-Tracker/src/hooks/useExpenseAnalytics.ts` (193 lines, **Read**); ✅ `Overview/Transactions/Analytics` tabs, `AddExpenseForm`, `CategoryBadge`, `useExpenseFilters` (**Skimmed**, logic parts)
- Port as pure `analytics(expenses, range, today)`: debit/credit totals, average transaction, category % (sorted desc), top 8 payees (`Unknown` bucket), weekday pattern, month-over-month % (null when the previous month is 0), daily trend capped at 90 days.
- Port `useExpenseFilters` as a pure `filterExpenses` (type, category, payee substring) and `PAGE_SIZE = 15` from `TransactionsTab`.
- **Gap:** range maths is UTC/local mixed (`toISOString`, `new Date(y, m, 1)`, `getDay()` on `T00:00:00`). Re-do on IST date strings; weekday from the date string.
- **Gap:** `trendDays` for non-`all` ranges uses `Date.now() - new Date(startDate)` (UTC), and `month` range length is therefore off by up to a day. Fixtures will use a pinned `today`.
- **Gap:** "today's spend" in `OverviewTab` uses UTC `today`.
- **Gap:** fields are renamed (`txn_date/type/payee/upi_ref` → `date/direction/merchant/txn_ref`). The category list is the reference's 8 vs LifeOS's 6 + Income.
- **Gap:** no budgets in the reference hook. Budget bars (80% amber / 100% red, overall ₹18,000 + pace tick) are new; only the idea is in `Tracker/ExpenseTracker.tsx` (single monthly budget %).

### 7. Quick-log API → `quick-log` Edge Function (F19)
✅ `Pulse/src/app/api/v1/quick/water/route.ts` (**Read**), ✅ `quick/expense/route.ts` (**Read**), ✅ `Pulse/src/db/schema.ts` `api_keys` (**Read**), ✅ `lib/auth.ts` (**Skimmed**)
- Port: lenient parsing (JSON body *or* query string, for Shortcuts), amount validation, find-or-create category by case-insensitive name, `last_used_at` update, friendly `message` in the response.
- **Gap:** PRD A15 shapes: `{"ml": 500}` and `{"amount", "category"?, "payee"?, "note"?}`. The reference's aliases (`amount_ml`, `desc`, `merchant`) are dropped, except I may accept `ml` and `amount_ml`. I'll decide in DECISIONS.
- **Gap:** keys are plaintext, accepted in the URL (`?api_key=`, ends up in logs) and there's a `MASTER_API_KEY` bypass. LifeOS: `lifeos_pat_<32>` SHA-256 hashed, `Authorization: Bearer` only, no master key, revocable.
- **Gap:** no 1–2,000 ml range check in the reference (it accepts any positive `ml`). PRD's `water_log` CHECK is 1–2000, so the function must return 400, not 500.
- **Gap:** payment-method enum differs (`credit_card, debit_card, bank_transfer, wallet, …`) from the PRD's `upi/cash/card/netbanking/other`; needs a mapping. Beverage `type` (coffee etc.) is dropped; coffee is a separate counter.

### 8. Payment method + recurring flag → `expense` table (F18)
✅ `Pulse/src/db/schema.ts` (**Read**)
- Port the idea of `payment_method` and `is_recurring`.
- **Gap:** Pulse also has a `recurrence` enum (daily…yearly); the PRD only has a boolean. Not needed (monthly bills only). Sub-categories, tags and generic trackers are out of scope (§13).

### 9. Todo priority/due/sort → `tasks/` (F17)
✅ `Tracker/src/components/TodoTracker.tsx` (**Read** the sort and display logic)
- Port: priority weights high 3 / medium 2 / low 1, overdue due-date in danger colour, separate completed list.
- **Gap (important):** the reference sorts by priority weight, then **newest-created first** (`timestamp` desc). It does **not** sort by due date. PRD F17 says "priority weight, then due date" and AC2 says "sorting matches the reference order (unit test)". These conflict. Proposed: priority desc → due date asc (nulls last) → created asc, which is what the PRD text says. **Decision needed from PTR** (see below).
- **Gap:** overdue is `new Date(due) < new Date()`, which flags a task due *today* as overdue after 00:00 UTC. LifeOS: overdue only when `due_date < logicalToday`.
- No top-3 concept in the reference.

### 10. Scriptable widgets → `widgets/scriptable/*.js` (F22)
✅ `Tracker/scriptable/{water,expense,todo}-widget.js` (681/921/438 lines), ✅ `Pulse/public/scriptable/{water-intake,expense-tracker}-widget.js`, ✅ `My-Tracker/scriptable/HydroFlow-Widget.js` (**Skimmed**: config/fetch/render structure of `water-widget.js`)
- Port the Scriptable layout code (ring drawing, `ListWidget` sizing, timeouts, "not configured" state) only.
- **Gap:** they fetch from Supabase REST with `SUPABASE_SERVICE_ROLE_KEY || ANON_KEY` pasted into the script. LifeOS widgets call `widget-summary` with a read-only token, show "Reconnect in LifeOS" on 401, and never see a service key.
- **Gap:** ~3,200 lines across 6 files for what the PRD needs as 3 small widgets. Treat as a layout reference, don't port wholesale. This is F22 (optional, last), so I'll read them properly then.

### 11. Weight prediction → `body/lib/projection.ts` (F13)
✅ `Food-Tracker/api/prediction.js` (105 lines, **Read**); ✅ `weight-trend.js` (**Read**); `WeightPrediction.tsx` (**Skimmed**)
- Port: ordinary least squares (`slope`, `intercept` from sums), `calories × days / 7700`, `implied TDEE = avg intake − slope × 7700`, trend label with a ±0.3 kg band.
- **Gap (structural):** the reference regresses on the **array index**, not on days, so gaps in logging distort the slope. PRD says "linear regression over the last 28 days of 7-day averages" → x must be day offsets. A pure port would give different numbers, so the "match the reference" AC can only hold for evenly spaced daily data; golden fixtures will use consecutive days.
- **Gap:** the reference blends 60% trend + 40% calorie method into one number and needs only ≥ 3 points. The PRD shows **both methods separately**, hides under **14** points, and adds "Trend is flat or rising" when slope ≥ 0. The projected *date to goal* is new.
- **Gap:** its "intake method" isn't independent: it derives TDEE from the regression slope, so the two methods can't disagree. The PRD's version (deficit = TDEE − logged kcal, from BMR × 1.4) is independent and is built from §13 `energy.ts`, not from this file.
- **Gap:** UTC `toISOString` day-bucketing of meals; demo-user hard-coded id (ignore).
- `weight-trend.js` buckets weeks by Sunday via `getDay()`; the PRD needs a trailing 7-day average (`v_weight_trend`), which is not in the reference. New code.

### 12. Daily food insights → `food/lib/insights.ts` (F08)
✅ `Food-Tracker/api/insights.js` (116 lines, **Read**)
- Port the *shape*: pure function of `{totals, targets, weights}` → list of `{type, title, message, severity}`, severity ∈ danger/warning/info/success.
- **Gap (thresholds differ; PRD wins):**

  | Rule | Reference | PRD F08 |
  |---|---|---|
  | kcal | ≥ 100% danger, ≥ 80% warning | over target = danger; within 200 kcal of target *before dinner* = warning |
  | protein | < 40% of goal and ≥ 2 meals logged | < 70% of target after 16:30; suggests eggs/chicken/paneer/sundal |
  | carbs | > 65% of kcal | > 55% |
  | fat | > 45% of kcal | > 35% |
  | weekly weight trend | −0.3 / +0.5 kg of 7-pt averages | listed in §2.2 but **not in F08 scope** |

- Show at most 2 chips under the totals bar (new). The "weight trend" insight appears in §2.2 but F08's scope and ACs don't use it. **Question for PTR** below.
- The reference persists insights in a `daily_insights` table; LifeOS computes on device and stores nothing.
- Macro % uses 4/4/9 kcal per gram (keep). Reference guards `calories > 200` before macro rules (keep as a sensible floor).

### 13. Grocery list aggregation → `food/lib/shopping.ts` (F10)
✅ `Food-Tracker/api/grocery.js` (83 lines, **Read**); ✅ `GroceryList.tsx` (**Skimmed**)
- **Gap (major):** this file does **not** aggregate quantities. It builds a "regulars / nutrition gaps / suggestions" list from logged-meal frequency (`food_patterns`) with keyword checks (protein, veg). There is nothing to port for "default dishes × N days, aggregated by item and unit, grouped daily/weekly/pantry".
- I'll write `shopping.ts` from the PRD: sum `dish.shopping_items` over default dishes × days, merge on `(item, unit)`, scale by N, group by `dish.buy`, optional price total.
- Reusable idea only: the protein/vegetable keyword lists could seed a future "nutrition gap" hint → `LATER.md`.

### 14. BMR/TDEE + deficit card → `body/lib/energy.ts` (F13)
✅ `AutoFit/api/generate-plan.js` (pre-calc block L135–162, **Read**); ✅ `CalorieDeficit.tsx` (148 lines, **Read**)
- Port Mifflin-St Jeor exactly (male `10w + 6.25h − 5a + 5`, female `… − 161`) and the card's status/advice structure.
- **Verified against the PRD AC3:** 91 kg/170 cm/29 y male = 1,832.5 → **1,833**; 88.4 kg → 1,806.5 → **1,807** (JS `Math.round`). Age = current year − `birth_year` (2026 − 1997 = 29).
- **Gap:** the reference activity multiplier is 1.2/1.375/1.55/1.725 by label; PRD A12 is `profile.activity_factor`, default **1.4**.
- **Gap:** `CalorieDeficit.tsx` is *hard-coded* (meal kcal 350/500/250/350, `BASE_BURN = 1800`, steps × 0.04, workout +80). PRD §2.3 forbids this. The deficit is `TDEE − logged kcal` from real logs.
- **Gap:** zones are 250/450/600/800 in the reference (5 bands: low / optimal / good / aggressive / too high / surplus); PRD A12 is `< 300 too small`, `300–700 on target`, `> 700 too aggressive`. Use the PRD. Add the one-line fixes (e.g. "drop 1 chapati and the peanuts") from real plan data.
- **Gap (new):** measured TDEE after 28 days and the "Check against the scale" state aren't in the reference.

### 15. Accountability → `accountability/` (F24)
✅ `AutoFit/src/components/{MissedDayRecovery,FallbackMode,FailureInterrupt,RealityCheck,WeeklyScore}.tsx`, ✅ `api/trigger-interrupt.js` (all **Read**)
- Port only copy/UX ideas and the "blunt, no fluff" tone ("Do ONE thing now", "Be brutally honest with yourself", "No thinking. Just execute"); the PRD's own copy supersedes the emoji-heavy strings.
- **Gap (everything is new logic):**
  - *Missed-day recovery:* reference shows a dismiss-only banner when yesterday's 0–3 score < 3. No missed-block list, no "one non-negotiable", no pinning, no grace status.
  - *Fallback:* reference opens a static list from a button when score < 2. No 18:00 gate, no computed "+N pts", no logging of the actions (the "walk 1000 steps" button just adds 1,000 steps).
  - *Failure interrupt:* reference asks a server (`trigger-interrupt.js`) that flags `steps < 3000`, food not done, workout not done; urgency high if ≥ 2 issues. No overdue-block logic, snooze, daily cap or notification. PRD A8: ≥ 3 overdue counted blocks, snooze 15 min, max 3/day.
  - *Reality check:* reference = last 3 weights non-decreasing **and** ≥ 3 perfect days in 7; second case = 7/7 perfect days. PRD: 7-day avg weight up ≥ 0.4 kg over 10–14 days **and** avg score ≥ 75 **and** deficit ≥ 300; two buttons ("Strict week", "It's water") and a once-per-7-days limit, none of which exist.
  - *Weekly grade:* reference bands 90 / 70 / 50 (Excellent / Good / Needs work / Struggling); PRD A5 is 90 / 80 / 70 (Excellent / Good / OK / Needs work).
- Also read: `Dashboard`, `DailyStatus`, `ScoreDisplay`, `StreakDisplay` (F05 reference). `DailyStatus` has a "survival day" idea (score ≥ 1 counts) and an 11 pm "day locked" rule; neither is in the PRD, so I won't carry them over.

### 16. Time-aware step suggestion → `steps/` (F21)
✅ `AutoFit/src/components/StepTracker.tsx` (202 lines, **Read**)
- Port: min target 6,000, stretch = min + 4,000, `remaining = max(0, min − steps)`, per-hour pace `ceil(remaining / hoursLeft)`, ~100 steps/min for walk minutes, status colour at ≥ 3,000, quick-add 500/1,000/2,000 for manual entry.
- **Gap:** "hours left" is hard-coded to 22:00 and floors to whole hours (`22 − getHours()`); PRD: until `profile.sleep_time`, fractional. Walk minutes are `ceil(remaining/100)` = 24 min for 2,400, but the PRD example says "25-min walk"; I'll round up to the nearest 5 min (decision for `DECISIONS.md`).
- **Gap:** burn estimate `steps × 0.04` kcal isn't used in the PRD; skip.

## Other files from §8 "Reference" lines (checked)

| Feature | Files | Status |
|---|---|---|
| F05 Today | AutoFit `Dashboard, DailyStatus, ScoreDisplay, StreakDisplay` | ✅. Score is a fixed 0–3, streak is server-side "all-3 days only", with no grace. Generalised to block-based % by the PRD; **no streak logic to port** (`api/daily.js` L30–93 reviewed: perfect-day-only, UTC-free but device-local, writes to `user_profile`). |
| F07 Water UI | My-Tracker `HydrationPage, ProgressCircle, QuickAddButtons, TodayLogs, StatsCard`; Tracker `WaterTracker` | ✅. Reuse: ring colour bands by % (≥100 green, ≥75, ≥50, ≥25, else; map to tokens, not hex), "Undo last", custom stepper 50 ml steps clamped 50–2,000 (`WaterTracker` L163–174). Quick amounts differ (100–500 vs PRD 200/500/750). |
| F08 Food UI | Food-Tracker `MealCard, MacroBar, CalorieRing`; AutoFit `FoodPlan` | ✅. `MealCard` is AI-scan/free-text correction centred (not relevant); `FoodPlan` has a hard-coded plan + perfect/adjusted/missed/pending meal states (the PRD's portion picker replaces them). MacroBar/CalorieRing: simple ring + "over" turns red. |
| F11 Workout | AutoFit `WorkoutModule` | ✅. Hard-coded 6-item bodyweight `DEFAULT_WORKOUT` + per-exercise checklist + confirm; **no set logging, rest timer or progression**. Almost entirely new. |
| F13 Weight UI | Food-Tracker `WeightChart, WeightPrediction`; AutoFit `WeightTracker, WeightChart`, `api/weight-trend.js` | ✅. Recharts (web only); nothing portable besides the chart "range/ prediction dashed" idea. |
| F18 Money UI | My-Tracker `ExpensesPage` + tabs; Tracker `ExpenseTracker` | ✅. Recharts/Tailwind: layout idea only. |
| F19 | OwnTracker `api/expenses/webhook.ts` | ✅. Same flow as `ingest-sms` (secret header → classify → skip/upsert, ignore duplicates). Body field is `message`; the PRD design says `text`. |
| F22 | scriptable files | See row 10. |

## Open questions for PTR

1. **Todo sort (F17 AC2):** the reference sorts priority → newest-created; the PRD text says priority → due date. Use the PRD text (priority → due date asc, nulls last)? *(I'll proceed with this unless you say otherwise.)*
2. **"Weekly weight trend up/down" insight** is in §2.2 but not in F08's scope. Skip it for F08 and log it in `LATER.md`? *(Default: skip.)*
3. **Golden fixtures** from the reference: OK to run the reference's pure functions in a scratch folder (outside the repo, `reference/` untouched) to generate expected outputs?

## Housekeeping done

- Cloned the 6 repos with `--depth 1` into `reference/` (the PRD's `gh repo clone` could not be used because the session's `GH_TOKEN` is invalid; plain `git clone` over the public HTTPS URLs worked, same result).
- `reference/` was already in `.gitignore` (L18–19); verified with `git check-ignore`. No change was needed.
