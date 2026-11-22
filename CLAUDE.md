# CLAUDE.md — LifeOS

Personal mobile app for PTR (single user). Full spec: `PRD.md`. Read it before every feature.

## How we work

- Build **one feature at a time** in the order of `PRD.md` §12. Never start the next feature without PTR saying "next".
- Before coding a feature: re-read its spec in `PRD.md` §8, list the files you will create/change, then build.
- After a feature: run `npm run typecheck && npm run lint && npm test`. All must pass. Then update `PROGRESS.md` (feature ID, what was built, how PTR verifies it on the phone, known gaps) and stop with a short summary.
- Prefer **additive changes**: add new files/blocks; don't rewrite working code from earlier features unless the spec requires it. If you must change earlier code, say why in the summary.
- Unspecified detail → pick the simplest option that meets the acceptance criteria, record it in `DECISIONS.md`, continue.
- Ask PTR before anything irreversible: destructive migrations on existing data, paid services, deleting files outside this feature.
- New ideas or scope creep → `LATER.md`, never into the current feature.

## Reference apps

- `reference/` holds read-only clones of PTR's old repos: `Paattubooku/{Tracker,My-Tracker,OwnTracker,Pulse,Food-Tracker,AutoFit}` (clone command in `PRD.md` §2). It is git-ignored.
- Each feature's "Reference" line in `PRD.md` §8 names the exact files to read before building it. §2.2 says what to port where; §2.3 lists the old repos' mistakes not to repeat (allow-all RLS, custom password auth, AI keys in the client, UTC dates, committed `.env`).
- Port pure logic (SMS parser, water pace engine, expense analytics, weight projection, insight rules) into `src/features/*/lib/` with tests, adapted to strict TypeScript and IST. Never import from `reference/`, never edit it, never copy its architecture.

## Design

- The approved designs live in `design/` (Claude Design handoff bundles or ZIP exports, one folder per round: `01-core`, `02-food`, `03-train`, `04-progress`, `05-more`). `design/INDEX.md` maps each screen to its PRD feature ID.
- Designs are the source of truth for **layout, hierarchy, copy, states and tokens**. `PRD.md` is the source of truth for **behaviour, data and logic**. If they conflict, follow the PRD for behaviour and the design for visuals, and note the conflict in `DECISIONS.md`.
- The design exports are web (HTML/CSS/React). LifeOS is Expo React Native, so **rebuild every screen with React Native components and `src/ui` primitives**. Never paste web markup, CSS, Tailwind classes or DOM-only libraries into the app.
- Extract colours, spacing, radius and type sizes into `src/ui/theme.ts` once (F00), then use tokens only.
- Before building a feature's UI, open its screens in `design/` and list which screens and states you'll implement. After building, compare your screen with the design and list any differences you left on purpose.

## Stack

Expo + React Native + TypeScript (strict), Expo Router, Redux Toolkit + RTK Query, MMKV, Supabase (Postgres, Auth, RLS, Edge Functions), expo-notifications, Jest + React Native Testing Library, Maestro.

## Code rules

- Feature folders: `src/features/<name>/{components,hooks,slice.ts,api.ts,selectors.ts,lib,__tests__}`.
- Business rules are pure functions in `selectors.ts` / `lib/` with ≥ 90% test coverage.
- All dates through `src/lib/dates.ts`. Time zone `Asia/Kolkata`; logical day starts at 03:00. Never derive a day with `toISOString().slice(0,10)`.
- Every write is optimistic and goes through the sync queue (`src/lib/sync.ts`) with a `client_id`.
- Schema changes only via new files in `supabase/migrations/`; regenerate `src/types/supabase.ts` after each.
- No `any`. No secrets in code; use `.env` (`EXPO_PUBLIC_*` for anon values only). Never put the service-role key in the app.
- UI uses `src/ui/theme.ts` tokens only; no hard-coded colours. Every touchable has an `accessibilityLabel`.

## Commands

- `npm run start` — Expo dev server
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run e2e`
- `npx supabase db push` — apply migrations · `npx supabase gen types typescript --linked > src/types/supabase.ts`
