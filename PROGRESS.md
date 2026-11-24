# Progress

One entry per feature, newest first: feature ID, what was built, how PTR verifies it on the phone, known gaps.

## F21 — Steps · 2026-11-24 · done

**Built**

- **`/steps`** (no design; Water pattern per DESIGN_NOTES):
  - Ring of today's steps against the stretch target, with a tick at the minimum.
  - The time-aware hint: remaining ÷ hours left until sleep time, e.g. "2,400 steps left: a 24-min walk after dinner".
  - Tiles: 7-day avg and days at the minimum. 14-day bars with the minimum line.
  - An editable daily minimum (`profile.steps_min`, default 6,000; stretch = minimum + 4,000, as in AutoFit).
- **Apple Health** via `@kingstinct/react-native-healthkit`:
  - **Connect Health** asks for step-count read access, then reads the last 30 days (one bucket per IST day) and stores changed days in `steps_log` with `source='health'`. Today refreshes from Health once per visit.
  - The module is loaded lazily. In **Expo Go**, or when access is refused, the feature falls back to **manual entry** (+500 / +1,000 / +2,000, set today's total) and keeps the **Connect Health** button with an explanation (AC).
- **Today**: a steps chip next to the template chip (e.g. "4,210" → `/steps`). It's hidden until there are steps or Health is connected.
- **Progress**: a Steps card with 14-day bars against the minimum (→ `/steps`).
- **Routine**: a new optional block kind **Steps** that ticks itself when today's steps reach the minimum. Migration `20261124140016_block_kind_steps.sql` only widens the kind check; it's applied to the live project.
- `app.json`: the HealthKit config plugin (read-only usage text, no background delivery) for the development build.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 775 tests (`steps/lib/steps.ts` 100 %) · `test:db` ✅ (new `steps.sql`) · iOS + Android bundle export ✅. `expo config --type introspect` shows the HealthKit entitlement and usage text.
- **AC**: when Health is unavailable or refused, the screen stays usable with manual entry and a **Connect Health** button (screen tests for both). The connected path is tested with a mocked HealthKit.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start`. Two new packages are included; nothing changes for Expo Go.
2. **In Expo Go**: Today has no steps chip yet. Progress → **Steps** → tap +1,000 a few times, or Set today's total. The chip appears on Today and the bars fill. **Connect Health** says it needs the development build.
3. Optional: Routine → add a block → kind **Steps**. It ticks itself once today's steps reach 6,000.
4. **Apple Health** needs the LifeOS development build (EAS, with your Apple ID). Once it's installed: Steps → **Connect Health** → allow Steps, and today's count shows up.

**Known gaps**

- The Apple Health path hasn't run on a real iPhone (no development build yet), so it's covered only by tests against the library's API.
- Android Health Connect is not built (your phone is an iPhone).
- Steps are counted per calendar day (midnight), as Health reports them, not the 03:00 logical day.

## F20 — Weekly review · 2026-11-24 · done

**Built**

- **`/review`**, three steps (Review-1/2/3 designs):
  1. **Your week in numbers**:
     - Average day score in a ring, with the grade (Excellent ≥ 90 · Good 80–89 · OK 70–79 · Needs work < 70) and the change vs last week.
     - Tiles: streak days, sessions, protein avg, 7-day-avg weight change, sleep avg and spend, all from `v_weekly_rollup`.
     - **Worst block**: the hand-ticked block with the lowest completion %, with the days missed and its time.
  2. **Reflect**: "What went well" and "What I change next week" (280 characters each, with counters), plus one-tap ideas drawn from the week (the worst block, sleep, protein).
  3. **Done for this week**: saved with week number, score and grade; your change; "Pinned to Today all week"; the next review date. **Edit review** reuses the same row.
- Saved to `weekly_review`, one per week: summary JSON, grade and both texts.
- **Sunday 20:00 reminder** "Weekly review" → `/review`. It's dropped once that week is reviewed, and has its own switch in Settings → Reminders.
- **Today**: the "This week's change · from Sunday" card (Review-4 design) shows all week, with last week's worst block and sleep; tap → past reviews.
- **Progress**: a **Weekly review** button (Prog-Tab design) and a **Reviews** card (last grade, count) → `/reviews`, the list of past reviews (week, score · grade, went well, change, worst block).

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 763 tests (`review/lib` 100 % lines) · `test:db` ✅ · iOS + Android bundle export ✅. No schema change (`weekly_review` and the view already existed).
- **AC "under 2 minutes"**: the whole flow is 4 taps plus two short texts (screen test: Next → type → Save).
- **AC "Monday header shows the saved text"**: screen test with last week's review; the card shows the change on Today.
- **AC "past reviews list in Progress"**: Progress → Reviews → list (screen test).

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start`.
2. Progress → **Weekly review**. Look at the numbers (they need a connection), tap **Next: reflect**, write two lines, **Save review**.
3. On Monday (or any day next week) Today shows "This week's change" at the top.
4. Progress → **Reviews** lists the review. On Sunday at 8 pm the reminder opens the review; it doesn't fire once you've reviewed that week.

**Known gaps**

- The design's "Evening walk block moved to 8:30 pm on Workday" (changing the routine from the review) isn't done; the change is text only.
- The numbers come from the server view, so they need a connection. Offline, the screen says so and the reflection still saves.

## F19 — External ingest: bank SMS import + Shortcuts quick-log · 2026-11-24 · done

**Built**

- **Parser** `money/lib/smsParser.ts`, a port of My-Tracker `expenseParser.ts`:
  - Stage A reject rules (6 from the reference, plus a new **OTP** rule that never rejects a message where money actually moved).
  - Stage B: 7 ordered extraction rules, with `DD-MMM-YY` / `DD-MM-YYYY` dates, UPI/IMPS/Txn refs, and `sig_<stableHash>` (FNV-1a) refs for ref-less card SMS.
  - Stage C: `unmatched` (no AI).
  - Category comes from the Tracker merchant map folded into LifeOS categories, then the reference's hints.
  - The file is byte-identical to `supabase/functions/_shared/smsParser.ts` (a test checks).
- **Edge Function `ingest-sms`** (deployed): `POST {"text": "<sms>", "received_at"?}` with `Authorization: Bearer lifeos_pat_…`.
  - Each message goes to `expense_inbox`, then the inbox is processed at once (oldest first, ≤ 200).
  - A transaction becomes an `expense` with `source='sms'`; a duplicate ref gives `{duplicate: true}`.
  - Anything else goes to `expense_skipped` with stage, rule and reason, and the inbox row is then deleted.
  - Any error leaves the row in the inbox (attempts + 1, last_error) for the next call or for Process now.
  - The app's own session can call `{"process": true}`.
- **Edge Function `quick-log`** (deployed): `POST /quick-log/water {"ml": 500}` and `POST /quick-log/expense {"amount", "category"?, "payee"?, "note"?}`, with the same token auth. Rows get a server-made `client_id` on the IST logical day.
- Server logic lives in `money/lib/ingest.ts` (token checks, inbox processor, quick-log validation), byte-identical to `_shared/ingest.ts` and unit-tested with an in-memory database. The Deno entry points only wire it to Supabase (`deno check` passes).
- **More → Integrations** `/settings/integrations` (Integrations design):
  - Parser Lab entry with the inbox count.
  - **Create token**, named; `lifeos_pat_` + 32 characters from secure random bytes. It's shown once with Copy; only the SHA-256 and the last 4 are stored. Revoke.
  - Setup guides with the **real** function URLs (copy buttons): iPhone SMS automation, Siri "Log 500 ml", quick-expense Shortcut.
- **Parser Lab** `/settings/parser-lab` (Integrations-ParserLab design):
  - Inbox count, "N look like payments" and **Process now**.
  - Dry run: paste an SMS or tap one of the reference's 7 samples. It shows each stage (reject / extract / categorise / dedupe against your expenses), the verdict and the extracted fields, and writes nothing.
  - Skipped messages list with **Mark as expense**: the add sheet opens prefilled with the amount, and the SMS is marked overridden.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 748 tests · `test:db` ✅ (new `supabase/tests/ingest.sql`) · iOS + Android bundle export ✅.
- **AC1**: I ran the reference parser's own code on its 7 samples plus 9 more (one per rule). The port matches every result; the only intended difference is that an OTP SMS is now skipped as `otp`. Each reject rule has its own test.
- **AC2**: in the processor test, posting the same UPI SMS and the ref-less card SMS twice gives one expense each, and the second post returns `{duplicate: true}`. The database refuses a repeated `txn_ref` (23505).
- **AC3**: a forced parser error or a failing database write leaves the row in the inbox (attempts 1, last_error); the next run processes it.
- **AC4**: wrong, revoked or malformed tokens → 401 (code path tested). The app stores only `sha256(token)` and the last 4; a test checks the token appears nowhere in app state.
- **AC5**: quick-log writes a normal `water_log` row for the logical day, which the app pulls on its next sync. This needs the phone check below.
- Not checked from here: this container's network blocks `*.supabase.co`, so I couldn't call the deployed functions. The deploys themselves succeeded.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start`. A new package (`expo-clipboard`) is included.
2. More → **Integrations** → **Create token** → name it "iPhone Shortcuts" → **Copy** it (it's shown once).
3. Siri water: follow the "Siri · Log 500 ml" guide (copy the URL from the screen). Run the Shortcut, reopen LifeOS → Water shows +500 ml (AC5).
4. SMS: follow the "SMS automation" guide. Or, in Shortcuts, make a test "Get Contents of URL" POST with `{"text": "<paste the UPI debit sample>"}`. Money → Transactions shows HOT N SPICY ₹40 with an SMS tag. Post it again: no second row.
5. Parser Lab → tap the samples to see each stage; **Process now** empties the inbox.
6. Revoke the token and run the Shortcut again: it now fails (401).

**Known gaps**

- Gemini fallback for unmatched SMS is not built (`LATER.md`). Android in-app SMS reading is skipped because your phone is an iPhone.
- The deployed `_shared/ingest.ts` lacks one lint-comment line that the repo copy has; the code is the same. The next deploy brings them in line.

## F18 — Money: expenses, budgets and analytics · 2026-11-24 · done

**Built**

- **More → Money** `/money` (Money-Overview):
  - The month card shows spent of ₹18,000, a bar with an even-pace tick, "% spent · day N of M", "₹X left · ₹Y/day", and a "12% lower than October" badge from the same days last month.
  - Tiles for Today (spend, payment count) and Income this month.
  - "Last 14 days" bars with the average line.
  - The last 5 transactions, with links to Analytics (top category share) and Budgets (over/amber alerts).
- **Add expense** sheet (Money-AddExpense): big amount, keypad, category chips (Income makes it a credit), payment method (UPI default / Cash / Card / Other), payee, note, Today/Yesterday, Recurring. Amount → category → Save is three taps.
- **Transactions** `/money/transactions` (Money-Transactions):
  - Filters: All / Spent / Received, category chips, and search by payee, note or amount.
  - Rows are grouped by day with each day's spend and paged 15 at a time.
  - Swipe left → Delete with Undo; there are no confirm dialogs.
- **Analytics** `/money/analytics` (Money-Analytics):
  - Ranges: 7D / 30D / 90D / Month / All.
  - Spent / average payment / received tiles, and a month-over-month line.
  - Category share bars; tap one to open Transactions filtered to that category.
  - Daily spend bars (≤ 90 days) and weekday average per day (Monday first) with the weekend share.
  - Top 8 payees.
- **Budgets** `/money/budgets` (Money-Budgets):
  - The total card shows the pace tick, plus what the categories cover and what's unallocated.
  - Per-category bars turn amber at ≥ 80 % and red at ≥ 100 %, with "₹X left · N%" or "Over by ₹X".
  - **Edit** changes each category's budget and icon and the overall monthly budget.
- `money/lib`: `analytics.ts` (port of My-Tracker `useExpenseAnalytics`), `budget.ts`, `expense.ts` (keypad, filters port of `useExpenseFilters`, paging, day groups).
- Theme: a validated categorical chart palette (`colors.chart`) for the money categories.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 703 tests; `money/lib` 100 % lines, ≥ 92 % branches.
- **AC1**: spend totals count debits only and income is separate (lib and screen tests).
- **AC2**: I ran the reference hook's own code, unchanged, on a 15-row fixture with the clock frozen. Its output for all five ranges is stored in `__tests__/fixtures/reference-output.json`, and the port matches it exactly.
- **AC3**: tapping a category in Analytics opens Transactions with that category filter set (screen tests).
- Category palette passes the dataviz validator in both themes. `test:db` ✅ · iOS + Android bundle export ✅. No schema change.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` → More → **Money**.
2. **Add** → type 240 → Food & groceries → Save. It appears in Today, Last 5 and the 14-day bars.
3. Add an **Income** entry. It shows under Income, not in spend.
4. **All** → try Spent/Received, a category chip and a search. Swipe a row left → Delete → Undo.
5. **Analytics** → switch ranges and tap a category: Transactions opens filtered.
6. **Budgets** → Edit → change a budget or icon → Save. A category past 80 % turns amber; past 100 % turns red.

**Known gaps**

- Bank SMS import and quick-log are F19.
- Adding, renaming or deleting categories isn't built; budgets and icons are editable.
- Editing an existing expense isn't built; delete (with Undo) and re-add instead.
- Older dates than yesterday can't be picked in the add sheet.

## F17 — Tasks · 2026-11-24 · done

**Built**

- **More → Tasks** `/tasks` (Tasks-List design):
  - The header reads "N overdue · N due this week".
  - **Today's top 3** card shows "1 of 3 done".
  - **From yesterday's top 3**: unfinished picks are offered again with a "Top 3" button, never added automatically.
  - **Pending** is sorted by priority, then due date.
  - Overdue dates show in the danger colour, and only before the logical today.
  - **Completed** collapses and covers the last 14 days.
  - A priority legend sits at the bottom.
- **Quick add** (Tasks-QuickAdd): title, priority (default Medium), due date (Today / Tomorrow / the coming Saturday / Pick date from the next 4 weeks), and "Add to today's top 3".
- **Swap out of top 3** (Tasks-SwapTop3): adding a 4th asks which one goes back to pending. A done one is picked by default. "Keep top 3, add to pending" is the other way out.
- **Task options**: tap a task for Add to / Remove from today's top 3, or Delete. Delete has Undo. Ticking done has Undo.
- **Today card** (Today-0115pm): "Top 3 · N done" with checkboxes and "All N" → Tasks, shown from 09:00 to 18:00.
- **Migration** `20261124111550_task_top3.sql`: adds `task.top3_date` (which day it was a top pick) and a trigger that refuses a 4th open top-3 task for the same day. It is additive, already applied to the live project, and the types are regenerated.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 681 tests; `features/tasks/lib` 100% lines.
- **AC1**: the app asks to swap at 3 (screen test), and the database refuses a 4th (`supabase/tests/tasks.sql`, in `test:db` ✅).
- **AC2**: the sort unit test follows the reference order: priority weight 3/2/1, then due date (none last), then newest.
- **AC3**: ticking a top-3 task on Today updates the card at once (screen test).
- iOS + Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` → More → **Tasks**.
2. **Add** a few tasks with different priorities and due dates. Check that pending is sorted high → low, then by date, and that a past date shows red.
3. Tap a task → **Add to today's top 3**, three times. A 4th asks which one to swap out.
4. Between 9 am and 6 pm, Today shows the Top 3 card. Tick one there and it shows done straight away.
5. Tomorrow, unfinished picks appear under "From yesterday's top 3".

**Known gaps**

- There is no editing of a task's title, priority or date yet; delete and re-add instead.
- The design's "Before 6 pm" note needs a due time, which the schema doesn't have; due notes are day-level.

## F16 — Progress tab · 2026-11-24 · done

**Built**

- **Progress tab** (Prog-Tab design) replaces the F13 placeholder. It has one card per area; tap a card to open its detail screen.
  - **Weight** → `/weight`: 7-day avg, total change, 4-week sparkline of the 7-day average.
  - **Streaks** → `/streaks`: current, best and grace days used, with a 30-day mini heatmap in the Streaks screen's score bands.
  - **Food** → Food tab: 7-day average kcal (food + coffee) and protein, and the deficit vs TDEE (F13). Two 14-day bar rows for kcal and protein, each against its target line.
  - **Training** → Train tab: done / planned sessions this week and the change vs last week. 8-week bars of sessions per week (≥ 80 % complete) against this week's plan.
  - **Sleep** → `/sleep`: 7-day avg, change vs the week before, 14 nights of bars with the 7 h line.
  - **Water** → `/water`: 7-day avg, days the goal was hit out of 7, 14 days of bars with the goal line.
- Every card shows "—" and a one-line empty state, with no chart, when it has no data (AC1).
- `progress/lib/progress.ts` holds the pure maths: daily nutrition, logged-day averages, weekly sessions and water days.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅; `features/progress/lib` 100% coverage.
- **AC1**: test with an empty account; all six cards render their empty state.
- **AC2**: the heatmap cells for scores 92 / 75 / 40 / none land in the 90+ / 70–79 / < 50 / empty bands, the same banding as `/streaks`.
- Mini-chart colours checked with the dataviz validator: contrast vs surface passes in both themes. Each chart is one series in its own titled card, so the categorical checks don't apply.
- iOS + Android bundle export ✅. No schema change.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` → the **Progress** tab.
2. Each card shows your numbers, or "—" with a short note where there's no data yet.
3. The 30 squares on Streaks match the colours on the Streaks screen.
4. Tap each card: it opens Weight, Streaks, Food, Train, Sleep or Water.

**Known gaps**

- The design's "Five weeks in" summary card and the **Weekly review** button belong to F20 and aren't built yet.
- The "+8% vol" volume change in the design is shown as the sessions change vs last week; training volume is on the Train tab.

## F14 — Sleep and phone-off · 2026-11-24 · done

**Built**

- **Morning check** (Prog-Sleep card) on Today and the Sleep screen: from wake time until noon, until last night is logged. "Went to bed 10:00 pm, woke 5:10 am" (bed = profile sleep time, wake = now rounded to 5 min), duration and how it compares with the target. **Correct** saves it: open the app, tap once. **Adjust** opens the bed/wake sheet.
- **Night = the morning it ends** (AC1): bed 22:40 → wake 05:05 = 6.4 h on that morning's logical date; bedtimes after midnight stay on the same night.
- **Wake auto-tick** (AC2): logging a night that ended ≤ 15 min after the Wake block's time (05:15 for 05:00) ticks that block, unless it already has a log. Works from the morning check, Adjust and Today's end-of-day "Log sleep".
- **Phone away → `phone_off_kept`**: ticking the Phone away block on Today marks tonight's row (the next morning's `sleep_log`); un-ticking or Undo clears it.
- **Sleep screen** `/sleep` (Progress tab): tiles for 7-day avg, nights ≥ 7 h of 14, and bedtime spread "±N min" with average bedtime. The 14-night bar chart has a 7–8 h target band, tap-to-inspect and a table view. A bedtime consistency strip runs 9:30–11:30 pm with the target line, followed by "Average bedtime …, N min late. The 9:30 pm phone-away block was done on X of 14 nights."
- **Screen Time setup** `/settings/screen-time` (More, Sleep screen): step-by-step text for iOS Downtime and Android Bedtime mode, using the profile's phone-away and wake times. Text only; LifeOS makes no API calls here.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 659 tests; `features/sleep/lib` 100% coverage.
- AC1 and AC2 are unit tests; screen tests cover Correct, Adjust (late wake → no tick), the phone-away tick + Undo, the Sleep screen and Screen Time.
- iOS + Android bundle export ✅. No schema change.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start`.
2. Tomorrow after 5:00 am, open the app: the **Morning check** card is at the top of Today. Tap **Correct**. If you woke by 5:15 the Wake up block ticks itself.
3. Tonight tick **Phone away** on Today. Next morning, Progress → **Sleep** shows "done on 1 of 14 nights".
4. Progress → Sleep: tiles, bars and bedtime strip fill as nights are logged. Tap a bar to read it, or use **Show table**.
5. More → **Screen Time setup**: follow the steps for your phone.

**Known gaps**

- No sleep data from the phone or a watch. Bed time is your sleep time unless you adjust it; the design's "from phone-down and alarm" isn't possible without OS APIs.
- The charts haven't been looked at on a device yet.

## F13 — Body: weight and energy balance · 2026-11-23 · done

**Built**

- **Weigh-in sheet** (Prog-WeighIn): 0.1 kg stepper, −0.1 / last / +0.1 chips, the weigh-in checklist (after toilet · same scale · after a salty or late dinner → marked on the chart, A20), "7-day average becomes 88.4 kg (−0.6 vs last week)", Save with Undo. One per logical day — editing replaces it. Opens from the Weight screen and from Today's end-of-day "Log weight" (replaces F05's quick sheet).
- **Weight screen** `/weight` (Prog-Weight; More → Weight, Progress tab): 7-day avg / vs last week / total tiles; chart with faint daily dots, bold 7-day average, dashed trend toward the goal, dashed goal line labelled "Goal 75 kg", salty-dinner rings, tap a day to read it, **4W / 12W / All**; legend.
- **Projection** (`body/lib/projection.ts`, regression ported from Food-Tracker `prediction.js`): (a) trend over the last 28 days of 7-day averages → kg/week and the date to 75 kg; (b) intake: avg deficit of the last 14 logged days ÷ 7,700. "Not enough data" under 14 points; "Trend is flat or rising" when the slope ≥ 0.
- **Energy card** (Prog-Energy): BMR (Mifflin, latest 7-day avg, age = year − birth year), TDEE × activity factor (1.4), eaten today (food + 20 kcal coffees), deficit in zones < 300 Too small / 300–700 On target / > 700 Too aggressive with a one-line fix; shown after dinner is logged or from 21:00. **Check against the scale**: after 28 days with ≥ 20 weigh-ins and ≥ 20 food days, measured TDEE = avg intake + (−trend kg/day × 7,700) and the card switches to it.
- Progress tab now links to Weight and Streaks until F16 builds it.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 643 tests; `features/body/lib` 100% coverage.
- **AC1**: the app's 7-day averages for a test series equal `v_weight_trend`'s exactly (unit test + the same rows in `supabase/tests/views.sql`).
- **AC2**: projection hidden under 14 points; regression matches the reference implementation's slope/intercept for the same inputs (values produced by running the reference code).
- **AC3**: BMR 91 kg / 170 cm / 29 y / male = 1,833; 88.4 kg = 1,807; age from `birth_year`.
- Chart palette run through the dataviz validator for both themes (dark #3B82F6 / #059669, light #2563EB / #047857: all checks pass).
- `test:db` ✅ · iOS + Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` → More → **Weight** (or the Progress tab).
2. **Weigh in** → adjust, tick "salty dinner" if it applies → Save. Weigh in again today → it replaces the first one.
3. With fewer than 14 weigh-ins in 4 weeks the projection says "Not enough data"; after that it shows the trend date and the intake-based date.
4. After dinner is logged (or after 9 pm) the Energy card shows today's deficit and its zone.
5. Supabase SQL: `select date, weight_kg, avg7 from v_weight_trend order by date desc limit 7;` — the 7-day avg tile matches the latest `avg7`.

**Known gaps**

- The chart hasn't been looked at on a device yet; tell me if labels collide.
- The design's projection commentary ("The scale is ahead of your logs by ~250 kcal/day…") isn't generated.
- Weigh-in reminders already exist (F15, per `weigh_in_mode`).

## F12 — Progressive overload and exercise history · 2026-11-23 · done

**Built**

- **Overload rules** `src/features/train/lib/overload.ts` (PRD F12), from last session's sets of an exercise:
  - every working set hit `rep_max` → **+1 kg** (+0.5 kg under 10 kg), never past 20 kg;
  - already at **20 kg** (or bodyweight) → **+1 rep** past the range and "slow 3-second lowering";
  - **≥ 2 sets missed `rep_min`** → stay at the same weight;
  - otherwise (or timed exercises / no history) → nothing.
- **Chip in the set logger**: "Try 15 kg · Every set hit 12 last time at 14 kg." with **Apply**, which sets the steppers in one tap.
- **Exercise history** `/exercise/[id]` (Train-History): Best set (by est. 1RM), Est. 1RM (Epley `w × (1 + reps/30)`), 8-week change; **Best set trend** line chart (one series, tap a point for its date and set); **Sessions** table (date, every set, best set, volume). Opens from the exercise name in the logger and from the Exercise library.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 627 tests; `overload.ts` 100% lines.
- **AC**: unit tests for every rule branch — +1 kg, +0.5 kg under 10 kg (9.5 → 10), 19.5 → 20 cap, at 20 kg → +1 rep + slow lowering, bodyweight → +1 rep, ≥ 2 misses → same weight (1 miss → nothing), not every set at the top / a set missing → nothing, timed / no history → nothing.
- Screen tests: chip shows and Apply changes "14 kg × 12" → "15 kg × 12"; history tiles, table, chart point tap.
- `test:db` ✅ · iOS + Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start`.
2. After a session where every set of an exercise reached the top of its range, start the next session with it: a green **Try … kg** chip appears; **Apply** fills the weight.
3. In a session tap the exercise name (or Train → Exercise library → an exercise) → its history: tiles, the trend line (tap a point), the table.

**Known gaps**

- The chart hasn't been looked at on a device yet (only tested); tell me if labels collide.
- PRs on the session summary and a "bench best" tile on the Train tab (designs) aren't in the PRD's F12 scope and weren't built.
- The design's in-session hint ("You hit 12 reps on set 1. Try 15 kg for this set") isn't built: the PRD rule is per session, applied to the next one.

## F11 — Workout program and session logger · 2026-11-23 · done

**Built**

- **Train tab** (Train-Tab / WalkDay / RestDay designs): today's session card — "TODAY · 5:30 AM", title, "5 exercises · ~30 min · 17 sets", the numbered exercises with targets ("4 × 8–12", "3 × 30–45 s", "/ side"), **Start / Resume / done · 92%**; walk days "Done (30 min)"; rest days "Rest day — nothing to do"; before the program starts, "Program starts Mon 30 Nov". **Last 7 days** strip (done ✓ / missed ✕ / rest ☾ / today, "4 of 5 sessions · Thu missed"), tiles (this week's sessions, 7-day volume, 7-day sets), links to **Program** and **Exercise library**.
- **Session** `/session/[date]` (Train-Logger): opening it starts (or resumes) the day's session. Exercise strip (done / current / to do, tap to switch), "Exercise 1 of 5" + muscle, "Set 2 of 4 · 8–12 · rest 90 s", the cue, **Last time (Mon 16) 14 kg × 12 · 14 kg × 11**, weight stepper (0.5 kg below 10 kg, 1 kg above, max 20 kg per hand; "per side" for unilateral), reps stepper, **Log set 2 · 14 kg × 11**, the set list (done with time, Now, the rest with last time's numbers), "Next: …". Bodyweight exercises hide the weight.
- **Pre-fill** (AC1): each next set starts from the set you just logged; the first set from last time's same set; otherwise the plan's target.
- **Rest timer** (Train-RestTimer): ring countdown from timestamps, **+15 s**, **Skip rest**, Up next; it schedules a local notification "Rest over" for the end time (AC2), so it rings with the app in the background or killed. Reminder rebuilds (F15) no longer cancel it.
- **Timed exercises** (Train-Timed, plank): Start set → ring counts the hold → **Stop & log 42 s**.
- **Circuit** (Train-Circuit): "Round 2 of 4", round bars, the stations with ticks, weight per station, **Station done**; no rest between stations, the plan's rest between rounds.
- **Completion** = sets logged ÷ sets planned, kept current on every set: at **≥ 80 %** Today's workout block ticks itself (AC3). **Finish** → summary (Train-Summary): completion ring, "Workout block ticked on Today", volume / sets / time, per-exercise sets and %.
- Leaving mid-session keeps it open; reopening resumes where you left off (sets, rest timer and plank hold survive an app kill — they're timestamps, persisted).
- **Program** view (days, exercises, sets, time; today marked) and **Exercise library** (by muscle, equipment, cue, "per side").
- F15 follow-up: workout reminders now open `/session/<date>`.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 609 tests; `features/train/lib` 100% coverage.
- **AC1**: pre-fill from last time, then from the previous set (logic + session test: set 3 reads "15 kg × 11" after changing set 2).
- **AC2**: logging a set schedules the "Rest over" notification at the end time; +15 s reschedules, Skip cancels (session test with mocked notifications).
- **AC3**: 4 of 5 sets → completion 80 → Today's "Workout · Upper A" row is done (screen test across Session → Today).
- `test:db` ✅ · iOS + Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` → **Train**.
2. Today's card shows the session (if the program has started). Tap **Start**.
3. Log a set → the rest ring starts; lock the phone → it rings when rest ends (needs notification permission). Unlock → the next set is pre-filled with what you just did.
4. Close (✕) mid-session, kill the app, reopen → Train → **Resume** → you're on the right set.
5. Log ≥ 80 % of the sets → Today's workout block is ticked. **Finish** → summary.
6. On a walk day: **Done (30 min)**. On Saturday: the circuit rounds.

**Known gaps / left for later**

- F12 owns progression: "Try 15 kg" suggestions, personal records, "bench best" — not shown yet.
- Program editing (sets / reps / rest / swap exercise) is F23; the Program screen is read-only.
- The walk card has no step count or "indoor swap" (steps are F21).
- Rest notifications, like reminders, may need the development build if Expo Go doesn't deliver them.
- The summary's completion follows the PRD (sets), not the design's reps-based % ; the estimate uses 40 s per set plus rest, so it reads shorter than the design's mock "~55 min".

## F15 — Notifications · 2026-11-23 · done

**Built**

- **Schedule builder** `src/features/notifications/schedule.ts` (pure, tested): today's and tomorrow's local reminders from the day's template, profile, meal plan, program and logs —
  - wake ("Good morning · 500 ml water first.") and other block starts (Pack lunch box, Lights out…; water blocks are left to the water checks),
  - workout −5 min ("Upper A in 5 min") on strength / circuit days,
  - each meal ("Breakfast: Idli + Sambar + Boiled eggs"), **skipped once that meal has anything logged**,
  - water checks at 09:00, 10:30 … 19:30 (90 min apart), **only when you'd be ≥ 300 ml behind** with no more water; blunt copy per urgency (ported from My-Tracker `URGENCY_MESSAGES`),
  - phone away at phone-off time with today's score, and weigh-in 15 min after wake (daily, or on the weigh-in weekday).
  - Hard cap **10 per logical day**: lowest priority dropped first (water checks, then plain block starts). Past times are skipped; "Quiet today" mutes the whole day.
- **Kept in sync with the phone**: Today rebuilds the schedule whenever anything it depends on changes — app open, template / profile / meal-plan edits, logging water or a meal — and replaces the OS schedule (debounced, untouched when unchanged). Only with notification permission.
- **Tapping a reminder opens its screen** (Today, Water, Train, the meal), also when the tap launches the app. Unknown links are ignored.
- **More → Reminders** (Reminders design): Quiet today, "Today: 7 of 10 scheduled · 3 spare" with the cap explained, a switch per type (Block start, Water pace, Workout in 5 min, Meals, Phone away, Weigh-in), and "Reminders off — enable" when the OS permission is off. Switches live on this phone.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 587 tests; `features/notifications` 98% coverage.
- **AC1**: a Workday gives exactly 10 reminders in time order (wake 5:00, weigh-in 5:15, Upper A 5:25, breakfast 7:00, pack lunch 7:30, lunch, snack, dinner, phone away 9:30, lights out 10:00); water checks are what the cap drops.
- **AC2**: logging breakfast at 06:30 removes the 07:00 breakfast reminder (unit test + end-to-end through the Food tab).
- **AC3**: tapping a reminder pushes its screen (listener and cold start); bad links are ignored.
- `test:db` ✅ · iOS + Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start`. Make sure notifications are allowed (More → Profile → "Reminders off — enable", or More → **Reminders**).
2. More → **Reminders**: "Today: n of 10 scheduled". Switch off Meals → the count changes; Quiet today → 0.
3. In More → Routine, set a block a few minutes from now (e.g. Pack lunch box), go back to Today, lock the phone: the reminder arrives at that time; tap it → the app opens on Today.
4. Before a meal time, tap **Eaten as planned** for it on the Food tab → that meal's reminder doesn't fire.

**Known gaps**

- Expo Go: local reminders should work, but Expo Go warns that notifications are "not fully supported" (remote push was removed in SDK 53 — LifeOS uses only local ones). If they don't arrive, it needs the development build (planned around F11).
- The PRD's daily 03:05 background rebuild (BackgroundFetch) isn't built: it needs a native module that Expo Go can't load. The schedule covers today + tomorrow and is rebuilt every time the app opens, so it only runs dry if the app isn't opened for over a day.
- "Weekly review" (F20) and "Failure interrupt" (F24) reminders come with those features. Workout reminders open the Train tab until F11's session screen exists.

## F10 — Shopping list · 2026-11-23 · dropped at PTR's request

PTR decided not to build F10 ("I really don't want this feature"). Nothing in the build order depends on it.

- Removed the two F10-only parts that F08 had added to the dish editor: **Buy frequency** and **Shopping items** (UI, logic, tests). The dish editor now edits name, serving, kcal / protein / carbs / fat and the swap group.
- Kept the database columns `dish.buy` and `dish.shopping_items` untouched (dropping them would be a destructive migration on existing data). The app no longer reads or writes them; new dishes get the column defaults.
- Checks: `typecheck` ✅ · `lint` ✅ · `test` ✅ 569 · `test:db` ✅ · iOS bundle ✅.
- Next in the build order: **F15 (notifications)**.

## F09 — Off-plan food and coffee · 2026-11-23 · done

**Built**

- **Coffee chip** on the Food header (Food-Coffee design): "1/2" — **tap** +1, **hold** −1 (Undo). Grey under the limit, amber at it, red over it; over the limit it still logs, with a warning toast ("Coffee 3 of 2. Over limit — still logged.") and Undo. Each coffee adds 20 kcal / 0 g to the day's totals (PTR's coffee: black, half sugar — DESIGN_NOTES B3). A Coffee card under the meals says "2 of 2. That was the last one." and the rules (A22).
- **+ Off-plan** (Food-OffPlanSheet): what you ate (required), calories (100 / 250 / 500 chips or ±10 stepper), protein (optional), meal slot (Breakfast / Lunch / Snack / Dinner / Other; defaults to the meal on now or next), and **Replaces planned snack** (marks that meal's planned dishes as not eaten, so the plan stops counting them). Opens from the button under the totals or "Off-plan" on each meal card.
- Off-plan entries show **under their meal with an OFF-PLAN tag** (or in an **Other** card), count in the meal and day totals and insights, and can be removed with Undo. A meal replaced by off-plan food reads "Eaten · off-plan instead of the plan".
- `supabase/tests/views.sql`: 3 coffees → `v_daily_summary.coffee_count = 3` (a deleted one doesn't count); off-plan food is in the day's kcal / protein.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 569 tests; `features/food/lib` 99% coverage.
- **AC1**: off-plan entries appear in totals and under their meal marked off-plan (logic + screen tests, "Replaces" and "Other" included).
- **AC2**: the third coffee is logged with the warning (screen test) and `v_daily_summary.coffee_count = 3` (SQL test).
- `test:db` ✅ (rls, seed, views) · iOS bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` → **Food**.
2. Tap the ☕ chip three times: grey 1/2 → amber 2/2 → red 3/2 with "Over limit — still logged". Hold it → back to 2/2 (Undo restores). The kcal total rises 20 per coffee.
3. Supabase SQL editor: `select date, coffee_count from v_daily_summary order by date desc limit 1;` → 3 after three coffees.
4. Tap **+ Off-plan** → "Masala vada ×2", 250, protein 8 → **Add 250 kcal to Snack**: it appears under Snack tagged OFF-PLAN and the totals include it. The ✕ removes it (Undo brings it back).
5. Off-plan for Dinner with **Replaces planned dinner** on → Dinner shows Eaten with just your entry.

**Known gaps**

- The over-limit toast is the standard snackbar (dark), not the design's red-bordered card with "caffeine this late cuts into sleep"; F24 (nudges) can add the sleep-aware copy.
- Coffee times aren't listed anywhere yet (only the count); the coffee kcal isn't stored per entry (always 20).

## F08 — Food: meal plan, logging and swaps · 2026-11-23 · done

_M1's 7-day trial was skipped at PTR's request ("I don't have time to test it for 7 days"); M2 started straight after F07._

**Built**

- **Food tab** (Food-Tab design): "Eaten today" kcal and protein bars with the plan's pace tick ("what the plan says you should have eaten by now"), up to 2 insight chips, "Rest of plan lands the day at … kcal · … g", and the four meal cards — time, status (Eaten / Partly eaten / Now / Upcoming / Not logged), kcal + protein, each dish with a tick, its serving, "ate ½", a swap button where the group has alternatives, and **Eaten as planned** (one `food_log` per dish). Every change has Undo.
- **Meal detail** `/meal/[slot]` (Food-MealDetail): calories / protein / dishes-ticked tiles, each swap group with the chosen dish (tick), its alternatives with "+90 kcal / +6 g", and an **All / ¾ / ½ / None** portion picker per dish (kcal and protein scale; None keeps a 0 row).
- **Swap sheet** (Food-SwapSheet): alternatives with deltas and "Most protein", **Today only** or **Make default** (updates `meal_item.is_default`), "Breakfast becomes 724 kcal · 40 g. Day plan: 2,309 kcal (109 over)." Swapping an eaten dish rewrites its log; before eating, the choice is today's plan only.
- **Insights** `food/lib/insights.ts` (port of Food-Tracker `api/insights.js` with the PRD thresholds): kcal over target (danger), ≤ 200 kcal left before dinner (warning), protein < 70% after 16:30 (warning, suggests eggs / chicken / paneer / sundal), carbs > 55% of kcal (info), fat > 35% (warning); macro rules only above 200 kcal; max 2 chips, most serious first.
- **Meal plan editor** (More → Meal plan, or "Plan" on the Food tab; Food-PlanEditor): plan kcal / protein vs targets, every meal's dishes by swap group (default first, "swaps" mark), remove from meal with Undo, **Add dish**.
- **Dish editor** `/dish/[id]` (Food-DishEditor): name, serving, kcal / protein / carbs / fat with a 4/4/9 macro check ("Macros add to 334 kcal. Matches 330 within 2%"), swap group (pick or create), Save, Delete with Undo. (Buy frequency and shopping items were removed when F10 was dropped.) Changes apply from today on; past logs keep their stored kcal / protein.
- **Today**: meal rows show the plan's dishes; the NOW card for a meal block offers **Eaten as planned**, which ticks the block (auto-complete).

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 556 tests; `features/food/lib` 100% coverage.
- **AC1**: all four meals "Eaten as planned" → 2,219 kcal / 157 g (logic + Food tab test).
- **AC2**: Idli → Dosa at breakfast → +90 kcal, both as today's plan and on an eaten log.
- **AC3**: editing a dish's kcal only writes the dish; a past day's totals come from stored log values and don't change.
- **AC4**: unit tests at every insight threshold (2,200/2,201; 200 kcal; 70% at 16:29/16:30; 55%; 35%; 200 kcal macro floor; 2-chip cap).
- `test:db` ✅ · iOS bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` → **Food** tab.
2. Tap **Eaten as planned** on all four meals → about 2,219 kcal / 157 g; the red "… kcal over" chip appears (target 2,200). Undo works on each.
3. On a meal not yet eaten, tap the ⇄ next to Idli → Dosa → **Swap to Dosa**: breakfast goes up 90 kcal.
4. Open Lunch → tick dishes, set Ponni rice to ½ → the card says "ate ½" and the totals drop.
5. More → **Meal plan** → open Chicken curry → change Calories → Save. Yesterday's totals (Supabase `food_log`) keep the old number.
6. Today → during a meal time the NOW card offers **Eaten as planned**; the meal block ticks itself.

**Known gaps / left on purpose vs the designs**

- One meal plan for every day: the designs' Workday / Weekend / Rest day plan tabs and "Copy Workday plan" need a template ↔ plan link that isn't in the PRD schema (LATER.md).
- Coffee chip and "Off-plan" are F09; the shopping-cart button was F10 (dropped).
- "Make this the default" lives in the swap sheet, not as a toggle + Save at the bottom of meal detail.
- Dishes are added by creating them (from a meal); picking an existing dish from the library for another meal isn't built. Drag-to-reorder dishes isn't built.
- Dish serving is free text (the design's separate number + g/ml/pcs unit isn't in the schema).

## F07 — Water · 2026-11-23 · done

**Built**

- **Pace engine** `src/features/water/lib/pace.ts` (port of My-Tracker `reminderEngine.ts` steps 3, 6–9, on IST plan times): `expected = clamp((now − wake) ÷ (Water target block − wake), 0, 1) × target`, gap, urgency (low ≤ 200, medium ≤ 500, high > 500), suggested = round50(gap) clamped 50–500, status sleeping / goal_reached / on_track / behind; `validateAmount` (1–2,000 ml, whole numbers).
- **Stats** `lib/stats.ts` (port of `getStats`): current water streak (today in progress doesn't break it), best streak, 7-day average, the 7 days before today vs goal. Reads 90 days, so streaks aren't capped at 7 like the reference.
- **Water screen** (`/water`, Water design): ring with a white pace tick ("pace for 2:20 pm (1,750 ml)"), "1,600 ml left by 9:00 pm", behind banner "350 ml behind. Drink 350 ml now." with a one-tap button, +200 / +500 / +750, custom amount (50 ml steps or typed, inline error outside 1–2,000 ml), today's log (swipe left to delete with Undo, **Undo last**), streak / best / 7-day average tiles, last-7-days bars with the goal line.
- **Today**: water card (bar with pace tick, gap line, "+150 ml" catch-up, tap → Water screen); the floating **+200** water button (tap = +200 ml, hold = **Add water** sheet with 500 / 750 / custom and the pace line, Sheet-WaterAdd design). The NOW card's "Log 500 ml" uses the same path.
- **Goal hit**: crossing the target fires a success haptic + "Water goal hit · 3,000 ml" toast once per logical day (remembered on the phone).
- More → **Water** opens the screen. `Ring` gained an optional pace `marker` (additive).

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 502 tests; coverage 97% overall, `features/water/lib` 100%.
- **AC1**: wake 05:00, target 21:00, 3,000 ml → 1,500 ml expected at 13:00, 1,750 ml at 14:20 (unit + screen).
- **AC2**: gap 180 → low, suggest 200; gap 620 → high, suggest 500; plus 200/500 boundaries and the 50 ml floor.
- **AC3**: 0, 2,500, empty and fractional amounts show an inline error and disable Add.
- **AC4**: crossing 3,000 ml → one success haptic + toast; Undo and re-crossing the same day doesn't repeat it.
- `test:db` ✅ · Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start` (no new packages this time, but run it anyway as the habit).
2. **Today**: the Water card shows your total, the bar with a white pace tick, and "… behind. Drink … now." with a + button when you're behind.
3. Tap the round **+200** button → 200 ml logged with Undo. **Hold** it → Add water sheet → tap 500.
4. Tap the Water card (or More → Water): ring + pace tick, quick adds, type 2500 in Custom → red "At most 2,000 ml at a time." and Add is disabled.
5. Swipe a log row left → Delete → Undo brings it back.
6. Log enough to pass your target → a success buzz and "Water goal hit" once; later entries today just say "… ml logged".
7. The "Drink 500 ml" block on the timeline ticks itself once 500 ml is logged.

**Known gaps**

- Behind-pace notifications (only when ≥ 300 ml behind, DESIGN_NOTES A7) are F15.
- Entries don't record how they were added, so the log shows time + amount, not the design's "Quick add / Custom / auto" labels.
- Water ring colour stays water-blue rather than shifting as the % rises (My-Tracker `ProgressCircle`); the design uses the fixed gradient.

**Milestone M1 (Run the day: F04–F07) is complete.** Per PRD §12, PTR uses the app for 7 consecutive days before asking for M2 (F08 Food).

## F06 — Day scoring and streaks · 2026-11-23 · done

**Built**

- `src/features/today/lib/streak.ts` (100% covered): `classifyScore` (≥ 70 streak · 50–69 grace-eligible · < 50 or missing breaks), `computeStreak(dayLogs, today, todayScore)` → current (+ since), best (with date range), grace days used, grace available; heatmap bands, 30-day average, last break, per-block streaks. `computeScore` (F05 `selectors.ts`) is the PRD §4.2 score.
- **`day_log.score` and `is_streak_day` are kept true**: today's row follows the live score whenever a block (or water / food / session) changes; on app open, past days without a score — and yesterday if it has no day_log — are scored from that day's logs (`lib/finalise.ts`). Days that already have a score are never re-scored.
- **Today**: the score card's streak line "3-day streak · 1 grace left" / "· grace used Sat 21 Nov" → opens **Streaks**.
- **Streaks screen** (`/streaks`, Prog-Streaks design): Current / Best / Grace tiles, 30-day calendar heatmap (< 50, 50–69, 70–79, 80–89, 90+, grace dot, today outlined) with the 30-day average, "What broke the last one", "How streaks work".
- **Per-block streaks** in the routine editor: "Wake up · Habit · 10 min · 12 days" (2+ days in a row ticked).

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 482 tests; coverage 97% overall, `streak.ts` / `finalise.ts` 100%.
- **AC1** unit tests: perfect day; 69 vs 70; 49 vs 50; optional blocks ignored; skipped-with-reason excluded; empty plan = 100; a grace day keeps the streak; a second grace within 14 days breaks it; a grace day 15 days after the last is allowed (14 is not); < 50 breaks; a missing day_log breaks; today never breaks the streak.
- Screen tests: streak line, finalising yesterday and an unscored day from their logs, Streaks screen values, per-block streak.
- `test:db` ✅ · Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm start`. On **Today**, the score card now ends with the streak line (it starts at 0 or 1 — earlier days have no scores).
2. Tick blocks → Supabase `day_log` (today) shows `score` and `is_streak_day` changing with the ring (≥ 70 → true).
3. Tap the streak line → **Streaks**: tiles, the heatmap with today outlined, the rules card.
4. Tomorrow, open the app: yesterday's `day_log` keeps its score; the streak counts it if it was ≥ 70.
5. More → Routine → Workday: blocks you ticked two days running show "· 2 days".

**Known gaps**

- "What broke the last one" shows the date and score only; the design's pattern analysis ("late night → missed workout") belongs to F16/F20.
- The Progress tab (F16) will also link to Streaks; for now it opens from Today.
- Days before the first day_log aren't counted (nothing to judge before the app was used); days the app was never opened (other than yesterday) stay missing and break the run, as the PRD says.

## F05 — Today screen · 2026-11-23 · done

**Built**

- **Today tab** (Today 5:20 am / 1:15 pm / 9:30 pm designs): header "MON 23 NOV · 5 OF 11 DONE" + the time + template chip (opens Switch template); score ring card (day score = routine blocks; water and protein as sub-stats and rings); a **NOW card** for the current block (until-time, "Log 500 ml" on drink blocks, otherwise **Mark done**, plus **Skip**) or a **Next** card with a countdown; the **timeline** of the day's blocks.
- **Block states**: upcoming, current (highlighted, "NOW", "25 min left"), done (tick), skipped (grey, reason), due (just ended, "10 min late"), overdue (red, from 30 min after the end). Next block gets a "Next" pill. Three or more finished blocks at the top fold into "6 done · Wake → Lunch".
- **Tap** = done / not done with haptic + Undo snackbar; tapping an auto-done block explains instead. **Long-press** = skip sheet (Sheet-SkipBlock design): Sick / Travel / Rest / Other, **Move to tomorrow** for workout blocks (today's session moves to tomorrow, the rest of the week shifts, Sunday's rest absorbs it — stored as `session_override` rows), and **Unskip**.
- **Auto-complete**: drink blocks from logged water ("auto: 500 ml at 5:12 am"), the Water target block from the day's total, meal blocks when something is eaten in that slot, the workout block from a session ≥ 80% (or a rest day). They can still be ticked by hand.
- **Inline info**: meal rows show the plan's default dishes + kcal (or what was eaten); the workout row shows "Workout · Upper A · 5 exercises · 60 min"; optional blocks say "Optional".
- **End-of-day card** from phone-off time (replaces the NOW card): "78%. 3 things left." with the open blocks, "Weight not logged", "Sleep not logged", and **Log weight** / **Log sleep** / **Note** (quick sheets writing `weight_log`, `sleep_log` for last night, `day_log.note`).
- After midnight the app still shows the previous logical day; at 03:00 it rolls over within 30 s (clock refreshes every 30 s and on returning to the app).
- Logic (`src/features/today/lib`, `selectors.ts`): `currentBlock`, `blockState`, auto-complete rules, `computeScore` (PRD §4.2), move-to-tomorrow, row copy — all pure and tested.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 458 tests; coverage 97% overall, every `lib/` and selectors file ≥ 90%.
- **AC1**: tapping Wake → ring goes 0% → 9% at once, the write sits in the offline queue; Undo removes it (screen test).
- **AC2**: 500 ml logged at 05:15 → "Drink 500 ml water" done ("auto: 500 ml at 5:15 am"), score 1/11 (logic + screen tests).
- **AC3**: current block checked at 13 times from 04:59 to 22:15 plus after midnight (time-fixed selector test).
- `test:db` ✅ · Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm start`, open in Expo Go → **Today** tab.
2. The header shows today's date, "n OF 11 DONE" and the current time; the NOW card shows the block running now (or what's next).
3. Tap **Wake up** in the timeline → tick, ring jumps, snackbar with Undo. Turn on airplane mode, tick another block, kill and reopen the app → still ticked; back online it syncs (`block_log` rows in Supabase).
4. During "Drink 500 ml" (5:10–5:40) tap **Log 500 ml** — or at any time use More → Developer → Queue 200 ml water ×3 — the drink block ticks itself.
5. Long-press **Workout** → Skip · Sick with **Move to tomorrow** on → the block greys out, the score's denominator drops to 10, `session_override` rows appear for tomorrow…Sunday. (Move to tomorrow only shows once the program has started — its start date is the Monday on/after onboarding — and never on Sundays.)
6. Template chip → switch to Rest day → the workout block disappears from today.
7. After your phone-off time (9:30 pm) the End-of-day card appears; try Log weight / Log sleep / Note.

**Known gaps / left on purpose vs the designs**

- Score is shown but not yet saved to `day_log.score`, and the streak line ("12-day streak · 1 grace left") is missing — both are F06 (next).
- Not built yet (later features): water card + "+200" button (F07), calories / protein / coffee tiles and "Ate as packed" (F08/F09), Top 3 tasks (F17), the "3 blocks overdue" interrupt and phone-away banner (F24), the Next-workout card with exercise chips and "Start" (F11), "vs yesterday" / 7-day average on the end-of-day card (F06/F16).
- Reminders are still F15.
- Weight and sleep sheets are minimal quick logs; F13 / F14 build the full screens.

## F04 — Routine templates and editor · 2026-11-23 · done

**Built**

- **Routine** (More → Routine; Routine-Templates design): week strip (which template runs each weekday, distinct letters W/E…), legend, one card per template ("Mon–Fri · 12 blocks · 5:00 am – 10:00 pm", **Active today** on today's), **+ New**, **Switch today's template**, a warning banner when two templates claim the same weekday ("Sat is claimed by … — X (last edited) wins"), and an Archived list with Restore.
- **Template** screen (Routine-Blocks design): blocks in time order with time, kind icon and "Meal · 30 min" / "Water · auto" / "· optional"; **Add block**; **Reorder** mode (↑/↓ swaps a block's time with its neighbour — times are absolute); a Template card to rename, pick the weekdays it runs on, **Duplicate** (copy with no weekdays), and **Delete** (with confirm + Undo) — or **Archive** when a day in the last 7 days used it; your only template can't be removed.
- **Block sheet** (Routine-BlockEdit design): title, kind (Habit / Water / Workout / Meal / Sleep / Task → PRD kinds, wake and phone-off kept), start (wheel, 5-min steps), duration, meal slot B/L/S/D for meal blocks, Notify at start, Optional (never counted). Save / Delete with Undo.
- **Switch template** sheet (Sheet-SwitchTemplate design): pick a template, **Today only** (stores `day_log.template_id`) or **From now on** (also gives today's weekday to it), "Switching now: n blocks left today change".
- Logic in `src/features/routine/lib/` (99% covered): which template a date runs (manual switch > weekday, last edited wins > default; archived never matches a weekday), the date's plan + counted blocks (score denominator) + block reminders (F15 will schedule them), every write planned as pure data. New rows get a client-made `id` so blocks can be added to a template that hasn't synced yet.
- Migration `20261123130835_routine_template_archived_at.sql` (adds `routine_template.archived_at`, additive) — applied to the live project, types regenerated.
- New `src/ui`: `Toggle`, `MenuRow`; `Screen` gained `back` / `action`, `Sheet` gained `accessory`.

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 399 tests; coverage 97% overall, `features/routine/lib` 99.6%.
- **AC1**: editing Workday's 05:30 block to 05:45 queues exactly one write (`start_time`), tomorrow's plan shows 5:45 and its reminder moves to 05:45 IST; no other block or log row is touched (logic + screen tests).
- **AC2**: switching today to Rest day stores it on today's `day_log`, today's plan drops the workout from the counted blocks (11 → 10) and tomorrow is unchanged (logic + screen tests).
- `test:db` ✅ · Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm start`, open in Expo Go.
2. More → **Routine**: Mon–Fri show W, Sat–Sun show E; Workday (or Weekend at the weekend) says **Active today**.
3. Open **Workday** → tap **5:30 am Workout** → set the start to 5:45 → **Save block** → the list shows 5:45 am. In Supabase `routine_block`, only that row changed.
4. Back on Routine → **Switch today's template** → **Rest day** → **Switch to Rest day** → Rest day is now Active today; Supabase `day_log` (today) has `template_id` = Rest day's id. (Today's score itself arrives with F05.)
5. Open **Rest day** → **Delete** is replaced by **Archive** (today used it). Try **Duplicate** on Weekend, toggle a weekday, rename, add and delete a block (Undo brings it back).

**Known gaps / left on purpose vs the designs**

- Today's timeline and score are F05; reminders are scheduled in F15 (the reminder times are already computed).
- Reorder is ↑/↓ buttons, not drag (drag in LATER.md).
- Not built from the designs: the "Walk moved to 8:30 pm" banner (weekly review, F19), "No meal plan linked" (no such link in the PRD schema — LATER.md), the third description line in the switch sheet, and the notification preview copy in the block sheet (shows "Reminder at 1:00 pm." instead).
- Routine opens as a full-screen page without the tab bar (like Settings → Profile); the design shows the tab bar.
- Template name/weekdays are edited on the template screen (no design for it).

## F03 — Onboarding and profile · 2026-11-23 · done

**Built**

- **Onboarding** (`/onboarding/1…4`, designs Onboarding 1–4): Body (height, current weight, goal weight; to-lose / BMI / "≈ 32 weeks (early Jul 2027)" at 0.5 kg/week), Day (wake, sleep, phone-off on one time picker; sleep-window line; blocks Continue if wake = sleep, the night is under 4 h, or phone-off is more than 4 h before sleep), Targets (water, kcal, protein, coffee prefilled from the seed; maintenance estimate and "~350 kcal deficit ≈ 0.3 kg/week" banner with a one-tap "Use 2,000"), Notifications + summary ("Allow notifications" / "Not now"). Back / dots / "n/4" header; the in-progress answers survive an app kill.
- **Finishing** (AC1) writes through the sync queue: profile fields that changed + `start_weight_kg` + `onboarded_at`; today's `weight_log`; today's `day_log` with today's template (Workday/Weekend/Rest by weekday); wake block moved if wake changed; program `start_date` = first Monday on/after today. Then lands on Today.
- **Routing gate**: signed in + `onboarded_at` empty → onboarding; else tabs. Uses the queued profile write, so it works offline and doesn't bounce back to onboarding before the push lands.
- **Settings → Profile** (`/settings/profile`, opened from the new profile card at the top of More): the same three sections, a Reminders card ("Reminders off — enable" → asks the OS, or opens system Settings after a "Don't allow" — AC2), Save ("No changes" when nothing changed) → snackbar "Profile saved". Changing **wake time updates only the `wake` block in every template** (AC3); sleep / phone-off don't move blocks. A new current weight logs today's weight (re-using today's row if any).
- First data reads: `src/features/profile/api.ts` (RTK Query: profile, routine, today's day_log / weight, latest weight, active program), cached offline (RTK Query cache persisted), merged with unsynced queued writes so the UI shows your edits immediately. A short "recently pushed" overlay hides the gap between a push and the next read.
- Pure logic with tests: `features/body/lib/energy.ts` (Mifflin BMR, TDEE, BMI, 7,700 kcal/kg), `features/profile/lib/{targets,plan,gate}.ts`, `features/routine/lib/templates.ts` (which template a date uses). `src/ui/InlineStepper`. `src/lib/notifications.ts`.
- Fixes found by the new tests: the onboarding draft could be re-created right after finishing; Settings could re-log an untouched weight; the Redux store's state type had silently become `any` since F02 (redux-persist + thunk extra argument) — now fully typed (`src/store/rootReducer.ts`, `syncPersist.ts` split out).

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 338 tests; coverage 97% statements, every `lib/`, selectors and slice file ≥ 90%.
- AC1 / AC2 / AC3 each have screen tests (`OnboardingScreen.test.tsx`, `ProfileSettingsScreen.test.tsx`) plus pure tests in `plan.test.ts`.
- `test:db` ✅ · Android bundle export ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm install`, `npm start`, open in Expo Go, sign in. Your profile has no `onboarded_at` yet, so onboarding opens.
2. Step 1: change current weight (e.g. 90.8). Step 2: tap Wake, set 5:15 am. Step 3: try "Use 2,000". Step 4: tap **Not now** → you land on Today.
3. More → the card at the top ("ptr · 90.8 → 75 kg · day 1 · single account") → **Profile**: the Reminders card says **"Reminders off — enable"** (AC2). Tap it to allow notifications → "Reminders on".
4. In Profile change Wake to 5:30 am → **Save** → "Profile saved".
5. Supabase → Table Editor: `profile.onboarded_at` set and `wake_time` 05:30; `weight_log` one row for today; `day_log` one row for today (AC1); `routine_block` where `kind = 'wake'`: 3 rows (one per template) at 05:30, all other blocks unchanged (AC3); `workout_program.start_date` = next Monday.
6. Kill the app and reopen → goes straight to Today (no onboarding again).

**Known gaps / left on purpose vs the designs**

- Today, Routine etc. are still placeholders (F04/F05), so "lands on Today" lands on the placeholder tab.
- The permission is only asked; reminders are scheduled in F15.
- Coffee hint says "Max 10 a day" (PRD cap) where the design says 8; summary on step 4 is a plain list rather than the design's illustration card; no avatar photo (initial letter only).
- Height/weight are steppers (design), no free typing; birth year, sex and activity factor keep their seeded values (not in the PRD's 4 steps).

## F02 — Offline storage and sync engine · 2026-11-23 · done

**Built**

- `src/lib/sync.ts` (pure, 100% covered): write queue `{client_id, table, op: upsert|soft_delete, row, attempts, next_try_at, …}`; collapse rules (two edits → one merged upsert; deleting a row that never reached the server drops both; deleting a synced row replaces its pending edit); backoff 1 s → 5 s → 30 s → 2 min → 10 min, then every 10 min; dead-letter after 20 attempts (or at once for errors the server will always reject, e.g. a check constraint); `mergeByClientId` (server rows + unsynced local rows, PRD §3.2).
- Sync slice + worker: optimistic `queueUpsert` / `queueSoftDelete` (every write gets a `client_id`, pushes immediately when online), `runSync` pushes oldest-first with `upsert(..., { onConflict: 'client_id' })` (idempotent), soft deletes set `deleted_at` to the moment of deletion. Worker runs at launch/sign-in, on foreground, on NetInfo reconnect (which also clears network-only backoff) and every 60 s while open.
- The queue is persisted on its own key (MMKV in builds, AsyncStorage in Expo Go) and survives app kills; writes are tagged with their owner — signing out keeps them on the phone (Settings design) and only that account ever pushes them.
- More: sync card from the More-Menu design ("Synced 2 min ago · 0 pending" + Sync; "Offline · n pending"; "Sync issue · n failed" + Retry) and a red dot on the More tab when something failed. Dev-only card: "Queue 200 ml water" to test sync before F07 exists.
- `src/lib/dates.ts` (IST, logical day from 03:00, weeks from Monday) and `src/lib/ids.ts` (UUID v4 client ids).

**Checks run here**

- `typecheck` ✅ · `lint` ✅ · `test` ✅ 35 suites / 263 tests; coverage `src/lib` 100% lines, `features/sync` 98%.
- **AC1** integration test: airplane mode → 5 water entries → app "killed" (new store rehydrated from storage) → reconnect → exactly 5 rows on the (fake) server, plus a lost-acknowledgement retry that still yields 1 row. Turning off queue persistence makes this test fail (checked).
- **AC2**: after long offline backoff, the reconnect event makes everything due at once → pending 0 on the first run (well inside 60 s).
- `test:db` ✅, iOS + Android bundles ✅.

**How PTR verifies on the phone**

1. `git pull`, `npm start`, open in Expo Go, sign in.
2. More → the sync card at the bottom says "Not synced yet · 0 pending" (or "Synced …").
3. Turn on **airplane mode**. More → Developer → **Queue 200 ml water** five times → card: "Offline · 5 pending".
4. Swipe Expo Go away (kill it), reopen the project → still "5 pending".
5. Turn airplane mode off → within a few seconds (≤ 60 s) the card shows "Synced just now · 0 pending".
6. Supabase → Table Editor → `water_log`: exactly 5 rows of 200 ml for today. (They're real entries; delete them in the Table Editor if you like — F07's water screen will also be able to.)

**Known gaps**

- No feature reads data yet (F04+), so the merge selector is only exercised by tests; RTK Query endpoints arrive with the features.
- Tables with a per-day unique key (`day_log`, `weight_log`, `sleep_log`, …): features must reuse that day's row `client_id` when editing, otherwise a second device's row would be rejected (dead-lettered as a conflict). Each feature handles this when it adds its writes.
- "Last synced / Pending: n" live on the More card; the PRD's Settings screen (F23) will show the same.
- Expo Go uses AsyncStorage: a write is saved a few ms after the tap (MMKV in dev builds is synchronous).

## F01 — Supabase, auth, schema and seed · 2026-11-23 · done

**Built**

- `supabase/migrations/`: every table in PRD §5 (30 tables) with per-user RLS (`user_id = auth.uid()`), `updated_at` triggers, `client_id` (unique, for offline upserts) and `deleted_at` on all user tables, `(user_id, date)` indexes on every log table, PRD unique keys (one `day_log`/`weight_log`/`sleep_log`/… per day, `expense (user_id, txn_ref)`), and the three views `v_daily_summary`, `v_weight_trend` (7-day trailing average), `v_weekly_rollup`, all `security_invoker` so RLS applies.
- `seed_defaults()` RPC with the full PRD §6 seed: profile (170 cm, 91 → 75 kg, 3,000 ml, 2,200 kcal, 150 g …), Workday/Weekend/Rest day templates (Workday = 11 counted blocks, Evening walk optional + silent), "Fixed Day v1" (27 dishes, swap groups; defaults = 2,219 kcal / 157 g protein), "Dumbbell Beginner 5-Day" (7 days, 25 exercises, nothing needing a barbell/cable/machine) and the 6 + Income expense categories. Idempotent; the app calls it after each sign-in.
- App: Supabase client (anon key only) with the session in chunked `expo-secure-store`, auto-refresh only in the foreground; auth slice (restore at launch, sign in, dev-only sign-up, forgot password, sign out); Sign-in screen from `design/screens/SignIn(-Dark).png` (+ `TextField` in `src/ui`); routes guarded with `Stack.Protected` (signed out → sign-in, signed in → tabs); the splash stays up until the session is restored; More → Account (email + Sign out).
- Supabase project **`lifeos`** (ref `tjuemwpagjougmyfbszd`, Mumbai ap-south-1) created; all 4 migrations applied (local files renamed to the remote versions, so `supabase db push` stays in sync). `myTracker` was paused (data kept) to stay within the free plan.
- `src/types/supabase.ts` generated from the migrations (`npm run gen:types`); cross-checked against the official `supabase gen types` output of the live project (same 30 tables, 3 views, 8 foreign keys, nullability and function signatures).
- New scripts: `npm run test:db` (applies migrations to a throwaway local Postgres and runs `supabase/tests/*.sql`), `npm run gen:types`.

**Checks run here**

- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` ✅ 27 suites / 169 tests (auth slice, offline restore, chunked SecureStore, Sign-in screen, Supabase client wiring); coverage `src/lib` 97%, `features/auth/lib` 100%.
- `npm run test:db` ✅ on Postgres 16 + a Supabase auth shim: **AC2** `rls.sql` (user B sees 0 rows in every table and view, can't update/delete A's rows, can't insert rows owned by A; anon sees nothing and can't seed). I also broke RLS on purpose (RLS off on one table; a view without `security_invoker`) and the test caught both. **AC3** `seed.sql` (second run creates nothing; counts and seed values match PRD §6).
- `expo export` for iOS + Android ✅. Sign-in screen rendered on web and compared with the design PNG.

**Checks on the live project** (`lifeos`)

- `rls.sql` ✅ and `seed.sql` ✅ run against the real database (rolled back; afterwards 0 test users, 0 profiles left). All 30 tables have RLS on.
- Security advisor: one warning (helper function without a fixed `search_path`) fixed by migration 4 → **no findings**. Performance advisor: only "unused index" notices (expected on an empty database).

**How PTR verifies on the phone**

1. `.env` in the repo root (it is git-ignored):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://tjuemwpagjougmyfbszd.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xr_XmzBZdp8YBT6mcVfoRw_JiT6cH8X
   ```
   (the publishable key is public by design; never put the service-role key here)
2. Create your account once: Supabase dashboard → project `lifeos` → Authentication → Users → **Add user** → email + password, tick **Auto Confirm User**. Then Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. `npm start`, open in Expo Go: the app shows **Sign in**. Wrong password → "Email or password is wrong."
4. Sign in → lands on Today. In Supabase → Table Editor, `routine_template`, `dish`, `exercise` etc. now hold your seed rows.
5. **AC1:** kill the app and reopen → still signed in, no sign-in screen. Airplane mode + reopen → still opens (More → Account says "Offline").
6. More → Account → Sign out → back to Sign in.

**Known gaps**

- Public sign-ups are still **on** in the new project until PTR turns them off (step 2); there's no MCP tool for auth settings.
- `src/types/supabase.ts` comes from the local generator (this environment can't run the official CLI); `npx supabase link --project-ref tjuemwpagjougmyfbszd` then `npx supabase gen types typescript --linked` gives the same file on the laptop.
- 7 `(user_id, date)` indexes duplicate a unique constraint's index (harmless; dropping them is a destructive migration, logged in LATER.md).
- No live sign-in was run from here: this container's network can't reach the Supabase API. The SQL tests ran on the live database through the Supabase tools.
- Forgot-password emails a Supabase reset link that opens in the browser (no in-app reset screen; not in the PRD).
- Cross-user FK references (a row pointing at another user's plan uuid) aren't blocked by a trigger; RLS still hides the other user's rows. Fine for a single-user app.
- Placeholder bundle id and icon (from F00).

## F00 — Project scaffold · 2026-11-22 · done

**Built**

- Expo SDK 58 app (React Native 0.88, TypeScript strict + `noUncheckedIndexedAccess`), Expo Router with 5 tabs (Today, Food, Train, Progress, More) behind a custom floating pill tab bar. Each tab is an empty screen with a one-line "arrives in Fxx" state.
- Theme system `src/ui/theme.ts`: every PRD §7.2 token in dark + light, plus hairline/border/ring-track/tab-bar/scrim/inverse tokens and gradients from the component sheets; spacing 4–32, radius 12/16/24/999, type scale 48→11, motion tokens. `ThemeProvider` with System / Light / Dark, **default Dark**, persisted.
- Fonts: Plus Jakarta Sans 500–800 + Inter 400–700, bundled via `@expo-google-fonts` (8 files), tabular figures on numbers.
- `src/ui` components (each with tests and required accessibility labels): Button (6 variants, 3 sizes), Card, StatTile, Ring + TripleRing, ProgressBar with pace marker, Sheet, Chip + StatusChip, SegmentedToggle, Banner, Checkbox, ListRow (checkbox + swipe done/tomorrow/delete), Fab (water, ripple + long-press halo), EmptyState, Snackbar + `useSnackbar` (5 s undo), NumberStepper, TimePicker (wheel), TabBar, Screen, Text. All animations go through Reanimated and switch off under Reduce Motion.
- Redux Toolkit store + RTK Query `baseApi` (no endpoints yet) + redux-persist over `src/lib/storage.ts` (MMKV in builds, AsyncStorage in Expo Go).
- `src/lib/format.ts`: Indian digit grouping, ₹, 12-hour clock ↔ 24-hour storage.
- Tooling: ESLint (expo + typescript-eslint, bans `any`, hard-coded colours and `toISOString().slice`), Prettier, Jest + RNTL, Maestro smoke flow `e2e/smoke_tabs.yaml`, EAS `development` + `preview` profiles, scripts `start`, `typecheck`, `lint`, `test`, `test:watch`, `e2e`.
- Dev-only **component gallery** (More → Open gallery) showing every component with the mock data from the component sheets.

**Checks run here**

- `npm run typecheck` ✅ · `npm run lint` ✅ (ESLint + Prettier) · `npm test` ✅ 19 suites / 98 tests; coverage 100% lines on `src/lib` and `src/store`, 98% overall.
- `expo export` bundles for iOS and Android ✅ (8 fonts included).
- Rendered on web in headless Chromium (393×852) and compared with `design/screens/Components-1/2(-Dark).png` and `Main.png`: tokens, type, buttons, chips, banners, tiles, list rows, stepper, wheel, rings, pace bars, FAB, sheet and tab bar match in both themes. Not yet run on a physical phone (none attached to this environment).

**How PTR verifies on the phone**

1. Install **Expo Go** from the App Store / Play Store (it must support SDK 58).
2. On the laptop: `git checkout claude/tender-ramanujan-f9ipfv && npm install && npm start`.
3. Scan the QR code (iPhone: Camera app; Android: Expo Go → Scan). Phone and laptop on the same Wi-Fi; otherwise `npx expo start --tunnel`.
4. Check:
   - The app opens on **Today**, dark theme, 5 tabs in a floating bar; tapping each tab switches screens with a haptic tick.
   - **More → Theme**: Light and System change the whole app; kill and reopen the app and the choice is kept (AC1).
   - **More → Open gallery**: compare with `design/screens/Components-1-Dark.png` / `Components-2-Dark.png` (and the light PNGs after switching theme). Try: swipe a task row right (done) and left (Tomorrow / Delete), the steppers, the time wheel, "Show snackbar" (Undo, disappears after 5 s), "Open sheet" (tap outside to close), tap and long-press the water FAB.
   - iOS Settings → Accessibility → Motion → Reduce Motion on: rings/bars appear without animation.
5. `.env` stays untracked: `git check-ignore .env` prints the rule (AC3).

**Differences from the PNGs left on purpose**

- Shadows are one layer (iOS) / elevation (Android) instead of the CSS dual ambient shadow + inset hairline; the hairline is a 1 px border.
- Rings have no soft glow (`drop-shadow` has no React Native equivalent) and no count-up of the centre number yet (comes with F05's day score).
- Time-picker minute wheel doesn't loop (the PNG shows 50 / 55 above 00).
- The sheet slides in but closes without the slide-out (the Modal unmounts first) and has no drag-to-dismiss yet; close via the scrim or Android back / VoiceOver escape.
- Backdrop blur is weaker on Android (expo-blur limitation).
- Icons are Lucide equivalents of the design's icons.

**Known gaps**

- Not tested on a real device or with Maestro here (no device or Maestro CLI in the cloud container). EAS builds not run (need PTR's Expo account).
- `fontVariant: tabular-nums` on Android depends on the font's `tnum` table: check numbers line up in the gallery stat tiles.
- MMKV is only active in dev/preview builds; Expo Go uses AsyncStorage (see DECISIONS.md).
- Placeholder app icon/splash (Expo defaults) and bundle id `app.lifeos.ptr`.
- Open questions from `REFERENCE_NOTES.md` (todo sort order, weight-trend insight, golden fixtures) still default as proposed until PTR answers.

_Next: F22 (Home-screen widgets, optional). Waiting for PTR's "next"._
