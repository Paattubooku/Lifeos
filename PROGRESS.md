# Progress

One entry per feature, newest first: feature ID, what was built, how PTR verifies it on the phone, known gaps.

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

_Next: F01 (Supabase, auth, schema, seed). Waiting for PTR's "next"._
