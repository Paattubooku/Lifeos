# F00 — `src/ui` plan (proposal, no code written yet)

Sources: `design/screens/Main.png`, `Components-1-Dark.png`, `Components-2-Dark.png`, `design/source/Main.dc.html` (all hex values below are copied from it), PRD §7.2–7.3, DESIGN_NOTES A1–A3, A21.

## 1. Tokens — `src/ui/theme.ts`

| Group | Dark | Light |
|---|---|---|
| canvas / raised / recessed | `#0A0F1C` / `#131B2E` / `#1A2338` | `#F8FAFC` / `#FFFFFF` / `#F1F5F9` |
| text / textSecondary | `#F1F5F9` / `#94A3B8` | `#0F172A` / `#64748B` |
| primary (gradient) | `#60A5FA → #3B82F6`, button fill `#2563EB` + white | `#2563EB → #1D4ED8` |
| water | `#38BDF8 → #7DD3FC` | `#0369A1 → #38BDF8` |
| protein/strength | `#A78BFA → #C4B5FD` | `#7C3AED → #8B5CF6` |
| calories | `#FB923C → #FDBA74` | `#C2410C → #FB923C` |
| success / danger | `#34D399` / `#FB7185` | `#047857` / `#E11D48` |
| hairline (cards, rows) | `#1F2A40` | `#E2E8F0` |
| input/ring-track border | `#334155` | `#CBD5E1` |
| destructive button | `#E11D48` | `#E11D48` |

- Each accent exposes `{ base, light }` (+ an `onSurface` text step: in light, water text is `#0369A1`, calories `#C2410C`, success `#047857`, since the lighter fills fail AA on white).
- Chip tints are derived (12% alpha of the accent) via a helper, not hex literals.
- **Spacing** `4/8/12/16/24/32`. **Radius** `button 12 · card 16 · sheet 24 (top) · pill 999`. **Min target** 44.
- **Type scale** 48 / 36 / 28 / 20 / 16 / 14 / 12 (+ 15 for button labels per the HTML). Letter-spacing: −0.03em on 48/36, −0.02em on 28/20, −0.01em on buttons → converted to px (`fontSize × em`).
- **Motion constants:** spring ≈ `cubic-bezier(.34,1.3,.64,1)` → reanimated `withSpring({damping≈14, stiffness≈180})` (tuned by eye); ease `cubic-bezier(.4,0,.2,1)`; ring/bar 1.1–1.4 s; press scale 0.98; stagger +60 ms; sheet 600 ms; snackbar 5 s. All gated by `useReducedMotion()`.
- Theme provider: `System | Light | Dark`, default **Dark**, persisted (MMKV); `useTheme()` hook; `StatusBar` follows.
- ESLint rule (custom `no-restricted-syntax` on hex literals outside `theme.ts`) so "no hard-coded colours" is enforced, not just promised.

## 2. Fonts

- `@expo-google-fonts/plus-jakarta-sans`: 500, 600, 700, 800 (display, numbers, card titles).
- `@expo-google-fonts/inter`: 400, 500, 600, 700 (body).
- Loaded with `useFonts` in the root layout; splash held until ready. In RN each weight is a separate family name, so `theme.font.{display,body}[weight]` maps to them; no `fontWeight` on custom fonts.
- Tabular figures: `fontVariant: ['tabular-nums']` on all numeric text (a `<Num>` / `Text variant="num"` helper). Needs checking that both fonts ship the `tnum` feature (Inter does; Plus Jakarta Sans I'll verify on a device).
- `formatInr()` / `formatClock()` helpers live in `src/lib/format.ts`, not `ui/` (custom Indian grouping rather than `Intl`, to avoid Hermes/Android `en-IN` differences).

## 3. Shared components (each with a Jest/RNTL test and a required `accessibilityLabel`)

PRD §7.3 list (12) — **create all in F00:**

| # | Component | From design | Notes |
|---|---|---|---|
| 1 | `Button` | Components-1 "Buttons" | variants primary / secondary / water / metric-ghost / destructive / outline-inline; sizes 48 & small; disabled = 40% opacity, label stays; press scale 0.98; haptic |
| 2 | `Card` | "Cards & stat tiles" | radius 16, hairline border, raised bg |
| 3 | `Ring` | "Metric rings" | `react-native-svg` arc, round caps, two-tone gradient stroke, count-up centre text, **triple-ring** variant for Day score |
| 4 | `ProgressBar` | "Progress bar with pace marker" | two-tone fill, optional `pace` tick that "breathes", caption line below |
| 5 | `Sheet` | "Bottom sheet" | radius-24 top, scrim, drag handle, spring in; used by every sheet screen |
| 6 | `Chip` | "Chips" + status chips | tappable chip (44 tall) and status pill (12% tint, optional beacon dot) |
| 7 | `ListRow` | "List row · checkbox + swipe" | checkbox 44×44 hit area, done strike-through, swipe right = done, swipe left = Tomorrow/Delete |
| 8 | `Fab` | "Floating tab bar & water FAB" | tap = +200 ml, long-press = halo + haptic; ripple loop |
| 9 | `EmptyState` | "Empty state" | accent icon disc + one fact + one action |
| 10 | `Snackbar` | "Undo snackbar" | inverted, springs above tab bar, 5 s, Undo; provider + `useSnackbar()` |
| 11 | `NumberStepper` | "Stepper" | − / value / + with unit, configurable step, min/max, tabular digits |
| 12 | `TimePicker` | "Stepper & time picker" | custom wheel (hour / minute-5 / am-pm) with a recessed selection band |

Extra primitives the designs clearly need (cheap now, reused by every screen) — **I propose adding these to F00, tell me if you'd rather defer them:**

| Component | Why |
|---|---|
| `Text` (variants: hero 48, title 36, metric 28, heading 20, body 16, sub 14, caption 12, num) | one place for fonts + tabular figures |
| `Banner` | info / warning / danger banners with icon tile + optional action ("Drink 350") |
| `SegmentedToggle` | Workday/Weekend/Rest, Today only/From now on |
| `StatTile` | Calories / Protein / Coffee / Weight / Water / Streak tiles |
| `Checkbox` | used by `ListRow`, checklists |
| `TabBar` (custom floating glass pill, Expo Router `tabBar`) | the 5 tabs; active pill |
| `TimelineRow` | Wake/Drink/Workout… states: done, current, upcoming, skipped, overdue, optional + "auto:" chip (F05 builds on it) |
| `BarChart` (small, 7-day) and `LineChart` | later features; **not** in F00, listed so the choice of chart lib (gifted-charts vs custom svg) is made once |

(`BarChart`/`LineChart` and `TimelineRow` I'd build in the features that use them, not F00; PRD F00 only requires the 12 + a sample test each.)

## 4. Dependencies F00 will add (beyond the PRD stack line — please confirm)

`react-native-reanimated`, `react-native-gesture-handler` (swipe rows), `react-native-svg` (rings, charts), `expo-linear-gradient` (gradient fills/stroke), `expo-haptics`, `expo-blur` (sheet scrim/tab bar), `expo-font` + the two `@expo-google-fonts` packages, `react-native-safe-area-context`. All are Expo-Go compatible, so no dev build until F11.

## 5. Things in the designs I can't do exactly in React Native

| Design feature | In React Native |
|---|---|
| CSS `@property` integer count-up (`.lo-count`, counter) | JS-driven: reanimated shared value → `useAnimatedProps` on a `TextInput` (or a state tick); same 1.4 s, but text isn't "real" CSS counter |
| Dual ambient `box-shadow` + `inset 0 0 0 1px` hairline | iOS: single `shadow*` layer; Android: `elevation`. Hairline becomes a 1 px `borderColor`. Shadows will look slightly flatter than the PNGs (esp. light cards), left on purpose |
| `box-shadow` pulse (FAB ripple, beacon) | Animated scaled/fading ring `View` behind the element instead |
| `backdrop-filter: blur(8px)` (sheet scrim, glass tab bar) | `expo-blur` `BlurView`: good on iOS, weaker/experimental on Android (falls back to a translucent tint) |
| Hover lift (`.lo-card:hover`) | Dropped (touch only); press scale 0.98 stays |
| `stroke-dashoffset` draw-in on lines/rings | Works with `react-native-svg` + reanimated `animatedProps`; no CSS `pathLength=1` trick, I'll compute dash lengths |
| `transform-box: fill-box` bar grow | scaleY on a `View`/`Rect` with explicit origin |
| `letter-spacing` in em | px values, computed from the size |
| Fractional font weights/variable font via Google Fonts CSS | static weight files only (500/600/700/800 and 400–700) |
| `font-variant-numeric: tabular-nums` | `fontVariant: ['tabular-nums']`: iOS fine; Android depends on font feature support (verify on device) |
| `cubic-bezier(.34,1.3,.64,1)` (overshoot) | reanimated `withTiming(Easing.bezier(.34,1.3,.64,1))` is supported, or a damped spring; slightly different feel |
| `prefers-reduced-motion` | `useReducedMotion()` + `AccessibilityInfo`: disable all of the above |
| Time-picker wheel | no native cross-platform equivalent matching the design → custom snap `FlatList` wheel |
| Swipe rows (checkbox + "Tomorrow/Delete") | gesture-handler `Swipeable`, custom actions |
| Water FAB long-press "halo 6 px" + haptic | `Pressable` `onLongPress` + animated halo; haptics are device-only (no-op on web) |
| Floating pill tab bar 22 px above the home indicator | custom `tabBar` in Expo Router + safe-area inset; the position will differ per device |
| Sheet "springs up" with blur behind | `Sheet` uses reanimated + `BlurView`; no `<dialog>`/portal; needs a root-level host |
| Google Fonts `<link>` | bundled via `@expo-google-fonts` (A2, no network) |
| `Intl`-dependent Indian grouping | custom formatter |
| Emoji/icons: the designs use an icon set (droplet, inbox, bowl, dumbbell, bar-chart, …) | need an icon library; I'd use `lucide-react-native` (matches the stroke style) → **confirm** |

Nothing in the foundations or the two component sheets is impossible; the gaps are fidelity (shadows, blur, count-up) rather than missing features.

## 6. Files F00 will create/change (for your OK)

`package.json`, `app.json`, `tsconfig.json` (strict), `babel.config.js`, `eslint.config.js`, `.prettierrc`, `jest.config.js` + setup, `eas.json`, `.env.example` (extend), `.gitignore` (extend if needed), `app/_layout.tsx`, `app/(tabs)/{_layout,today,food,train,progress,more}.tsx`, `src/store/{index,persist,baseApi}.ts`, `src/lib/{storage,dates,ids,logger,format}.ts`, `src/ui/{theme,Text,Button,Card,Ring,ProgressBar,Sheet,Chip,ListRow,Fab,EmptyState,Snackbar,NumberStepper,TimePicker,…}.tsx` + `src/ui/__tests__/*`, `PROGRESS.md`, `DECISIONS.md`.
`src/lib/dates.ts` is needed even in F00 (theme/clock formatting, and the PRD makes it the only date path). I'd add it with `logicalDate`, `todayLogical`, `addDays`, `weekStart` and tests, which is a small, pure addition to F00. *(Not in F00's literal scope; flagging it.)*
