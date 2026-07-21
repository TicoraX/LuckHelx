# Migrate to a local Electron desktop app (drop Supabase entirely)

## Context

This app currently depends on Supabase for Postgres storage, Google OAuth,
and Row Level Security — infrastructure that exists to support multiple
users sharing one hosted service. In practice this is a personal,
single-user tool, and the Supabase dependency has been the direct source
of most of this project's friction: OAuth scope debugging, service-role
key handling, a sandboxed dev environment that can't even reach
`*.supabase.co` over DNS. The fix is architectural, not another patch:
stop being a hosted service and become a local desktop app.

## Goals

- The app runs entirely on the user's machine: no Supabase, no cloud
  backend, no network dependency except the DeepSeek API call itself.
- Reuse the existing Next.js code (components, pages, business-logic
  `lib/` functions, CSS) as-is wherever possible — this is a data-layer
  and packaging change, not a rewrite of the UI.
- Testing/dev friction drops to "clone, `npm install`, run" — no OAuth
  console setup, no service-role key, no external service reachability
  required.

## Out of scope

- Cross-device sync (explicitly given up — single local SQLite file).
- Multi-user support of any kind.
- Auto-update infrastructure, code signing, installer polish (YAGNI for
  a personal tool — an unpacked/portable build is enough).
- Visual/CSS changes to `/rewards` or any other page — tracked
  separately, deliberately sequenced *after* this migration so it only
  needs to happen once, against the final data layer.

## Architecture

Electron wraps the existing Next.js app almost unchanged:

- **Frontend**: `app/page.tsx`, `app/rewards/page.tsx`, all `components/`,
  `app/globals.css` — reused as the base, with the dashboard ledger
  structure and responsive CSS included in this migration. They already
  talk to the backend via `fetch()` to `/api/*` routes for writes; this
  migration also moves their remaining **direct client-side Supabase
  reads** behind new `/api/*` GET routes (see "New/changed API routes"
  below), since `better-sqlite3` is a native Node module and cannot run
  in the Electron renderer process — everything touching the database
  must go through a Next.js API route running in the Node process.
- **Backend**: `app/api/*` route handlers stay the shape they are, but
  swap their Supabase calls for `better-sqlite3` calls against a local
  file.
- **Shell**: a new `electron/main.js` — in dev, spawns `next dev` and
  points a `BrowserWindow` at `http://localhost:3000` once it's up
  (poll, don't guess a timeout); in production, spawns the built
  Next.js standalone server on a local port and points the window at
  that instead. No installer auto-launch complexity — just start the
  Node child process and load the URL.
- **Database file location**: `app.getPath('userData')` (Electron's
  standard per-OS convention for local app data), e.g.
  `%APPDATA%/sistema-de-recompensas/data.db` on Windows.

## Data layer

`supabase/migrations/*.sql` → one `lib/db.ts` that opens (or creates, if
missing) the SQLite file and runs `CREATE TABLE IF NOT EXISTS` for each
table on startup. Schema carries over from the Postgres version, with:

- **`profiles` table dropped entirely.** No multi-user, so no per-user
  profile row. `xp_balance` becomes a single key in a `meta`
  key-value table (`key text primary key, value text`) — there is
  exactly one XP balance, no `user_id` to key it by. The same `meta`
  table also holds the DeepSeek API key (see below) and is the natural
  place for any other future singleton setting.
- **`user_id` columns dropped from `tasks`, `rewards`, `redemptions`** —
  nothing to filter by, every query implicitly scopes to "the one
  local database."
- **`deepseek_calls_today`/`deepseek_calls_date` dropped** — the daily
  rate limit existed to stop other people from burning a shared key.
  With a user-supplied key and one user, there's no one else to
  rate-limit against. (If a runaway-loop safety net is wanted later,
  it can be re-added as a simple in-memory counter — not blocking this
  migration.)
- **Atomicity via transactions, not RPCs.** `better-sqlite3` is
  synchronous, so `redeem_xp_if_sufficient` and `increment_xp_balance`
  (currently Postgres functions/RPCs) become plain JS functions wrapping
  a `db.transaction(() => { ... })()` block — a read-check-write with no
  race window, no SQL function needed. `increment_deepseek_calls` has no
  equivalent — it tracked the now-removed daily rate limit.

## Auth — removed entirely

No login page, no Google OAuth, no session, no `auth/callback` route.
The app opens straight to the dashboard. Consequences to handle:

- `app/login/page.tsx` and `app/auth/callback/route.ts` deleted.
- `lib/supabase/client.ts`, `server.ts`, `route-auth.ts` deleted.
- `getAuthedUser()` calls in every API route deleted — routes become
  unconditional (no 401 case, since there's no concept of "not logged
  in").
- "Salir" (sign-out) nav item removed from `Header`/`MobileNav` — signing
  out of a single-local-user app with no accounts is meaningless.
- `supabase.auth.getUser()`/`.signOut()` calls in `page.tsx`/
  `rewards/page.tsx` deleted along with the `router.push('/login')`
  redirect-if-no-session logic.

## DeepSeek API key — a settings screen, not an env var

A small settings modal (reusing the existing modal pattern —
`HelpModal`/`ConfirmModal` are the closest templates) where the user
pastes their own DeepSeek key once. Stored in the same local SQLite
`meta` table as the XP balance — this is a single-user desktop app, not
a hosted service handling other people's secrets, so the bar for "how
carefully must this key be stored" is a local file, not an encrypted
vault. `DEEPSEEK_API_KEY` env var goes away.

## New/changed API routes

| Route | Change |
|---|---|
| `GET /api/state` | **New.** Replaces the direct `supabase.from('profiles')...`/`.from('tasks')...`/`.from('redemptions')...` calls in `page.tsx`'s `loadDashboard()`. Returns `{ xpBalance, tasks, redemptionCount }`. |
| `GET /api/rewards` | **New.** Replaces the direct Supabase reads in `rewards/page.tsx`'s `loadRewards()`. Returns `{ xpBalance, rewards }`; `streak` stays sourced from `GET /api/state`. |
| `POST /api/rewards` | **New.** Replaces the direct `supabase.from('rewards').insert(...)` in `createReward()`. |
| `POST /api/tasks/create` | Swap Supabase for SQLite internally; drop the auth check and `google_refresh_token`-era code already removed earlier. |
| `POST /api/tasks/complete` | Same swap. |
| `POST /api/redeem` | Same swap; the atomic check-then-spend becomes a `db.transaction()` instead of the `redeem_xp_if_sufficient` RPC. |
| `GET /api/settings`, `POST /api/settings` | **New.** Read/write the DeepSeek key. |

`streak` calculation (`calculateStreakFromDates`) is a pure function
already decoupled from Supabase — unaffected, just fed dates from SQLite
instead.

`lib/sync.ts`'s `evaluateAndCacheXp` (shared by `tasks/create` today)
loses its rate-limit branch entirely (the `DAILY_LIMIT`/
`callsMadeToday`/`increment_deepseek_calls` logic) and its cache lookup
becomes a SQLite `SELECT` instead of a Supabase query — otherwise
unchanged: still cache-by-`description_normalized`-then-call-DeepSeek.

## Packaging

- Add `electron`, `electron-builder`, `better-sqlite3` as dependencies.
  `better-sqlite3` has native bindings compiled against a specific
  Node ABI — needs `@electron/rebuild` (or `electron-builder`'s
  built-in native-module rebuild step) so the binary matches Electron's
  bundled Node, not the system Node used for `next build`.
- Remove `@supabase/supabase-js`, `@supabase/ssr`, `next-pwa` (a PWA
  install prompt makes no sense inside an Electron window — Electron
  itself is now "the install"), and their config (`public/manifest.json`,
  the `next-pwa` wrapper in `next.config.js`).
- New scripts: `electron:dev` (concurrently: `next dev` + wait for port
  3000 + launch Electron pointed at it), `electron:build` (`next build`
  with standalone output + `electron-builder` for an unpacked/portable
  Windows build — no signing, no auto-update).
- `.gitignore`: add Electron build output directories (`dist/`, `out/`)
  and confirm the SQLite file itself is never written inside the repo
  (it lives under `app.getPath('userData')`, outside the project tree
  by construction).

## Testing

- All existing pure-function unit tests (`lib/xp.test.ts`,
  `lib/rewards.test.ts`, `lib/chest-reel.test.ts`, `lib/deepseek.test.ts`,
  `lib/streak.test.ts`) are untouched — none of them touch Supabase or
  SQLite directly.
- `lib/google-tasks.test.ts` is already gone (removed in the earlier
  Google Tasks migration).
- New: a small test for the SQLite-backed atomic redeem transaction
  (the equivalent of what `redeem_xp_if_sufficient` guaranteed) —
  concurrent-redeem-can't-double-spend is the one property worth a
  real test, mirroring the rigor the original RPC got.
- `npm run build` must still produce a working Next.js standalone
  build; `electron:build` producing a launchable local `.exe` is the
  final manual acceptance check (no automated E2E in scope here).
