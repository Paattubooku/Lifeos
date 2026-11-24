# Later

Ideas parked out of scope. Nothing here gets built until v1 (F00–F24) is done and in daily use.

- Gemini fallback for unmatched bank SMS (reference: My-Tracker stage C)
- AI photo meal scan / nutrition estimate (reference: Food-Tracker)
- Native WidgetKit / Android widgets (F22 option B)
- Generic custom trackers and tags (reference: Pulse)
- Drop the 7 redundant (user_id, date) / (user_id) indexes that duplicate unique-constraint indexes (day_log, session_log, weight_log, session_override, sleep_log, steps_log, weekly_review, profile) — destructive migration, do it with PTR's OK.
- Drag-and-drop block reorder (F04 ships ↑/↓ buttons in a Reorder mode; a drag list needs a gesture-heavy library).
- Link a meal plan to a routine template (Routine-Templates design shows "No meal plan linked"; no column for it in PRD §5).
- One-line template description in the Switch-template sheet ("Workout, packed lunch, phone away 9:30 pm").
- Per-template meal plans (Workday / Weekend / Rest day tabs, "Copy Workday plan" from the Food-Empty design): needs a template ↔ meal plan link.
- Pick an existing dish from the library to add to another meal; drag-to-reorder dishes in the plan editor.
- Shopping list (PRD F10) — dropped by PTR on 2026-11-23. If ever revived: `dish.buy` and `dish.shopping_items` columns still exist; a dish-level list (no ingredient entry) would work with today's data.
- F17: edit a task's title, priority and due date (today: delete and re-add); optional due time ("Before 6 pm").
- F18: add / rename / delete expense categories; edit an existing expense; pick any past date in the add sheet.
- F19: Gemini (or other AI) fallback for unmatched bank SMS, server-side only; Android in-app SMS reading if PTR ever moves to Android; more bank formats beyond ICICI.
- F20: apply the review's change to the routine (e.g. move the Evening walk block to 8:30 pm on Workday) from the saved screen.
- F21: Android Health Connect (react-native-health-connect) if PTR moves to Android; HealthKit background delivery so steps update without opening the app.
- F22 Option B: native WidgetKit widgets (expo-apple-targets) with iOS 17 "Tap to tick" interactive buttons and a lock-screen widget; needs the development/TestFlight build.
