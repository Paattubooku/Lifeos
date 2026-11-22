# LifeOS

Personal single-user mobile app (Expo React Native + Supabase) that runs the day from 5:00 am wake to 10:00 pm sleep: routine, water, food, training, weight, sleep, tasks and money.

| File | What it is |
|---|---|
| [`PRD.md`](PRD.md) | Full product spec: features F00–F24, data model, seed data, build order |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for Claude Code |
| [`KICKOFF_PROMPT.md`](KICKOFF_PROMPT.md) | Prompts to paste into Claude Code, session by session |
| [`design/`](design/) | Approved designs: `INDEX.md` (screen → feature), `DESIGN_NOTES.md` (design vs PRD decisions), `screens/` (PNGs), `source/` (raw export) |
| `PROGRESS.md` | What's built, how to verify it (updated after every feature) |
| `DECISIONS.md` | Decisions made during the build |
| `LATER.md` | Ideas parked out of scope |

## Status

F00 (scaffold) and F01 (Supabase, auth, schema, seed) done, see `PROGRESS.md`. Next: F02.

```bash
npm install
npm start        # Expo dev server, scan the QR with Expo Go
npm run typecheck && npm run lint && npm test
npm run test:db    # migrations + RLS/seed SQL tests on a throwaway local Postgres
npm run gen:types  # regenerate src/types/supabase.ts from the migrations
```
