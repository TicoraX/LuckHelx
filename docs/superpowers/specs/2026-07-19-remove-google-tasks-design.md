# Superseded: remove Google Tasks integration, go standalone

## Context

This document is superseded by the Electron/SQLite migration design. The app
now stores and manages tasks locally, with no Google Tasks sync path, no
OAuth-based task source, and no Supabase-backed profile migration to
preserve.

## Goals

- The local Electron app owns task creation and completion entirely.
- DeepSeek evaluation uses the local settings/database flow from the
  Electron migration spec, not Google OAuth or profile-backed refresh
  tokens.
- There is no Google Tasks sync path, no Google Tasks scope, and no cron
  reconciliation loop.

## Out of scope

- Adding email/password auth (explicitly declined — Google-only login stays).
- Any data migration for existing synced tasks (none exist yet).
- Visual/design changes (tracked separately).

## Changes

### Historical notes only

- The Google Tasks sync implementation, refresh-token handling, and
  Supabase migration steps from the original MVP are historical only and
  should not be reintroduced.

### Rewrite

- `app/api/tasks/create/route.ts` — drop the `createGoogleTask` call and the
  `google_refresh_token` profile check. Insert directly into `tasks` (no
  `google_task_id`), call `evaluateAndCacheXp`, return the row.
- `app/api/tasks/complete/route.ts` — drop the `completeGoogleTask` call.
  Just verify the task isn't already `credited`, flip it to `credited` with
  `completed_at`, and award XP via `increment_xp_balance`.
- `app/login/page.tsx` — remove `scopes: 'https://www.googleapis.com/auth/tasks'`
  and `queryParams: { access_type: 'offline', prompt: 'consent' }` from the
  `signInWithOAuth` call. Plain Google sign-in for identity only.
- `app/auth/callback/route.ts` — stop reading/persisting a refresh token onto
  `profiles.google_refresh_token`.

### Schema migration — `supabase/migrations/0003_drop_google_tasks.sql`

```sql
alter table public.profiles drop column google_refresh_token;
alter table public.tasks drop constraint tasks_user_id_google_task_id_key;
alter table public.tasks drop column google_task_id;
```

(Exact constraint name to be confirmed against the actual generated name in
`0001_init.sql` at implementation time — Postgres auto-names unique
constraints from the `unique (user_id, google_task_id)` clause.)

### README

Update setup section: remove `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` Tasks
API scope mention, `CRON_SECRET`, and the "how it works" sync description;
Google Cloud Console step becomes "OAuth client for login only, Tasks API
not required."

## Testing

- `lib/sync.test.ts` doesn't exist today (only `evaluateAndCacheXp`'s
  behavior is exercised indirectly through other tests) — no test changes
  needed there beyond deleting `lib/google-tasks.test.ts`.
- Manual verification: sign in, create a task in-app, complete it, confirm
  XP is credited and the daily DeepSeek call counter still increments
  correctly (existing `lib/deepseek.test.ts` / `lib/xp.test.ts` coverage is
  unaffected by this change since `evaluateAndCacheXp` itself doesn't move).
- `npm test` and `npm run build` must both pass before merging.
