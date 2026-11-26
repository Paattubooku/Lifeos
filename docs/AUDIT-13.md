# 13-Layer Audit - Life (Lifeos) - 2026-11-26

Stack: Expo SDK 58 / React Native 0.88 (TypeScript, Expo Router, Redux Toolkit + RTK Query, offline sync queue) · Supabase (Postgres + RLS, Auth, Deno Edge Functions) · hosting via Expo Go + EAS Update · **no LLM / AI features** (AI-specific checklist items are N/A).

Audit kit: *13 Layers of a Production AI App* (`/audit-13`), run read-only in three waves (L01 L04 L08 L09 · L02 L03 L05 L12 L13 · L06 L07 L10 L11). Kit checklists were adapted from FastAPI/Vite to this stack. Status follows the kit's rule: **PASS** = every applicable item true · **PARTIAL** = only partly-met or manual items left · **FAIL** = any code item false. Hosted Supabase dashboard settings were **not** visible to the auditors; findings about them come from `supabase/config.toml` (local) and must be checked in the dashboard. No auditor changed any file (`git status` clean after every wave).

**Overall:** 2/13 layers PASS · 3 PARTIAL · 8 FAIL · **0 Critical · 12 High · 34 Medium · 46 Low**

The core product is in good shape: data isolation (RLS on every table, tested), secrets handling, the client and the database pass. The gaps are almost all **operational**: backups, CI, deploy process, monitoring and server-side limits.

| # | Layer | Status | Score | Top issue |
|---|-------|--------|-------|-----------|
| L01 | Frontend | PASS | 4/4 | No error boundary; screens rarely show load errors |
| L02 | APIs & Backend Logic | FAIL | 1/5 | Concurrent SMS ingest runs race; quick-log not idempotent; Edge code never type-checked |
| L03 | Database & Storage | PASS | 6/6 | Unique day keys ignore soft delete; weekly rollup scans full history |
| L04 | Auth & Permissions | PARTIAL | 5/6 | Deep-link tokens allow login CSRF; Edge Function auth untested |
| L05 | Hosting & Deployment | FAIL | 1/4 | No DEPLOY.md / rollback; EAS project link missing; dev runs against live data |
| L06 | Cloud Compute | PARTIAL | 1/3 | Failing SMS rows retried forever; no time budget |
| L07 | CI/CD & Version Control | FAIL | 1/4 | No CI, no hooks, no branch protection |
| L08 | Security & RLS | PARTIAL | 3/5 | No docs/SECURITY.md; weak sign-up settings; owner can un-revoke a token |
| L09 | Rate Limiting | FAIL | 2/6 | Edge Functions have no rate/size limits; open sign-up without captcha |
| L10 | Caching & CDN | FAIL | 2/6 | Server-side writes never refresh the app's cache; no Cache-Control headers |
| L11 | Load Balancing & Scaling | FAIL | 2/5 | No health check or load test; free-plan ceiling undocumented |
| L12 | Error Tracking & Logs | FAIL | 1/5 | No crash reporting; Edge Functions log nothing |
| L13 | Availability & Recovery | FAIL | 0/5 | No database backups at all (free plan, no PITR); no restore drill |

## Fix First (all 12 Highs, then the most important Mediums; ordered by risk, then effort)
1. **[L13 High]** No backups: free Supabase plan without PITR and no off-site dump · fix: nightly encrypted `pg_dump` GitHub Action to a private bucket (or Supabase Pro) · M
2. **[L13 High]** No restore drill · fix: restore + verify scripts on the throwaway Postgres; record the result in a RUNBOOK · S–M
3. **[L09 High]** Edge Functions have no rate or size limits · fix: Postgres fixed-window counter after `authenticate()`, 429 + Retry-After, 8 KB body cap · M
4. **[L09 High / L08 / L04]** Open sign-up hardening in the hosted project: CAPTCHA, email confirmation, min 8 chars with letters+digits, leaked-password protection, purge unconfirmed users · S
5. **[L07 High]** No CI · fix: GitHub Actions running typecheck, lint, Jest with coverage, `test:db`, `deno check`/`deno lint` · ½ day
6. **[L07 High]** No branch protection · fix: protect main, require PR + CI · 1 h
7. **[L05 High]** Development and tests hit the live database · fix: a second free project for development; production keys only in EAS env · M
8. **[L12 High]** Edge Functions log nothing · fix: JSON logger + `X-Request-ID`, generic error messages · S
9. **[L12 High]** No crash reporting · fix: `@sentry/react-native` (no PII, scrub SMS/amounts) + error boundary · M
10. **[L05 High]** No written deploy/rollback process · fix: `docs/DEPLOY.md` (publish, rollback, function deploy with `verify_jwt`, smoke test) · S
11. **[L05 High]** EAS project link + channel/branch mismatch · fix: `eas init`, commit ids, align channel and branch · S
12. **[L02 High]** Concurrent SMS ingest runs process the same rows · fix: atomic claim (`FOR UPDATE SKIP LOCKED`) or process only the new row on POST · M
13. **[L04 Medium]** Login CSRF via `lifeos://auth-callback#access_token=…` · fix: PKCE, accept only `?code` · S
14. **[L01 Medium]** No error boundary · fix: `ErrorBoundary` in `app/_layout.tsx` · S
15. **[L03 Medium]** Unique day keys ignore soft delete (writes dead-letter on a second phone) · fix: partial unique indexes · S
16. **[L10 Medium]** SMS/Shortcut/second-phone writes never refresh mounted screens · fix: invalidate server-written tags on foreground/reconnect · S
17. **[L02 Medium]** quick-log not idempotent (Shortcut retries double-log) · fix: optional `client_id` upsert · S
18. **[L02/L06 Medium]** Failing SMS rows retried forever · fix: `attempts < 5` filter · S
19. **[L08 Medium]** `docs/SECURITY.md` + gitleaks · S

## Layer Details

### L01 Frontend — PASS · 4/4 (3 N/A)

**DoD (adapted to Expo/React Native)**
1. No provider key/secret in the client → **PASS** — only `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` (`src/lib/config.ts:23-26`); `.env*` git-ignored (`.gitignore:19-21`); anon-only client (`src/lib/supabase.ts:33`); no `sk-`, `service_role`, JWT or `sb_secret_` in app/, src/, widgets/.
2. AI calls via backend with streaming + states → **N/A** (no LLM).
3. AI output as sanitised Markdown → **N/A**.
4. 401 → silent refresh; 429 → friendly message → **PASS** — `autoRefreshToken` while foregrounded (`supabase.ts:39-50`); sync retries 401/JWT/429/5xx with backoff (`sync.ts:214-216`); auth 429 mapped (`session.ts`). Weak spot: Edge Function 429s (finding 3).
5. Usage meter → **N/A** (no plans).
6. Works on phone sizes → **PASS** — flex layouts, sheets sized by `useWindowDimensions`; portrait phone only (`app.json`). Weak spot: large system font sizes (finding 4).
7. Lint, types, tests, no `any` → **PASS** — `tsc` 0, eslint 0 warnings with `no-explicit-any` as error, Prettier clean, Jest 117 suites / 862 tests.

**Findings**
- **Medium** — No error boundary in `app/` or `src/`: a render error in any screen crashes the whole app in a release build. Fix: export `ErrorBoundary` from `app/_layout.tsx` (Expo Router) with a themed "Try again" screen + test. · S
- **Medium** — Screens handle loading but rarely errors (6 of ~37 screens check `isError`): a failed first read with no cache (new phone, JWT/RLS problem) shows an empty plan with no message (e.g. `TodayScreen.tsx:285`). Fix: return `isError`/`refetch` from feature hooks; Banner with Retry when there is an error and no cached data. · M
- **Low** — All `functions.invoke` errors become "check your connection" (`auth/slice.ts:193-199`, `useIntegrations.ts:99-110`). Fix: `edgeErrorMessage()` mapping 429/401/5xx. · S
- **Low** — No `maxFontSizeMultiplier`: dense rows (stat tiles, timeline, tab bar) may clip at the largest Dynamic Type sizes. Fix: cap 1.4–1.6 on compact variants; check Today/Money/Food at max size. · S
- **Low** — Jest ends with "worker failed to exit gracefully" (open handle). Fix: `jest --detectOpenHandles`, clean the leaking timer/listener. · S
- **Low (L04)** — Redirect allowlist `exp://**` (per `src/lib/authRedirect.ts:6-10`) lets any Expo Go dev URL receive email-link tokens. Fix: trim to `lifeos://auth-callback` + your own dev host before public sign-up. · S

Not issues: dev gallery blocked in production; `console.log` only in dev; UI-kit touchables require `accessibilityLabel`; session in SecureStore.

### L02 APIs & Backend Logic — FAIL · 1/5

(The auditor labelled it PARTIAL; by the kit's own rule any failing code item is FAIL.)

**DoD (adapted to Supabase/Deno)**
1. Thin handlers, logic in services, validated input → **PASS** — every `index.ts` only wires I/O; logic pure in `_shared/ingest.ts`, `smsParser.ts`, `summary.ts`, mirrored in `src/` with a byte-identical test (`src/features/money/__tests__/ingest.test.ts:229`); validators `parseIngestBody`, `quickLogRow`, delete-account confirm. Caveat: `widget-summary/index.ts:101-104` casts rows `as never`.
2. Length caps on every free-text field → **FAIL** — Edge Functions cap input (SMS 2,000, payee 80, note 200), but the client writes straight to PostgREST and many text columns have no CHECK (`init_schema.sql:134,216,249,318,381-389,407,430-431`).
3. LLM fake switch → **N/A**. 4. LLM gateway / max_tokens / prompts → **N/A**.
5. Correct status codes, generic messages → **FAIL** — 405/401/400 correct; raw messages leak in 500s (known) and in 200s (M1).
6. /health and /docs off in prod → **N/A** (managed Supabase).
7. Webhooks verified and idempotent → **FAIL** — SMS dedupe via unique `(user_id, txn_ref)` + 23505 handling is good, but quick-log has no idempotency and concurrent ingest runs race.
8. Lint + type checks clean → **FAIL** — `supabase/functions` excluded from `tsc` and ESLint; nothing runs `deno check`/`deno lint`; the four entry points and `server.ts` are never checked.

**Findings**
- **High** — Every `ingest-sms` POST re-runs up to 200 pending rows synchronously; two Shortcut calls at once process the same rows (expenses are saved by `txn_ref`, but skipped messages get double `expense_skipped` rows and "duplicate" is mis-reported) (`ingest-sms/index.ts:65-75`, `ingest.ts:107`). Fix: claim rows atomically (`claim_inbox(limit)` RPC with `FOR UPDATE SKIP LOCKED`), or process only the row just inserted and leave the backlog to `process: true`. · M
- **Medium** — Per-item failures return the raw DB/exception message with HTTP 200 (`ingest.ts:168-170,201`). Fix: generic "Could not process; will retry", detail only in `last_error`/logs. · S
- **Medium** — quick-log has no idempotency: Shortcuts/Siri retries log water/expenses twice (`quick-log/index.ts:18-25`). Fix: optional `client_id` / `Idempotency-Key`, upsert `onConflict: 'client_id', ignoreDuplicates: true`; document for Shortcuts. · S
- **Medium** — Poison SMS rows retried forever (`ingest.ts:171-172`). Fix: skip `attempts ≥ 5`; surface them in Parser Lab. · S
- **Medium** — No length CHECKs on directly written text columns. Fix: migration with `check (length(x) <= N)` matching the Edge caps, `NOT VALID` then `VALIDATE`. · S
- **Medium** — Edge entry points never type-checked/linted; `as never` hides shape drift. Fix: `deno check` + `deno lint` as a check step; typed row aliases. · S
- **Low** — `Number(b.ml)` accepts `true`, `"500"`, `[500]` (`ingest.ts:241`). Fix: require a number. · S
- **Low** — `auth.getUser` errors ignored: an Auth outage shows as 401 (see L12). · S
- **Low** — "Read-only" widget call writes `last_used_at` every poll (`server.ts:39`). Fix: update at most hourly. · S
- **Low** — Inconsistent success shapes; 405 without `Allow`; widget-summary allows POST but says "Use GET". · S
- **Low** — No single API contract page. Fix: `docs/API.md`. · S
- **Low** — `npm:@supabase/supabase-js@2` floats (`server.ts:2`). Fix: pin or add `deno.lock`. · S

### L03 Database & Storage — PASS · 6/6 (adapted to Supabase)

Verified by running `npm run test:db` (all migrations on an empty Postgres, all DB test files pass), listing indexes from `pg_index`, and regenerating types into a scratch folder: they match `src/types/supabase.ts` exactly.

**DoD**
1. Every owned table has an indexed NOT NULL `user_id` → **PASS** — `_lifeos_prepare_table` (`init_schema.sql:34-63`) on all 30 tables; FK/lookup columns indexed.
2. `usage_events` → **N/A** (no metered AI usage).
3. Migrations apply on an empty DB → **PASS** — forward-only, additive later migrations, CLI timestamp naming.
4. No blobs in DB → **PASS** — no Storage buckets, no `bytea`; `raw_sms` is short text.
5. pgvector → **N/A**. 6. Pool settings → **N/A** (PostgREST).
Extra: generated types in sync → **PASS**; seed data → **PASS**; views `security_invoker` and skip soft-deleted rows → **PASS**.

**Findings**
- **Medium** — Unique keys ignore soft delete: `unique (user_id, date)` on day_log, block_log (+block_id), session_log, weight_log, session_override, sleep_log, steps_log and `(user_id, week_start)` on weekly_review (`init_schema.sql:139,154,303,313,321,331,340,427`). Re-logging works only when the client reuses that day's `client_id`; a second phone or a new `client_id` for a day that has (even a deleted) row hits 23505 and the write goes to the dead-letter list. Fix: partial unique indexes `where deleted_at is null` + a DB test (or document/test the reuse rule). · S
- **Medium** — `v_weekly_rollup` filters on a computed `week_start` over a 7-table union, so it likely scans the user's whole history each call (`views.sql:57-94`, `review/api.ts:17`; inferred, not EXPLAINed). Fix: security-invoker SQL function `weekly_rollup(p_from date)` filtering base tables by date; check EXPLAIN. · M
- **Medium** — Unbounded client reads: all of `expense` (`money/api.ts:27`), `weight_log` (`body/api.ts:17`), `weekly_review` (`review/api.ts:26`) grow every year. Fix: date bounds / `.range()` or server-side aggregation. · S
- **Low** — Soft-deleted rows and bank SMS text (`expense.raw_sms`, `expense_skipped.raw_sms`) kept forever. Fix: pg_cron purge of rows deleted > 90 days ago; null or delete SMS text after N days. · S
- **Low** — Duplicate indexes (`*_user_date_idx` repeating the unique keys; `profile_user_idx`). Fix: drop them. · S
- **Low** — `task` has only `(user_id)`; top-3 trigger and due lists filter more. Fix: optional partial index. · S
- **Low** — Missing `char_length` checks (known, see L02).

### L04 Auth & Permissions — PARTIAL · 5/6

**DoD (mapped onto Supabase Auth + RLS + Edge Functions)**
1. Register / login / refresh rotation / logout → **PASS** — Supabase Auth (`src/features/auth/slice.ts:85-179`); refresh rotation on (`supabase/config.toml:176`); sign-out ends the session and clears caches (`slice.ts:208`, `src/store/listeners.ts:59,70`).
2. Passwords hashed, tokens hashed, secure token storage → **PASS** — PATs from 64 random bytes, only SHA-256 stored (`useIntegrations.ts:63-73`, `_shared/server.ts:30`); app reads only `last4`; session in chunked expo-secure-store (`src/lib/supabase.ts:27-44`); service-role key only in Edge Functions.
3. Every protected route checks the caller → **PASS** — `authenticate()` in ingest-sms, quick-log, widget-summary rejects revoked/deleted tokens and verifies JWTs (`server.ts:26-45`); delete-account refuses PATs (`delete-account/index.ts:15-20`); RLS everywhere; views `security_invoker`; `purge_auth_leftovers` service_role only.
4. Plan/role checks server-side → **N/A** (no plans, roles or LLM).
5. No `user_id`/role from the request body → **PASS** — quick-log sets `user_id` after the parsed row (`quick-log/index.ts:21`); RLS `with check` blocks forged owners (`supabase/tests/rls.sql:81-83`).
6. Generic login errors + rate limiting → **PASS** — "Email or password is wrong." (`session.ts:62-66`); Supabase Auth limits.
7. Tests: wrong password, expired token, cross-user → **FAIL (partial)** — covered: wrong password, expired link, A vs B + anon (`rls.sql:55-126`); missing: Edge Function auth (revoked/deleted PAT → 401, malformed Bearer, PAT refused by delete-account).

**Findings**
- **Medium** — Login CSRF: the app accepts `access_token`/`refresh_token` straight from a deep-link fragment and calls `setSession` (`src/features/auth/lib/authLink.ts:39-41`, `slice.ts:155`). Any web page/app can open `lifeos://auth-callback#…` and silently sign the phone into an attacker's account; the user's logs then go there. Fix: `flowType: 'pkce'` in `createClient`, accept only `?code`, drop the fragment branch; confirm before switching accounts. · S
- **Medium** — No automated tests for `authenticate()` / the delete-account guard (`_shared/server.ts:26-45`). Fix: inject the db client; Jest cases for revoked, deleted, unknown, mis-shaped PAT, invalid JWT, PAT to delete-account. · M
- **Low** — Per-function `verify_jwt` not recorded in `config.toml` (see L08). · S
- **Low** — Server allows 6-char passwords (app asks 8), local confirmations off, `secure_password_change` false (`config.toml:187,190,232,234`). Fix: min 8 + letters_digits, confirmations + leaked-password protection on in hosted, secure password change on. · S
- **Low** — Raw server messages pass through for unknown errors (`session.ts:76-78`): "User already registered" reveals which emails have accounts. Fix: generic sign-up error. · S
- **Low** — Raw `error.message` returned in Edge Function 500s (see L08). · S
- **Low** — Token revoke goes through the offline queue: shows "revoked" while the token still works until sync (`useIntegrations.ts:81-92`). Fix: require a connection, or show "revoking…" until confirmed. · S
- **Low** — RLS `with check` only checks `user_id`; foreign keys ignore RLS, so a row could reference another user's parent id if known (random UUIDs make this hard). Fix: composite `(id, user_id)` FKs or a same-owner trigger. · M
- **Low** — No per-token request limit (see L09 H1). · M

### L05 Hosting & Deployment — FAIL · 1/4

**DoD (Docker/gunicorn items N/A: managed Supabase + Expo)**
1. docker compose → **N/A**.
2. gunicorn / non-root containers / migrations on start → **N/A** (equivalent covered by item 4).
3. `.env.example` complete, `.env` git-ignored → **PASS** — `.env`/`.env.*` ignored, only `.env.example` tracked, `.env` never committed in 52 commits; service-role key only via `Deno.env` in Edge Functions.
4. Deploy configs (adapted: `eas.json` + Edge Function/migration deploy) → **FAIL** — no production EAS profile, empty `submit`; `app.json` has no `updates.url` / `extra.eas.projectId`, so `npm run publish` depends on state outside the repo; no function deploy script; `verify_jwt` per function not recorded.
5. `docs/DEPLOY.md` with environment matrix, rollback, smoke test → **FAIL** — missing.
6. Preview and production use separate databases/keys → **FAIL** — one Supabase project; one `.env` feeds Expo Go development and every published update, so development runs against live data.

**Findings**
- **High** — No written release/rollback process. Fix: `docs/DEPLOY.md` with environment matrix, `npm run publish`, `eas update:rollback`/`republish`, `supabase functions deploy <name> [--no-verify-jwt]`, fix-forward migrations with a backup before destructive ones, and a smoke test (sign in, Today loads, `widget-summary` 200 with a PAT, sync drains). · S
- **High** — EAS project link missing (`extra.eas.projectId`, `updates.url`) and channel/branch mismatch (PRD says `preview` channel; `publish` uses branch `main`). Fix: `eas init` and commit the ids; publish with `--channel preview` or map the channel to `main`; add a production profile when TestFlight is real. · S
- **High** — No environment separation: development and tests hit the live project. Fix: a second free project `lifeos-dev` for `.env`; production URL/key as EAS environment variables for publishing (or at minimum document the risk). · M
- **Medium** — `verify_jwt` not recorded; deployed `_shared/ingest.ts` known to differ from the repo copy (`PROGRESS.md:359`). Fix: `[functions.<name>] verify_jwt` blocks + `scripts/deploy-functions.sh` deploying all four from the repo. · S
- **Medium** — No down-migrations or documented backup step (free plan, no PITR). Fix: document fix-forward; `pg_dump` or in-app export before destructive migrations, with your confirmation (already a CLAUDE.md rule). · S
- **Low** — Edge Function timeouts: fine today (no outbound calls); wrap future outbound calls in `AbortSignal.timeout()`. · S
- **Low** — Deployed functions never smoke-tested end-to-end (this container can't reach `*.supabase.co`). Fix: curl smoke test in DEPLOY.md, run from a laptop/phone. · S

### L06 Cloud Compute — PARTIAL · 1/3 (2 partial, 2 N/A)

(The auditor reported "6/10"; scored here as items fully passed out of applicable items.)

**DoD (no own servers, workers, Redis or LLM)**
1. Worker runs locally → **N/A** (Edge runtime is the only server compute).
2. Every long task is a job (idempotent, timeout, retries, failure saved) → **PARTIAL** — the SMS inbox is a real job pattern: a row leaves `expense_inbox` only after it is written, failures keep `last_error` + attempts, dedupe via `txn_ref` (`_shared/ingest.ts:101-176`); missing a max-attempts cap and a time budget. `widget-summary` runs its queries in parallel; the export runs on the phone in 1,000-row pages.
3. 202 + job id + status endpoint → **N/A** (nothing long enough).
4. Region + budget alerts documented → **PARTIAL** — region ap-south-1 in `DECISIONS.md:32`; no DEPLOY.md, no budget/spend-cap note.
5. No GPU → **PASS**.

**Findings**
- **Medium** — Failing inbox rows retried on every request forever (`_shared/ingest.ts:106`, `ingest-sms/index.ts:24-31`). Fix: `.lt('attempts', 5)` + show stuck rows in Parser Lab (same as L02). · S
- **Low** — `processInbox` has no time budget; a big backlog could hit the Edge Function wall-clock/CPU limit. Fix: stop at ~100 s and leave the rest for the next run. · S
- **Low** — No DEPLOY.md with region, function list + `verify_jwt`, cost posture (free plan; spend cap + billing alert if moving to Pro). · S
- **Low** — `authenticate()` writes `last_used_at` on every PAT call (see L02). · S

### L07 CI/CD & Version Control — FAIL · 1/4 (2 N/A)

Local quality gates are strong, but nothing enforces them: no CI, no hooks, no branch protection.

**DoD (adapted)**
1. CI runs lint / types / tests / migrations / build → **FAIL** — no `.github/`; releases go out by hand (`npm run publish`).
2. Mandatory tests (auth, RLS ownership, limits, health) → **PASS** — Jest 117 suites / 862 tests; DB tests in `supabase/tests/{rls,delete_account,ingest,nudges,steps,tasks,views}.sql`. Maestro has one flow, never run (`PROGRESS.md:1030`).
3. Provider calls mocked → **N/A** (no LLM; Supabase mocked in Jest). 4. Eval cases → **N/A**.
5. Pre-commit hooks + gitleaks + `.gitignore` → **PARTIAL** — `.gitignore` good, `.env` never committed; no hooks, no gitleaks.
6. Branch protection documented → **FAIL** — not mentioned anywhere; 53 commits, no merges (work lands without PRs).

**Coverage** (CLAUDE.md wants ≥ 90% for business rules): overall lines 96.3%, branches 85.7%; `src/features/*/lib` lines 99.5% / branches 95.9%; `selectors.ts` lines 100%; `src/lib` lines 100%. Weak branches: `food/lib/logging.ts` 79.6%, `steps/lib/motion.ts` 75%. The `coverageThreshold` in `jest.config.js` only enforces `./src/lib/`.

**Findings**
- **High** — No CI. Fix: `.github/workflows/ci.yml` on PRs + pushes to main: Node 22, `npm ci`, typecheck, lint, `jest --coverage --ci`; a `db` job (apt Postgres + `npm run test:db`, no Docker needed); a `deno` job (`deno check` + `deno lint` on `supabase/functions`). · ½ day
- **High** — No branch protection / PR flow on main. Fix: require a PR + the CI checks, no force pushes; document in README. · 1 h
- **Medium** — Releases manual and ungated (no production EAS profile; `npm run publish` ships with no checks). Fix: production profile + a tag-triggered workflow (`eas update`/`eas build` after CI passes, `EXPO_TOKEN` secret); gated `supabase db push` / `functions deploy`. · ½–1 day
- **Medium** — No secret scanning / pre-commit. Fix: husky + lint-staged + gitleaks (hook and CI); GitHub secret scanning + push protection. · 2 h
- **Medium** — Coverage threshold misses business-rule folders. Fix: add `src/features/*/lib/` and `selectors.ts` (90/80/90/90); raise `logging.ts` / `motion.ts` branches. · 2 h
- **Low** — Jest open-handle warning could make CI flaky (see L01). · 1 h
- **Low** — Maestro e2e never run, one flow. Fix: manual e2e job or document as device-only. · ½ day
- **Low** — Commit message convention not enforced (optional for one developer). · 30 min

### L08 Security & RLS — PARTIAL · 3/5 (no Critical/High)

**DoD**
1. Every query on owned data scoped by user; cross-user tests → **PASS** — client uses anon key + RLS; Edge Functions take the user id only from the token (`_shared/server.ts:26-44`) and every service-role query adds `.eq('user_id', userId)` / inserts `user_id: userId` (`ingest-sms/index.ts:23-54,66`, `quick-log/index.ts:20`, `widget-summary/index.ts:24-114`, `server.ts:54`); `supabase/tests/rls.sql` proves user B sees/changes nothing of A's in every table and view.
2. RLS on every owned table → **PASS** — `_lifeos_prepare_table` (`init_schema.sql:52-58`) on every table; views `security_invoker = on` (`views.sql:8,42,57`); `purge_auth_leftovers` definer with empty `search_path`, service_role only. Caveat: FORCE RLS not set (fine: tables owned by `postgres`), undocumented.
3. Security headers; strict CORS → **FAIL (Low)** — `json()` sets only Content-Type (`server.ts:15-19`). No CORS is correct (no browser callers).
4. Injection guard → **N/A** (no LLM; SMS parsed by regex with a 2,000-char cap).
5. Agent tools allow-listed → **N/A**.
6. No secrets in repo + `docs/SECURITY.md` → **FAIL** — secrets clean (`.env` never committed; no service-role key, JWT or PAT in tree or history; only the public publishable anon key in history, `PROGRESS.md` commit a772d64), but `docs/SECURITY.md` missing and gitleaks not run.
7. `npm audit` no high/critical → **PASS** — 0 high, 0 critical, 21 moderate (all transitive: minimatch via Expo tooling, jest).

**Findings**
- **Medium** — Sign-up settings weak for an open app (`supabase/config.toml:187,190,232`: min password 6, no requirements, confirmations off locally). Fix: email confirmation on, min 8 with letters+digits, leaked-password protection + CAPTCHA in the dashboard; mirror in config.toml. · S
- **Medium** — `docs/SECURITY.md` missing. Fix: threat table (OWASP Top 10 / mobile), DB roles, FORCE-RLS rationale, PAT design, key rotation steps, vulnerability reporting; add gitleaks to a pre-commit hook. · S
- **Low** — Raw Postgres/Auth `error.message` returned in 500s (`ingest-sms:67`, `quick-log:25`, `widget-summary:117`, `delete-account:26,29`). Fix: log detail, return a fixed message. · S
- **Low** — `api_token` "own rows" policy is `for all`: a user can un-revoke their own token via PostgREST (undoes a revoke after a lost phone; cannot reach other users). Fix: narrow policy (insert/select; update only `revoked_at`/`deleted_at`) or a trigger blocking un-revoke and hash changes. · S
- **Low** — No security headers on Edge Function responses. Fix: `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` in `json()`. · S
- **Low** — No rate/size limit on Edge Functions (see L09 H1). · M
- **Low** — Per-function `verify_jwt` not in the repo (PAT functions need off, delete-account on; DECISIONS.md:149). Fix: add `[functions.*] verify_jwt` to `config.toml`. · S
- **Info** — Publishable anon key in git history: public by design, note in SECURITY.md.

### L09 Rate Limiting — FAIL · 2/6

**DoD (adapted: Expo + Supabase, no LLM calls)**
1. Every public endpoint rate-limited; stricter on login/sign-up → **FAIL** — Supabase auth limits only (`supabase/config.toml:202-214`, mapped in `src/features/auth/lib/session.ts:69-73`); no limiter in any Edge Function (`quick-log`, `ingest-sms`, `widget-summary`, `delete-account`). `config.toml` is local-only; open sign-up with no captcha (`config.toml:181,218-222`).
2. Daily quota before expensive work + usage recorded (adapted: per-user write/row budgets) → **FAIL** — no per-user caps; `ingest-sms` reprocesses up to 200 inbox rows per call (`_shared/ingest.ts:12,107`), failed rows retried forever (`ingest.ts:172`).
3. Over-limit → 429 + Retry-After + clear message → **FAIL** — no function returns 429; `json()` can't set headers (`_shared/server.ts:15-19`).
4. Upstream 429 → backoff → fallback → **PASS** — `src/lib/sync.ts:216` (429 = retry), backoff 1s→10m with dead letter after 20 (`sync.ts:39-47,41,166`), single in-flight worker every 60 s.
5. Usage endpoint → **N/A** (free app, no plans).
6. Spend caps / alerts (adapted: Supabase free-tier quotas) → **FAIL** — nothing documented.
7. Tests → **PASS (client side)** — `src/features/sync/__tests__`; no server limiter to test.

**Findings**
- **High H1** — Edge Functions unlimited: a leaked/scripted PAT can flood `water_log`/`expense`/`expense_inbox`; `authenticate()` writes `last_used_at` on every call (`server.ts:39`). Fix: Postgres fixed-window counter (`rate_bucket` + SECURITY DEFINER `hit_rate_limit`) called after `authenticate()`; quick-log 30/min, ingest-sms 20/min, widget-summary 10/min, delete-account 3/h; 429 + Retry-After; update `last_used_at` at most every 5 min. · M
- **High H2** — Hosted auth: open sign-up without captcha (local config also has email confirmation off) → bot accounts, each seeded with default rows, grow the DB toward the free 500 MB. Fix: enable Turnstile/hCaptcha + email confirmation in the hosted project; record hosted limits in DECISIONS.md; purge unconfirmed users > 7 days. · S/M
- **Medium M1** — `req.json()` reads unbounded bodies; `MAX_SMS_LENGTH` checked only after parsing (`server.ts:47-53`, `ingest.ts:187`). Fix: reject Content-Length > 8 KB → 413. · S
- **Medium M2** — inbox retries unbounded, batch 200. Fix: `attempts < 5` filter, batch 50, cap pending rows per user. · S
- **Medium M3** — sync loop keeps pushing after a 429 (`src/features/sync/slice.ts:120`). Fix: also stop on 429/5xx; honour Retry-After. · S
- **Medium M4** — few text-length checks / no per-user row caps. Fix: `char_length` checks on free-text columns + per-user/day insert cap trigger on high-volume tables. · M
- **Low L1** — backoff without jitter (`sync.ts:39-47`). · S
- **Low L2** — `widget-summary` runs 9 queries / up to 400 days per poll; covered by H1, optional `Cache-Control: max-age=60`. · S
- **Low L3** — no runbook for Supabase free-tier quotas; enable usage emails, weekly DB-size check. · S

### L10 Caching & CDN — FAIL · 2/6 (1 N/A)

(The auditor called it PARTIAL; by the kit's rule the missing response cache headers are a failing code item.)

**DoD (adapted to RTK Query + Supabase)**
1. Correct invalidation → **PASS (with a gap)** — every endpoint `providesTags`; all tags invalidated after a sync push and after seeding (`listeners.ts:24-29`); gap below (server-side writes).
2. Per-user cache isolation → **PASS** — account switch / sign-out resets the API cache and every account-scoped slice (`listeners.ts:36-63`, `rootReducer.ts`); Edge Function queries scoped by `user_id`.
3. TTL / staleness → **PARTIAL** — no `refetchOnFocus`/`refetchOnReconnect`/`setupListeners`; RTK's 60 s default for unused entries; rehydrated entries are also collected.
4. Device cache size → **PARTIAL** — per-date entries collected, but some list queries are unbounded (F2).
5. HTTP cache headers on Edge Functions → **FAIL** — `json()` sends only Content-Type (`_shared/server.ts:15-19`); per-user responses lack `Cache-Control: private, no-store`.
6. LLM / prompt / Redis / CDN caching → **N/A**.
7. Cache tests → **PARTIAL** — isolation tested (`src/store/__tests__/account.test.ts`); no test for invalidation after a server-side write.

**Findings**
- **Medium** — Writes made outside the app (SMS ingest, widget/Shortcut quick-log, a second phone) never invalidate the cache; mounted screens like Today keep stale data. Fix: on app-foreground and reconnect, `invalidateTags` for the server-written tags (Expense, Water, DayLog, BlockLog, Task, Steps), or `setupListeners` + `refetchOnFocus`. · S
- **Medium** — `getExpenses` reads all expenses with no bound (`src/features/money/api.ts:24-30`), persisted and re-serialised every 500 ms during activity; grows with years of SMS rows. Fix: date-bounded reads (e.g. last 13 months, older on demand); same for other unbounded lists (see L03). · M
- **Low** — No `Cache-Control` on Edge Function responses. Fix: `'Cache-Control': 'private, no-store'` in `json()`. · XS
- **Low** — A phone cached before F25 keeps that cache for whichever account signs in first (`listeners.ts:52-55`, intentional). Fix: clear when no account is recorded but queries are cached. · XS
- **Info** — `widget-summary` recomputes ~9 queries per 15-min poll; no server cache needed at this load.

### L11 Load Balancing & Scaling — FAIL · 2/5 (1 N/A)

(The auditor called it "pass with gaps": the architecture scales well past hundreds of users, but by the kit's rule the missing health check and load test are failing code items.)

**DoD (adapted)**
- Stateless → **PASS** — every Edge Function builds a fresh client per request (`_shared/server.ts:9-13`); module state only constants/regexes; device state by design.
- `/health` + `/ready` → **FAIL** — no health/ping function, no uptime check (`widget-summary` touches the DB but needs a token).
- Pool sizing / pooled URL → **PASS** — no direct Postgres connections; all traffic via PostgREST/Auth (Supabase's pool).
- LLM fallback / circuit breaker → **N/A** (client sync has backoff + dead letter).
- Provider tier vs peak users → **PARTIAL** — free plan is the hard ceiling, not documented against the target.
- Load test at peak → **FAIL** — no k6/loadtest folder, no CI.

Load per user is modest: sync pushes only with a non-empty queue, every 60 s in the foreground (`useSyncWorker.ts:9,44-52`); the widget refreshes every 15 min (`widgets/scriptable/Life.js:10`).

**Findings**
- **Medium** — No load/smoke test. Fix: `loadtest/k6-smoke.js` against `widget-summary` + `quick-log` with test tokens on a dev project, never production. · S
- **Medium** — Free-plan ceiling not written down. Fix: table in DECISIONS.md (500K Edge Function calls/month, 500 MB DB, egress, 7-day auto-pause) vs per-user use, plus the trigger point for Pro. · S
- **Low** — No liveness probe. Fix: tiny public `health` function (or a `select 1` RPC) + a free uptime pinger (also prevents auto-pause). · S
- **Low** — `last_used_at` written on every token call (~96 writes/day per widget user; see L02). · XS
- **Low** — `widget-summary` sends 9 queries incl. up to 400 days of `day_log`; fine now, merge into one RPC if calls grow. · M

### L12 Error Tracking & Logs — FAIL · 1/5

**DoD (LLM tracing N/A)**
1. Structured logs with request id; `X-Request-ID` returned → **FAIL** — no `console.*` anywhere in `supabase/functions`; `json()` sets only Content-Type (`_shared/server.ts:15-19`); 500s leave no trace (`delete-account/index.ts:27,30`, `quick-log/index.ts:24`, `ingest-sms/index.ts:72`, `widget-summary/index.ts:119-120`).
2. Redaction, no secrets/PII in logs → **PASS** — almost nothing is logged; `devLog` is dev-only and off under Jest (`src/lib/devLog.ts:7`); no SMS text, amounts or tokens logged.
3. Crash reporting client + server, tagged by environment → **FAIL** — no Sentry/Bugsnag/Crashlytics; no error boundary (L01); no global handler.
4. LLM tracing with cost → **N/A**.
5. Uptime check + alert rules (`docs/ALERTS.md`) → **FAIL** — none.
6. Forced test error reaches the tracker → **FAIL** — no tracker.

What works for the user (not the operator): dead-letter list with last error + Retry (`src/lib/sync.ts:41,160-167`, `SyncStatusCard.tsx:46-49,89-91`); SMS inbox attempts/last_error shown in Parser Lab; startup timing shown in More. None of it reaches you unless it happens on your own phone.

**Findings**
- **High** — No crash/error reporting in production builds: crashes, render errors and dead-lettered writes are invisible for every user but you. Fix: `@sentry/react-native` via its Expo config plugin, `Sentry.wrap` the root, `sendDefaultPii: false` + a `beforeSend` that strips bodies and SMS/amount breadcrumbs, environment from the EAS profile, error boundary reporting to Sentry, dead-letter events as table + error kind only, source maps uploaded on EAS builds. · M
- **High** — Edge Functions log nothing, so a 500 can't be diagnosed. Fix: a JSON `log(level, event, {request_id, fn, user_id_hash, code})` helper in `_shared/server.ts`; `crypto.randomUUID()` request id returned as `X-Request-ID`; log every 4xx/5xx without bodies; generic message + request id instead of `error.message`. · S
- **Medium** — `markFailed` never checks its update error and the caller swallows it (`ingest-sms/index.ts:48-53`, `_shared/ingest.ts:171-173`). Fix: check + log. · S
- **Medium** — `auth.getUser` errors dropped: a Supabase Auth outage looks like a 401 (`_shared/server.ts:43`, `delete-account/index.ts:18`). Fix: log; return 503 when it isn't an auth error. · S
- **Medium** — No alerting/uptime (`docs/ALERTS.md` missing). Fix: Sentry alerts; Supabase Log Explorer for Edge Function 5xx; GitHub Actions cron ping of `widget-summary` with a test-account PAT; weekly check for inbox rows with attempts ≥ 3. · S–M
- **Low** — ~25 swallowed `.catch(() => undefined)` sites; most are fine (permissions, haptics), but `syncAuto` and health/steps reads should leave breadcrumbs. · S
- **Low** — Cold-start time never collected. Fix: Sentry measurement with a low `tracesSampleRate`. · S

### L13 Availability & Recovery — FAIL · 0/5 (1 N/A)

**DoD**
1. Targets in a RUNBOOK; PITR or automated backups → **FAIL** — no `docs/RUNBOOK.md`; no RPO/RTO anywhere; free Supabase plan (no PITR, no downloadable backups), though `DECISIONS.md:153` mentions "Supabase's own backups" as if they existed.
2. Nightly off-site backup, manual run succeeds → **FAIL** — no `.github/`, no `pg_dump` script.
3. Restore tested into a scratch DB within RTO → **FAIL** — only the schema is reproducible (`scripts/db-test.sh`); no data restore ever run.
4. Maintenance mode → **N/A** as written (no own server); adapted kill-switch under Low.
5. Friendly messages when dependencies fail, no blank screens → **FAIL (partial)** — strong offline-first writes (queue, backoff, dead letter, persisted cache, NetInfo, SyncStatusCard), but the status card is only on More, no app-wide offline banner, no screen handles `isError`, no error boundary, and a first launch with no cache while Supabase is down shows an endless spinner on Today (`TodayScreen.tsx:285`).
6. RUNBOOK with playbooks + status links → **FAIL** — missing.

**Findings**
- **High** — No backups at all: free plan without PITR and no off-site dump. A bad migration, accidental delete or paused-then-lost project loses all history (RPO effectively unlimited). Fix: `.github/workflows/backup.yml` nightly (cron `30 20 * * *` = 02:00 IST) + on demand: `supabase db dump` / `pg_dump -Fc` of public + auth via the session pooler (DB URL as a GitHub secret), encrypted with age/gpg, uploaded to a private bucket elsewhere (Cloudflare R2 / Backblaze B2), 30 daily + 12 monthly kept. Or move to Pro for PITR. · M
- **High** — No restore drill. Fix: `scripts/backup/restore_db.sh` + `verify_restore.sh` (row counts per export table) reusing the throwaway Postgres from `db-test.sh`; run once, record date/duration/counts in the RUNBOOK; repeat quarterly. · S–M
- **Medium** — No RUNBOOK / RPO / RTO. Fix: `docs/RUNBOOK.md` (suggested RPO 24 h, RTO 4 h; status.supabase.com + Expo status; playbooks: project paused, bad migration, accidental delete, leaked key rotation, exporting the phone's dead-letter queue first). · S
- **Medium** — A user export can't be restored (no import). Fix: "Import from export" in Settings or a script that upserts each table in FK order with owner rewritten to `auth.uid()`; test export → delete account → import. · M
- **Medium** — Degradation not visible app-wide. Fix: global "Offline / Server unreachable" banner from the sync slice in `app/(tabs)/_layout.tsx`, error boundary, error + Retry states, a timeout on the Today spinner. · S–M
- **Low** — No remote maintenance/kill-switch. Fix: an `app_config` flag the client reads; `read_only` pauses the sync worker (writes stay queued) and shows a banner; fail-open if unreadable. · S
- **Low** — Free-plan auto-pause after 7 days of inactivity not monitored. Fix: weekly ping action or a runbook note. · S

## Suggested Plan
- **Week 1 — protect the data:** backups + restore drill (1–2), Edge Function limits (3), sign-up hardening (4), CI + branch protection (5–6).
- **Week 2 — ship safely and see problems:** dev/prod separation (7), Edge Function logging (8), crash reporting + error boundary (9, 14), DEPLOY.md + EAS link (10–11).
- **Week 3 — correctness:** ingest race (12), PKCE (13), soft-delete keys (15), cache refresh (16), idempotent quick-log (17), inbox retry cap (18), SECURITY.md (19).
- **Later:** the remaining Medium and Low items per layer.

Fix one finding at a time ("Fix the High finding #1 from docs/AUDIT-13.md, show me the diff first"). Don't use the kit's `--fix` / `/execute-prp`: they rebuild things in the kit's FastAPI stack.
