# Progress

One entry per feature, newest first: feature ID, what was built, how PTR verifies it on the phone, known gaps.

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

_Next: F06 (day scoring and streaks). Waiting for PTR's "next"._
