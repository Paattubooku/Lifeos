# Decisions

Decisions made during the build that the PRD left open. Format: date · feature · decision · why.

- 2026-11-23 · design · Designs reconciled with the PRD; see `design/DESIGN_NOTES.md` (PRD v1.2).
- 2026-11-22 · F00 · **Expo SDK 58** (React Native 0.88, React 19.3, TypeScript 6). Latest stable; Expo Go from the App/Play Store only runs the newest SDK. `react-dom` is pinned to 19.3.0 to match React (an optional peer of expo-router otherwise pulls 19.3.1).
- 2026-11-22 · F00 · **Storage = MMKV with an AsyncStorage fallback** (`src/lib/storage.ts`). MMKV v4 is a Nitro native module that Expo Go doesn't ship, and PRD §14 says to use Expo Go until F11. Dev/preview builds get MMKV; Expo Go gets AsyncStorage behind the same promise API. redux-persist (and the F02 queue) use this adapter.
- 2026-11-22 · F00 · **Icons: `lucide-react-native`** (stroke style matches the design's icons). It is not tree-shaken by Metro, so the full icon set is in the bundle (~6.9 MB Hermes bytecode total). Revisit in F23 (cold-start budget) by importing icons per file.
- 2026-11-22 · F00 · **Fonts imported per weight** (`@expo-google-fonts/inter/400Regular` etc.), 8 files total. Importing from the package index bundles every weight and italic (~50 files).
- 2026-11-22 · F00 · **Extra `src/ui` primitives** beyond PRD §7.3, taken from the component sheets: `Text` (type scale + tabular figures), `PressableScale` (0.98 press), `StatTile`, `StatusChip` (with beacon), `SegmentedToggle`, `Banner`, `Checkbox`, `TripleRing`, `TabBar` (floating pill), `Screen`. Charts and the timeline row are deferred to the features that use them (F05/F07/F13).
- 2026-11-22 · F00 · **Theme tokens beyond PRD §7.2** read from `design/source/Components-*.dc.html`: `hairline` (#1F2A40 / #E2E8F0), `border` (#334155 / #CBD5E1), `ringTrack` (#1E293B / #F1F5F9), `tabBar` (#0F1626 / #FFFFFF), `buttonWater` (#0369A1), `scrim`, inverse snackbar colours, 12% tints, and the ring/bar gradients (e.g. water #0EA5E9→#7DD3FC dark).
- 2026-11-22 · F00 · **Theme toggle on More** (System / Light / Dark, default Dark), stored locally in Redux + persist. It's the minimum needed to verify both themes; F03/F23 will sync it to `profile.theme`.
- 2026-11-22 · F00 · **Dev-only component gallery** at `/dev/gallery` (linked from More only when `__DEV__`), for comparing against `design/screens/Components-*.png`. Release builds redirect it to Today.
- 2026-11-22 · F00 · **Lint guards**: ESLint bans hex/rgb colour literals outside `src/ui/theme.ts`, `toISOString().slice/split` (PRD §4.1) and `any`; `npm run lint` also runs `prettier --check`.
- 2026-11-22 · F00 · **Jest setup**: Reanimated's official mock plus a stub for its `setCSSEventHandler` (Reanimated 4.7 throws in Jest otherwise); a thin stand-in for gesture-handler's `ReanimatedSwipeable` (`src/test/mocks/`); lucide mapped to its CommonJS build. RNTL 14 is async (`await render`, `await fireEvent`).
- 2026-11-22 · F00 · **`react-native-web` is a devDependency** only, used to render the app in headless Chromium for visual checks against the design PNGs. LifeOS stays mobile-only (PRD §1.4).
- 2026-11-22 · F00 · **`src/lib/dates.ts` not added yet.** F00 needs no date maths (only clock formatting, in `src/lib/format.ts`); it lands with the first feature that needs logical days (F01 seed / F02).
- 2026-11-22 · F00 · App identifiers `app.lifeos.ptr` (iOS bundle id / Android package) are placeholders until PTR picks real ones before the first EAS build.
