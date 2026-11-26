# 13-Layer Audit - Life (Lifeos) - 2026-11-26

Stack: Expo SDK 58 / React Native 0.88 (TypeScript, Expo Router, Redux Toolkit + RTK Query, offline sync queue) · Supabase (Postgres + RLS, Auth, Deno Edge Functions) · hosting via Expo Go + EAS Update · **no LLM / AI features** (AI-specific checklist items are N/A).

Audit kit: *13 Layers of a Production AI App* (`/audit-13`), run read-only in waves. Kit checklists were adapted from FastAPI/Vite to this stack. Hosted Supabase dashboard settings were **not** visible to the auditors; findings about them come from `supabase/config.toml` (local) and must be checked in the dashboard.

**Progress:** Wave 1 done (L01, L04, L08, L09) · Wave 2 pending (L02, L03, L05, L12, L13) · Wave 3 pending (L06, L07, L10, L11)

**Wave 1:** 1/4 layers PASS · 0 Critical · 2 High

| # | Layer | Status | Score | Top issue |
|---|-------|--------|-------|-----------|
| L01 | Frontend | PASS | 4/4 | No error boundary; screens rarely show load errors |
| L02 | APIs & Backend Logic | pending (wave 2) | | |
| L03 | Database & Storage | pending (wave 2) | | |
| L04 | Auth & Permissions | PARTIAL | 5/6 | Deep-link tokens allow login CSRF; Edge Function auth untested |
| L05 | Hosting & Deployment | pending (wave 2) | | |
| L06 | Cloud Compute | pending (wave 3) | | |
| L07 | CI/CD & Version Control | pending (wave 3) | | |
| L08 | Security & RLS | PARTIAL | 3/5 | No docs/SECURITY.md; weak sign-up settings; api_token un-revocable by owner |
| L09 | Rate Limiting | FAIL | 2/6 | Edge Functions have no rate/size limits; open sign-up without captcha |
| L10 | Caching & CDN | pending (wave 3) | | |
| L11 | Load Balancing & Scaling | pending (wave 3) | | |
| L12 | Error Tracking & Logs | pending (wave 2) | | |
| L13 | Availability & Recovery | pending (wave 2) | | |

## Fix First (Critical + High, then the highest Mediums; ordered by risk then effort)
1. **[L09 High]** Edge Functions (`quick-log`, `ingest-sms`, `widget-summary`, `delete-account`) have no rate or size limits; a leaked or scripted token can flood your tables · fix: Postgres fixed-window counter checked after `authenticate()`, 429 + Retry-After, 8 KB body cap · M
2. **[L09 High / L08 / L04]** Open sign-up hardening in the hosted Supabase project: CAPTCHA, email confirmation on, password min 8 with letters+digits, leaked-password protection, purge unconfirmed users · S
3. **[L04 Medium]** Login CSRF through `lifeos://auth-callback#access_token=…` (`src/features/auth/lib/authLink.ts:39-41`) · fix: PKCE flow (`flowType: 'pkce'`), accept only `?code`, drop the fragment branch · S
4. **[L01 Medium]** No error boundary: one render error crashes the whole app · fix: `ErrorBoundary` export in `app/_layout.tsx` · S
5. **[L08 Medium]** Write `docs/SECURITY.md` and add a gitleaks pre-commit check · S
6. **[L01 Medium]** Screens rarely show load errors (empty screen, no retry) · fix: `isError`/`refetch` from hooks + Retry banner · M
7. **[L04 Medium]** No tests for Edge Function auth (revoked/unknown PAT, PAT to delete-account) · M
8. **[L09 Medium]** Sync loop keeps pushing after a 429; inbox retries forever; unbounded request bodies · S each

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

## Suggested Plan
- Week 1: items 1–4 above (limits, sign-up hardening, PKCE, error boundary).
- Week 2: SECURITY.md, screen error states, Edge Function auth tests, sync 429 handling.
- Later: the Low items in each layer.
