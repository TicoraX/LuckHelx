# Remove Google Tasks integration, go standalone

## Context

The app currently syncs tasks from a user's Google Tasks account (OAuth with
the `tasks` scope, a refresh token stored per-profile, and a cron + manual
"Sincronizar ahora" sync loop that diffs remote vs local tasks). This was the
original MVP design, but it's added recurring OAuth/scope debugging cost and
isn't needed: the app already has full in-app task create/complete, so an
external Google Tasks list isn't the only way to get tasks into the system —
it's just extra surface area.

The anti-abuse mechanism for the DeepSeek AI evaluation (a daily call limit)
is keyed to `profiles.id`, not to the Google refresh token — so dropping
Google Tasks does not reopen the AI-abuse risk that motivated requiring an
authenticated account in the first place. Any authenticated user still gets
rate-limited the same way.

No real users exist yet (dev/testing only), so this is a straight removal
with no data migration path needed.

## Goals

- The app becomes fully standalone: users create and complete tasks entirely
  within it, no external Google Tasks account required.
- Google OAuth remains as the login method (identity only), with the `tasks`
  scope and offline/consent params dropped since no refresh token is needed.
- The per-user DeepSeek daily rate limit continues to work unchanged.

## Out of scope

- Adding email/password auth (explicitly declined — Google-only login stays).
- Any data migration for existing synced tasks (none exist yet).
- Visual/design changes (tracked separately).

## Changes

### Delete entirely

- `lib/google-tasks.ts` and `lib/google-tasks.test.ts` — the Google Tasks API
  client (fetch/create/complete/diff), no longer used by anything.
- `syncProfileTasks` from `lib/sync.ts` — the Google-diffing sync logic.
  `evaluateAndCacheXp` in the same file stays: it's pure
  cache-then-rate-limit-then-call-DeepSeek logic with no Google dependency,
  and is still used by the task-create route.
- `app/api/cron/sync/route.ts` and `app/api/sync-now/route.ts` — nothing left
  to sync once there's no external source.
- The "Sincronizar ahora" button and its handler in `app/page.tsx`, and its
  mirror in `components/MobileNav.tsx` (the `onSync`/`syncing` props).
- The `CRON_SECRET` env var, its `crypto.timingSafeEqual` check, and the
  Vercel cron schedule entry (if any) referencing `/api/cron/sync`.

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
