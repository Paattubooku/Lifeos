# LifeOS design index

137 artboards = 69 screens × light/dark. Exported from Claude Design on 23 Nov 2026.

- `source/` = the raw export (`*.dc.html` + `_runtime/` + `canvas.json`). Read the HTML for exact copy, spacing and colours. To view: `cd design/source && python3 -m http.server`, then open a file.
- `screens/` = PNG renders of every artboard (same file names, `.png`). Look at these first: they are what the screen should look like.
- `DESIGN_NOTES.md` = where the designs and the PRD disagree, and which one wins. **Read it before building any screen.**

| Screen | PRD feature | Light | Dark |
|---|---|---|---|
| Foundations · both themes | F00 | `screens/Main.png` | — |
| Components 1 | F00 | `screens/Components-1.png` | `screens/Components-1-Dark.png` |
| Components 2 | F00 | `screens/Components-2.png` | `screens/Components-2-Dark.png` |
| Sign in | F01 | `screens/SignIn.png` | `screens/SignIn-Dark.png` |
| Onboarding 1 · Body | F03 | `screens/Onboarding-1-Body.png` | `screens/Onboarding-1-Body-Dark.png` |
| Onboarding 2 · Day | F03 | `screens/Onboarding-2-Day.png` | `screens/Onboarding-2-Day-Dark.png` |
| Onboarding 3 · Targets | F03 | `screens/Onboarding-3-Targets.png` | `screens/Onboarding-3-Targets-Dark.png` |
| Onboarding 4 · Notifications | F03 | `screens/Onboarding-4-Notifications.png` | `screens/Onboarding-4-Notifications-Dark.png` |
| Today · 5:20 am | F05, F06, F17 | `screens/Today-0520am.png` | `screens/Today-0520am-Dark.png` |
| Today · 1:15 pm | F05, F06, F17 | `screens/Today-0115pm.png` | `screens/Today-0115pm-Dark.png` |
| Today · 9:30 pm | F05, F06, F17 | `screens/Today-0930pm.png` | `screens/Today-0930pm-Dark.png` |
| Sheet · Skip a block | F05 | `screens/Sheet-SkipBlock.png` | `screens/Sheet-SkipBlock-Dark.png` |
| Sheet · Switch template | F04, F05 | `screens/Sheet-SwitchTemplate.png` | `screens/Sheet-SwitchTemplate-Dark.png` |
| Water · Light (interactive) | F07 | `screens/Water.png` | `screens/Water-Dark.png` |
| Water FAB sheet | F07 | `screens/Sheet-WaterAdd.png` | `screens/Sheet-WaterAdd-Dark.png` |
| Food tab · 4:45 pm | F08 | `screens/Food-Tab.png` | `screens/Food-Tab-Dark.png` |
| Meal detail · Breakfast | F08 | `screens/Food-MealDetail.png` | `screens/Food-MealDetail-Dark.png` |
| Swap sheet | F08 | `screens/Food-SwapSheet.png` | `screens/Food-SwapSheet-Dark.png` |
| Off-plan entry sheet | F09 | `screens/Food-OffPlanSheet.png` | `screens/Food-OffPlanSheet-Dark.png` |
| Coffee states | F09 | `screens/Food-Coffee.png` | `screens/Food-Coffee-Dark.png` |
| Shopping list | F10 | `screens/Food-Shopping.png` | `screens/Food-Shopping-Dark.png` |
| Meal plan editor | F08 | `screens/Food-PlanEditor.png` | `screens/Food-PlanEditor-Dark.png` |
| Dish editor | F08 | `screens/Food-DishEditor.png` | `screens/Food-DishEditor-Dark.png` |
| Food tab · empty | F08 | `screens/Food-Empty.png` | `screens/Food-Empty-Dark.png` |
| Food tab · offline | F08 | `screens/Food-Offline.png` | `screens/Food-Offline-Dark.png` |
| Train tab · Mon | F11 | `screens/Train-Tab.png` | `screens/Train-Tab-Dark.png` |
| Session logger · bench set 2 | F11 | `screens/Train-Logger.png` | `screens/Train-Logger-Dark.png` |
| Rest timer · 90 s | F11 | `screens/Train-RestTimer.png` | `screens/Train-RestTimer-Dark.png` |
| Timed · Plank | F11 | `screens/Train-Timed.png` | `screens/Train-Timed-Dark.png` |
| Circuit · Saturday | F11 | `screens/Train-Circuit.png` | `screens/Train-Circuit-Dark.png` |
| Session finished | F11, F12 | `screens/Train-Summary.png` | `screens/Train-Summary-Dark.png` |
| Walk day · Wed | F11 | `screens/Train-WalkDay.png` | `screens/Train-WalkDay-Dark.png` |
| Rest day · Sun | F11 | `screens/Train-RestDay.png` | `screens/Train-RestDay-Dark.png` |
| Exercise history | F12 | `screens/Train-History.png` | `screens/Train-History-Dark.png` |
| Program view | F11, F23 | `screens/Train-Program.png` | `screens/Train-Program-Dark.png` |
| Program editor | F11, F23 | `screens/Train-ProgramEditor.png` | `screens/Train-ProgramEditor-Dark.png` |
| Progress overview | F16 | `screens/Prog-Tab.png` | `screens/Prog-Tab-Dark.png` |
| Weight detail | F13 | `screens/Prog-Weight.png` | `screens/Prog-Weight-Dark.png` |
| Weight · not enough data | F13 | `screens/Prog-WeightNoData.png` | `screens/Prog-WeightNoData-Dark.png` |
| Energy card states | F13 | `screens/Prog-Energy.png` | `screens/Prog-Energy-Dark.png` |
| Weigh-in sheet | F13 | `screens/Prog-WeighIn.png` | `screens/Prog-WeighIn-Dark.png` |
| Streaks | F06, F16 | `screens/Prog-Streaks.png` | `screens/Prog-Streaks-Dark.png` |
| Sleep | F14 | `screens/Prog-Sleep.png` | `screens/Prog-Sleep-Dark.png` |
| Weekly review · summary | F20 | `screens/Review-1-Summary.png` | `screens/Review-1-Summary-Dark.png` |
| Weekly review · reflect | F20 | `screens/Review-2-Reflect.png` | `screens/Review-2-Reflect-Dark.png` |
| Weekly review · saved | F20 | `screens/Review-3-Saved.png` | `screens/Review-3-Saved-Dark.png` |
| Monday Today · this week’s change | F20 | `screens/Review-4-Monday.png` | `screens/Review-4-Monday-Dark.png` |
| Today · missed-day recovery | F24 | `screens/Acc-Recovery.png` | `screens/Acc-Recovery-Dark.png` |
| Today · failure interrupt | F24 | `screens/Acc-Interrupt.png` | `screens/Acc-Interrupt-Dark.png` |
| Today · fallback mode | F24 | `screens/Acc-Fallback.png` | `screens/Acc-Fallback-Dark.png` |
| Today · reality check | F24 | `screens/Acc-Reality.png` | `screens/Acc-Reality-Dark.png` |
| More menu | F23 | `screens/More-Menu.png` | `screens/More-Menu-Dark.png` |
| Tasks | F17 | `screens/Tasks-List.png` | `screens/Tasks-List-Dark.png` |
| Quick-add task sheet | F17 | `screens/Tasks-QuickAdd.png` | `screens/Tasks-QuickAdd-Dark.png` |
| Swap out of top 3 | F17 | `screens/Tasks-SwapTop3.png` | `screens/Tasks-SwapTop3-Dark.png` |
| Money overview · Nov | F18 | `screens/Money-Overview.png` | `screens/Money-Overview-Dark.png` |
| Transactions | F18 | `screens/Money-Transactions.png` | `screens/Money-Transactions-Dark.png` |
| Money analytics | F18 | `screens/Money-Analytics.png` | `screens/Money-Analytics-Dark.png` |
| Add expense sheet | F18 | `screens/Money-AddExpense.png` | `screens/Money-AddExpense-Dark.png` |
| Budgets | F18 | `screens/Money-Budgets.png` | `screens/Money-Budgets-Dark.png` |
| Routine templates | F04 | `screens/Routine-Templates.png` | `screens/Routine-Templates-Dark.png` |
| Routine · Workday blocks | F04 | `screens/Routine-Blocks.png` | `screens/Routine-Blocks-Dark.png` |
| Block edit sheet | F04 | `screens/Routine-BlockEdit.png` | `screens/Routine-BlockEdit-Dark.png` |
| Reminders | F15, F24 | `screens/Reminders.png` | `screens/Reminders-Dark.png` |
| Integrations | F19 | `screens/Integrations.png` | `screens/Integrations-Dark.png` |
| Parser Lab | F19 | `screens/Integrations-ParserLab.png` | `screens/Integrations-ParserLab-Dark.png` |
| Settings | F23 | `screens/Settings.png` | `screens/Settings-Dark.png` |
| Home-screen widgets | F22 | `screens/Widgets.png` | `screens/Widgets-Dark.png` |
| Lock-screen notifications | F15, F22 | `screens/LockScreen.png` | `screens/LockScreen-Dark.png` |

## Features with no screen

- **F02** sync engine (no UI except the sync row on More → `More-Menu`).
- **F21** Steps: no screens. Reuse the Water screen pattern (ring + stat tiles + 7-day bars) and the stat-tile/chip components.
- **Exercise library** (linked from Train tab): no screen. Use the Routine-Blocks list pattern.
