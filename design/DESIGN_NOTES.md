# Design ↔ PRD decisions

The designs were checked screen by screen against `PRD.md` v1.1. They're consistent and complete for F00–F24 except F21 (Steps). Below is every place where they disagree. **This file is final.** `PRD.md` v1.2 has already been updated to match.

General rule: **designs win on visuals, layout, copy and new UX details. The PRD wins on data, formulas and seed values.** Numbers shown in the designs (kcal, grams, exercises, streak counts, money) are mock data, not specs.

## A. Design wins (PRD updated)

| # | Topic | Design | Was in PRD | Decision |
|---|---|---|---|---|
| A1 | Colour tokens | Slate/cobalt palette, see `screens/Main.png` | #0E1116-based palette | **Use the design tokens** (PRD §7.2 replaced). |
| A2 | Fonts | Plus Jakarta Sans (display, numbers) + Inter (body), tabular figures | System font | Use them, bundled with `@expo-google-fonts/*` (no network fonts). |
| A3 | Radius / type scale | 12 buttons, 16 cards, 999 chips; 48/36/28/20/16/14/12 | 12 cards | Use the design scale. |
| A4 | Streak rule | Day counts at **≥ 70%**. Score 50–69 can use **1 grace day per rolling 14 days**. **< 50 breaks** the streak. | ≥ 80%, any single miss is grace, 2 in a row break | **Use the design rule.** It's on 8 screens (Streaks, Recovery, Fallback, Today header). |
| A5 | Weekly grade bands | "Good 80–89%" | Good ≥ 70 | Excellent ≥ 90 · Good 80–89 · OK 70–79 · Needs work < 70. |
| A6 | Water pace window | Pace runs 5:00 am → 9:00 pm (water-target block) | wake → sleep | Pace runs from `wake_time` to the **Water target block time** (default 21:00). |
| A7 | Water reminder threshold | "Only when 300 ml+ behind" | urgency-based | Notify only when gap ≥ 300 ml; urgency bands stay for copy. |
| A8 | Failure interrupt trigger | "3+ blocks overdue", full red card, "Not now (snooze 15 min)" | Checkpoints at 11/15/19 | Trigger when **≥ 3 blocks are overdue**. Snooze 15 min. Max 3 a day. |
| A9 | Fallback actions | Each action shows "+N pts"; completing all lifts the score into grace range | 4 actions, no points | Show the real score gain each action would add (computed, not hard-coded). |
| A10 | Reality check | Second option "It's water (new workout, salty meals)"; primary "Strict week: weigh food for 7 days" | Single honesty checklist | Add both buttons. "Strict week" sets a 7-day flag that shows a "weigh it" hint on each meal. |
| A11 | Partly-eaten portions | Portion picker All / ¾ / ½ / None per dish; "ate ½" on Food tab | per-dish tick only | Add `food_log.portion` (1, 0.75, 0.5, 0). |
| A12 | Energy model | TDEE = BMR × 1.4; target zone 300–700 kcal; "Check against the scale" (measured TDEE after 4 weeks) | ×1.2 + steps + workout; 250–750 | TDEE = BMR × **1.4** (editable activity factor). Zones: < 300 too small, 300–700 on target, > 700 too aggressive. After 28 days of weights + food logs, show **measured TDEE** = avg intake + (trend kg/day × 7,700) and use it. |
| A13 | Overall budget | Total ₹18,000 plus category budgets; unallocated amount | Category budgets only | Add `profile.monthly_budget_inr` (default 18,000). |
| A14 | Expense categories | Food & groceries, Bills, Transport, Health, Shopping, Other (+ Income) | 12 categories | Seed the design's 6 + Income. More can be added in Budgets → Edit. |
| A15 | API ingest shapes | `POST …/ingest/sms {"text": …}`; Siri `POST …/water {"ml": 500}`; tokens `lifeos_pat_…`, only last 4 kept visible | `{sms, received_at}`, `{type, amount_ml}` | Use the design shapes. The URLs are the **real Supabase Edge Function URLs** (`https://<project>.supabase.co/functions/v1/ingest-sms`, `/functions/v1/quick-log/water`), not `api.lifeos.app`. Setup guides show the real URL from config. |
| A16 | SMS reject rules | Skipped list shows "OTP · ignored" and "Promo · ignored" | No OTP rule | Add an **OTP** reject rule ("OTP", "one time password", "do not share"). |
| A17 | Skip sheet | "Move to tomorrow" toggle shifts the workout a day | Not in PRD | Add for **workout blocks only**: shifts that one session (Upper A → Tue); the rest of the week shifts by one, and Sunday rest absorbs it. |
| A18 | Routine block kinds | Habit, Water, Workout, Meal, Sleep, Task | wake/water/workout/meal/task/sleep/phone_off/custom | Keep the PRD enum in the DB; show the design's 6 labels (wake/custom → Habit, phone_off → Sleep). |
| A19 | Optional blocks | "Evening walk · optional · not counted" | Not defined | Add `routine_block.is_optional`: shown, never counts in the score. Seed Evening walk as optional, so Workday = 11 counted blocks. |
| A20 | Weigh-in checklist | 3 check items (after toilet, same scale, salty dinner) | none | Local-only hints; the salty-dinner tick is stored as `weight_log.note = 'salty'` and shown as a marker on the chart. |
| A21 | Theme | Settings shows System / Light / Dark | Dark default | Offer all three; **default Dark**. |
| A22 | Coffee "rules" card | — | — | Keep the card, but with the PRD's numbers (see B3). |

## B. PRD wins (designs are mock data; build from the PRD)

| # | Topic | What the designs show | Build this instead |
|---|---|---|---|
| B1 | Day score | Ring mixes routine/water/protein, inconsistently (78% at 7/11 blocks) | **Score = counted blocks done ÷ counted blocks planned** (PRD §4.2). Water and protein stay as sub-stats beside the ring. The meal and water-target blocks already carry food and water into the score. |
| B2 | Skipped blocks | "block counts 0 of 1 in today's score" | Skipped **with a reason** leaves the denominator (PRD §4.2), so a sick day doesn't tank the score. |
| B3 | Coffee | "~44 kcal, 2 g protein (toned milk, no sugar)" | PTR's coffee: **black, half sugar, 20 kcal, 0 g protein**, limit 2 (PRD §6.3). |
| B4 | Meal numbers | Lunch 720/42 vs 612/54, dinner "Chapati ×3 · 620 kcal" vs "×2 · 495", snack 220 vs 410, eggs 250 kcal | Seed data in PRD §6.3. Every kcal/protein figure on screen comes from the `dish` table. |
| B5 | Upper A exercises | Bench, row, shoulder press, rear-delt fly, plank ("6 exercises" on Today) | PRD §6.4 program (bench, row, shoulder press, curl, overhead triceps). PTR can edit the program in-app. |
| B6 | Dumbbell steps | "1 kg steps" | 0.5 kg below 10 kg, 1 kg above (PRD F11). |
| B7 | Program summary | "Upper/Lower split · 6 days + rest", "0/6 sessions" | 5 training sessions + 1 walk + 1 rest. Copy: "5 sessions + walk". |
| B8 | Shopping estimate | "est. ₹1,480" | Show it only if items have prices: optional `price_inr` per shopping item. Otherwise hide the line. |
| B9 | Mock contradictions | e.g. water streak 9 days but "goal hit 3 of 7" | Ignore. All numbers come from selectors. |

## C. Gaps (no design)

- **F21 Steps:** build with the Water pattern (ring, stat tiles, 7-day bars) and AutoFit's min/stretch targets.
- **Exercise library:** list pattern from `Routine-Blocks`.
- **Sync issue state** (F02 dead-letter): use the danger banner from `Acc-Interrupt` in compact form on More.

## D. How to use the export

- The `.dc.html` files are **web** prototypes (React + inline styles + Google Fonts). LifeOS is React Native, so rebuild every screen with `src/ui` primitives. Never copy markup, CSS or class names.
- Animations in the designs (ring fill, count-up, bar grow, pace-marker pulse, spring press at 0.98 scale) → `react-native-reanimated`, ≤ 1.4 s, and respect "Reduce Motion".
- Use the PNGs in `screens/` to see the target, and the HTML source for exact copy, spacing and hex values.
