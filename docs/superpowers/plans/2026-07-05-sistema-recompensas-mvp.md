# Sistema de Recompensas MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP described in `docs/superpowers/specs/2026-07-04-sistema-recompensas-tareas-design.md` — a Next.js PWA that syncs Google Tasks, has DeepSeek assign XP to each task, and lets the user spend XP on a self-defined shop/chest reward catalog.

**Architecture:** Next.js (App Router) single repo, Supabase for Postgres + Auth, DeepSeek API called server-side only, Google Tasks via the `googleapis` client, a single Vercel Cron endpoint that syncs tasks / evaluates new ones / credits completed ones.

**Tech Stack:** Next.js 14 (TypeScript, App Router), `@supabase/supabase-js`, `@supabase/ssr`, `googleapis`, Vitest, `next-pwa`.

## Global Constraints

- Node 20+, TypeScript strict mode.
- DeepSeek API key and Supabase service role key are server-only — never referenced from client components.
- XP awarded per task is always clamped server-side to `[MIN_XP, MAX_XP]` = `[5, 100]` regardless of what DeepSeek returns — this is the anti-inflation defense, not a suggestion.
- Daily DeepSeek call cap per user: 50 (`DEEPSEEK_DAILY_LIMIT` env var, default 50).
- No new dependency for something a small function already covers (e.g. no fuzzy-matching library for the cache — exact normalized-string match is enough per spec).
- `users.api_key_encrypted` column exists in the schema now (reserved for future developer mode) but no code path reads/writes it in this MVP.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `.gitignore`

**Interfaces:**
- Produces: a runnable Next.js app (`npm run dev`) and a runnable test command (`npm test`) that later tasks build on.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "sistema-de-recompensas",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "googleapis": "^144.0.0",
    "next-pwa": "^5.6.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "jsx": "preserve",
    "noEmit": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.js**

```js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({});
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 5: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DEEPSEEK_DAILY_LIMIT=50
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
.next/
.env
.env.local
public/sw.js
public/workbox-*.js
```

- [ ] **Step 7: Create app/layout.tsx**

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create app/page.tsx**

```tsx
export default function Home() {
  return <main>Sistema de Recompensas</main>;
}
```

- [ ] **Step 9: Install and verify**

Run: `npm install`
Expected: installs without errors.

Run: `npm test`
Expected: `No test files found` (no tests yet — that's fine, confirms Vitest runs).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json next.config.js vitest.config.ts .env.example app .gitignore
git commit -m "chore: scaffold Next.js project"
```

---

### Task 2: Supabase schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `tasks`, `rewards`, `redemptions`, and columns `xp_balance`/`api_key_encrypted` on `auth.users` via a `public.profiles` table — used by every later task that reads/writes data.

- [ ] **Step 1: Write the migration**

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  xp_balance integer not null default 0,
  api_key_encrypted text,
  google_refresh_token text,
  -- deepseek_calls_today/date track ACTUAL DeepSeek calls (not tasks created) for the daily rate limit
  deepseek_calls_today integer not null default 0,
  deepseek_calls_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  google_task_id text not null,
  title text not null,
  description text not null default '',
  -- normalized form of description used for cache lookups; description itself stays raw for display
  description_normalized text not null default '',
  xp_value integer,
  xp_reasoning text,
  status text not null default 'pending' check (status in ('pending', 'evaluated', 'completed', 'credited')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, google_task_id)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'shop': direct redemption. 'chest': fixed cost to open, paid once per open. 'chest_item': prize pool entry, xp_cost unused/ignored for these.
  type text not null check (type in ('shop', 'chest', 'chest_item')),
  name text not null,
  xp_cost integer not null check (xp_cost > 0),
  rarity text check (rarity in ('common', 'rare', 'epic')),
  created_at timestamptz not null default now()
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  xp_spent integer not null,
  redeemed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own tasks" on public.tasks for all using (auth.uid() = user_id);
create policy "own rewards" on public.rewards for all using (auth.uid() = user_id);
create policy "own redemptions" on public.redemptions for all using (auth.uid() = user_id);

create or replace function public.increment_xp_balance(p_user_id uuid, p_amount integer)
returns void
language sql
as $$
  update public.profiles set xp_balance = xp_balance + p_amount where id = p_user_id;
$$;

-- Resets the counter when the stored date is stale, then increments atomically in one statement.
create or replace function public.increment_deepseek_calls(p_user_id uuid)
returns integer
language sql
as $$
  update public.profiles
  set
    deepseek_calls_today = case when deepseek_calls_date = current_date then deepseek_calls_today + 1 else 1 end,
    deepseek_calls_date = current_date
  where id = p_user_id
  returning deepseek_calls_today;
$$;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db push` (requires `supabase link` done once against the project created in the Supabase dashboard)
Expected: migration applies with no errors; running it a second time is a no-op (idempotent — Supabase tracks applied migrations).

Manually verify in the Supabase dashboard SQL editor: `select * from public.tasks limit 1;` returns an empty result with the expected columns, not an error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add Supabase schema for tasks, rewards, redemptions"
```

---

### Task 3: XP clamp and description-cache logic

**Files:**
- Create: `lib/xp.ts`
- Test: `lib/xp.test.ts`

**Interfaces:**
- Produces: `clampXp(raw: number): number`, `normalizeDescription(text: string): string` — used by Task 4 (DeepSeek evaluation) and Task 8 (sync route).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/xp.test.ts
import { describe, it, expect } from 'vitest';
import { clampXp, normalizeDescription, MIN_XP, MAX_XP } from './xp';

describe('clampXp', () => {
  it('passes through values inside the range', () => {
    expect(clampXp(42)).toBe(42);
  });

  it('clamps values above MAX_XP', () => {
    expect(clampXp(999999)).toBe(MAX_XP);
  });

  it('clamps values below MIN_XP', () => {
    expect(clampXp(-5)).toBe(MIN_XP);
  });

  it('clamps non-finite values to MIN_XP', () => {
    expect(clampXp(NaN)).toBe(MIN_XP);
  });
});

describe('normalizeDescription', () => {
  it('lowercases and trims', () => {
    expect(normalizeDescription('  Lavar Los Platos  ')).toBe('lavar los platos');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeDescription('lavar   los    platos')).toBe('lavar los platos');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- xp.test.ts`
Expected: FAIL — `Cannot find module './xp'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/xp.ts
export const MIN_XP = 5;
export const MAX_XP = 100;

export function clampXp(raw: number): number {
  if (!Number.isFinite(raw)) return MIN_XP;
  return Math.min(MAX_XP, Math.max(MIN_XP, Math.round(raw)));
}

export function normalizeDescription(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- xp.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/xp.ts lib/xp.test.ts
git commit -m "feat: add XP clamp and description normalization"
```

---

### Task 4: DeepSeek task evaluation

**Files:**
- Create: `lib/deepseek.ts`
- Test: `lib/deepseek.test.ts`

**Interfaces:**
- Consumes: `clampXp` from `lib/xp.ts` (Task 3).
- Produces: `evaluateTask(input: { title: string; description: string }): Promise<{ xp: number; reasoning: string }>` — used by Task 8 (sync route).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/deepseek.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateTask } from './deepseek';

describe('evaluateTask', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
  });

  it('parses a valid DeepSeek response and returns clamped xp', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ xp: 30, reasoning: 'tarea de dificultad media' }) } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'Lavar los platos', description: 'lavar toda la cocina' });

    expect(result).toEqual({ xp: 30, reasoning: 'tarea de dificultad media' });
  });

  it('clamps an out-of-range xp from the model', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ xp: 999999, reasoning: 'exagerado' }) } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'x', description: 'y' });

    expect(result.xp).toBe(100);
  });

  it('falls back to MIN_XP when the model response is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'no soy json' } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'x', description: 'y' });

    expect(result.xp).toBe(5);
    expect(result.reasoning).toMatch(/no se pudo evaluar/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- deepseek.test.ts`
Expected: FAIL — `Cannot find module './deepseek'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/deepseek.ts
import { clampXp } from './xp';

const SYSTEM_PROMPT = `Eres un evaluador de tareas cotidianas. Dado un titulo y descripcion de tarea,
responde SOLO con un JSON de la forma {"xp": number, "reasoning": string}.
El xp debe estar entre 5 y 100 segun la dificultad/tiempo estimado de la tarea.
Se escéptico: descripciones exageradas o vagas no deben recibir xp alto.`;

export async function evaluateTask(input: { title: string; description: string }): Promise<{ xp: number; reasoning: string }> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Titulo: ${input.title}\nDescripcion: ${input.description}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    return { xp: clampXp(NaN), reasoning: 'no se pudo evaluar: la API de DeepSeek respondio con error' };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  try {
    const parsed = JSON.parse(content);
    return { xp: clampXp(Number(parsed.xp)), reasoning: String(parsed.reasoning ?? '') };
  } catch {
    return { xp: clampXp(NaN), reasoning: 'no se pudo evaluar: respuesta invalida del modelo' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- deepseek.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/deepseek.ts lib/deepseek.test.ts
git commit -m "feat: add DeepSeek task evaluation with clamp and JSON-parse fallback"
```

---

### Task 5: Chest weighted random pick

**Files:**
- Create: `lib/rewards.ts`
- Test: `lib/rewards.test.ts`

**Interfaces:**
- Produces: `pickChestItem(items: ChestItem[], rand?: () => number): ChestItem` and the `ChestItem`/`Rarity` types — used by Task 9 (redeem route).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/rewards.test.ts
import { describe, it, expect } from 'vitest';
import { pickChestItem, ChestItem } from './rewards';

const items: ChestItem[] = [
  { id: '1', name: 'common item', rarity: 'common' },
  { id: '2', name: 'rare item', rarity: 'rare' },
  { id: '3', name: 'epic item', rarity: 'epic' },
];

describe('pickChestItem', () => {
  it('picks the common item when rand returns 0', () => {
    expect(pickChestItem(items, () => 0).id).toBe('1');
  });

  it('picks the epic item when rand returns just under 1', () => {
    expect(pickChestItem(items, () => 0.999999).id).toBe('3');
  });

  it('throws on an empty item list', () => {
    expect(() => pickChestItem([], () => 0.5)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- rewards.test.ts`
Expected: FAIL — `Cannot find module './rewards'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/rewards.ts
export type Rarity = 'common' | 'rare' | 'epic';

export interface ChestItem {
  id: string;
  name: string;
  rarity: Rarity;
}

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 70,
  rare: 25,
  epic: 5,
};

export function pickChestItem(items: ChestItem[], rand: () => number = Math.random): ChestItem {
  if (items.length === 0) throw new Error('cannot pick from an empty chest');

  const totalWeight = items.reduce((sum, item) => sum + RARITY_WEIGHT[item.rarity], 0);
  let roll = rand() * totalWeight;

  for (const item of items) {
    roll -= RARITY_WEIGHT[item.rarity];
    if (roll < 0) return item;
  }

  return items[items.length - 1];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- rewards.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/rewards.ts lib/rewards.test.ts
git commit -m "feat: add weighted random chest item selection"
```

---

### Task 6: Google Tasks diff logic

**Files:**
- Create: `lib/google-tasks.ts`
- Test: `lib/google-tasks.test.ts`

**Interfaces:**
- Produces: `diffTasks(remote: RemoteTask[], local: LocalTask[]): { newTasks: RemoteTask[]; newlyCompleted: LocalTask[] }` (pure, unit-tested) and `fetchGoogleTasks(refreshToken: string): Promise<RemoteTask[]>` (thin `googleapis` wrapper, not unit-tested — exercised in Task 8's manual verification). Used by Task 8 (sync route).

- [ ] **Step 1: Write the failing tests for diffTasks**

```ts
// lib/google-tasks.test.ts
import { describe, it, expect } from 'vitest';
import { diffTasks, RemoteTask, LocalTask } from './google-tasks';

describe('diffTasks', () => {
  it('finds a remote task that has no local counterpart as new', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: false }];
    const local: LocalTask[] = [];

    const { newTasks } = diffTasks(remote, local);

    expect(newTasks).toEqual(remote);
  });

  it('finds a local task marked completed=false but remote completed=true as newly completed', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: true }];
    const local: LocalTask[] = [{ googleTaskId: 'g1', status: 'evaluated' }];

    const { newlyCompleted } = diffTasks(remote, local);

    expect(newlyCompleted).toEqual(local);
  });

  it('does not re-flag a task already credited', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: true }];
    const local: LocalTask[] = [{ googleTaskId: 'g1', status: 'credited' }];

    const { newlyCompleted } = diffTasks(remote, local);

    expect(newlyCompleted).toEqual([]);
  });

  it('does not flag a remote task already tracked locally as new', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: false }];
    const local: LocalTask[] = [{ googleTaskId: 'g1', status: 'pending' }];

    const { newTasks } = diffTasks(remote, local);

    expect(newTasks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- google-tasks.test.ts`
Expected: FAIL — `Cannot find module './google-tasks'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/google-tasks.ts
import { google } from 'googleapis';

export interface RemoteTask {
  googleTaskId: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface LocalTask {
  googleTaskId: string;
  status: 'pending' | 'evaluated' | 'completed' | 'credited';
}

export function diffTasks(remote: RemoteTask[], local: LocalTask[]) {
  const localById = new Map(local.map((t) => [t.googleTaskId, t]));

  const newTasks = remote.filter((r) => !localById.has(r.googleTaskId));

  const newlyCompleted = local.filter((l) => {
    if (l.status === 'credited') return false;
    const match = remote.find((r) => r.googleTaskId === l.googleTaskId);
    return match?.completed === true;
  });

  return { newTasks, newlyCompleted };
}

export async function fetchGoogleTasks(refreshToken: string): Promise<RemoteTask[]> {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: refreshToken });

  const tasksApi = google.tasks({ version: 'v1', auth });
  const lists = await tasksApi.tasklists.list();
  const defaultListId = lists.data.items?.[0]?.id;
  if (!defaultListId) return [];

  const tasks = await tasksApi.tasks.list({ tasklist: defaultListId, showCompleted: true });

  return (tasks.data.items ?? []).map((t) => ({
    googleTaskId: t.id!,
    title: t.title ?? '',
    description: t.notes ?? '',
    completed: t.status === 'completed',
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- google-tasks.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/google-tasks.ts lib/google-tasks.test.ts
git commit -m "feat: add Google Tasks diff logic and API wrapper"
```

---

### Task 7: Supabase clients and Google login

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`

**Interfaces:**
- Produces: `createBrowserClient()` (client components), `createServerClient()` (server components/route handlers, service-role) — used by every route/page from here on.

- [ ] **Step 1: Create the browser client**

```ts
// lib/supabase/client.ts
import { createBrowserClient as createClient } from '@supabase/ssr';

export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create the server client**

```ts
// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

// Service-role client for use in route handlers / cron jobs only — never import this in client components.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 3: Create the login page**

```tsx
// app/login/page.tsx
'use client';

import { createBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createBrowserClient();

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/tasks.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main>
      <button onClick={signIn}>Entrar con Google</button>
    </main>
  );
}
```

- [ ] **Step 4: Create the auth callback route that stores the Google refresh token**

```ts
// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login', request.url));

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return NextResponse.redirect(new URL('/login', request.url));

  const providerRefreshToken = (data.session as any).provider_refresh_token;
  if (providerRefreshToken) {
    const service = createServiceClient();
    await service
      .from('profiles')
      .upsert({ id: data.user!.id, google_refresh_token: providerRefreshToken });
  }

  return NextResponse.redirect(new URL('/', request.url));
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `/login`, click "Entrar con Google", complete the OAuth consent screen.
Expected: redirected to `/`, and in the Supabase dashboard `select google_refresh_token from profiles;` shows a non-null value for the logged-in user.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase app/login app/auth
git commit -m "feat: add Supabase clients and Google OAuth login with Tasks scope"
```

---

### Task 8: Cron sync route (fetch, evaluate, credit)

**Files:**
- Create: `app/api/cron/sync/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `fetchGoogleTasks`, `diffTasks` (Task 6), `evaluateTask` (Task 4), `normalizeDescription` (Task 3), `createServiceClient` (Task 7), `increment_xp_balance`/`increment_deepseek_calls` RPCs (Task 2).
- Produces: `GET /api/cron/sync` — the only entry point that mutates task/XP state from Google Tasks.

> `ponytail:` no cross-user transaction wraps this loop — if the process dies mid-run, the next cron tick (every 15 min) picks up where it left off because inserts are idempotent (`onConflict` below) and completed-but-uncredited tasks are re-detected by `diffTasks`. Upgrade to a single Postgres function only if partial-failure windows start causing visible double-credits.

- [ ] **Step 1: Write the route**

```ts
// app/api/cron/sync/route.ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchGoogleTasks, diffTasks, LocalTask } from '@/lib/google-tasks';
import { evaluateTask } from '@/lib/deepseek';
import { normalizeDescription } from '@/lib/xp';

const DAILY_LIMIT = Number(process.env.DEEPSEEK_DAILY_LIMIT ?? 50);

// Vercel Cron always invokes via GET — this is a platform constraint, not a design choice.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, google_refresh_token, deepseek_calls_today, deepseek_calls_date');

  for (const profile of profiles ?? []) {
    if (!profile.google_refresh_token) continue;

    let remoteTasks;
    try {
      remoteTasks = await fetchGoogleTasks(profile.google_refresh_token);
    } catch {
      // Token revoked or Google API down for this user — skip them, don't abort the whole sync.
      continue;
    }

    const { data: localTasks } = await supabase
      .from('tasks')
      .select('google_task_id, status')
      .eq('user_id', profile.id);

    const local: LocalTask[] = (localTasks ?? []).map((t) => ({
      googleTaskId: t.google_task_id,
      status: t.status,
    }));

    const { newTasks, newlyCompleted } = diffTasks(remoteTasks, local);

    const isNewDay = profile.deepseek_calls_date !== new Date().toISOString().slice(0, 10);
    let callsMadeToday = isNewDay ? 0 : profile.deepseek_calls_today;

    for (const task of newTasks) {
      const normalized = normalizeDescription(task.description || task.title);

      const { data: cached } = await supabase
        .from('tasks')
        .select('xp_value, xp_reasoning')
        .eq('user_id', profile.id)
        .not('xp_value', 'is', null)
        .eq('description_normalized', normalized)
        .limit(1)
        .maybeSingle();

      let xpValue: number;
      let xpReasoning: string;

      if (cached) {
        xpValue = cached.xp_value;
        xpReasoning = cached.xp_reasoning;
      } else if (callsMadeToday >= DAILY_LIMIT) {
        xpValue = 5;
        xpReasoning = 'limite diario de evaluaciones alcanzado, xp minimo asignado';
      } else {
        const evaluated = await evaluateTask({ title: task.title, description: task.description });
        xpValue = evaluated.xp;
        xpReasoning = evaluated.reasoning;
        const { data: newCount } = await supabase.rpc('increment_deepseek_calls', { p_user_id: profile.id });
        callsMadeToday = newCount ?? callsMadeToday + 1;
      }

      await supabase.from('tasks').upsert(
        {
          user_id: profile.id,
          google_task_id: task.googleTaskId,
          title: task.title,
          description: task.description,
          description_normalized: normalized,
          xp_value: xpValue,
          xp_reasoning: xpReasoning,
          status: 'evaluated',
        },
        { onConflict: 'user_id,google_task_id', ignoreDuplicates: true }
      );
    }

    for (const completedTask of newlyCompleted) {
      const { data: taskRow } = await supabase
        .from('tasks')
        .select('id, xp_value')
        .eq('user_id', profile.id)
        .eq('google_task_id', completedTask.googleTaskId)
        .single();

      if (!taskRow) continue;

      await supabase
        .from('tasks')
        .update({ status: 'credited', completed_at: new Date().toISOString() })
        .eq('id', taskRow.id);

      await supabase.rpc('increment_xp_balance', { p_user_id: profile.id, p_amount: taskRow.xp_value ?? 0 });
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add the Vercel Cron config**

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/sync", "schedule": "*/15 * * * *" }
  ]
}
```

Add `CRON_SECRET=` to `.env.example` and set the real value both locally (`.env.local`) and in the Vercel project's environment variables — Vercel automatically sends it as the `Authorization: Bearer` header for cron invocations.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, then in another terminal:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```
Expected: `{"ok":true}`, and in the Supabase dashboard, a new row appears in `tasks` for each Google Task you have pending, with a non-null `xp_value`. Mark a task completed in Google Tasks, run the curl command again, confirm `profiles.xp_balance` increased and that task's `status` became `credited`. Run the curl command a third time with no changes in Google Tasks: expected no new rows and no duplicate-key error (confirms the `onConflict` upsert is working).

- [ ] **Step 4: Commit**

```bash
git add app/api/cron supabase/migrations/0001_init.sql vercel.json .env.example
git commit -m "feat: add cron sync route that evaluates and credits tasks"
```

---

### Task 9: Redeem route (shop + chest)

**Files:**
- Create: `app/api/redeem/route.ts`

**Interfaces:**
- Consumes: `pickChestItem` (Task 5), `createServiceClient` (Task 7).
- Produces: `POST /api/redeem` with body `{ rewardId: string }` — returns `{ redeemed: { name: string; rarity?: string } }` or `{ error: string }`.

> Reward catalog has three `type`s, not two: `shop` (direct redemption), `chest` (a single fixed-cost "open the chest" entry — this is what the user pays for), and `chest_item` (a prize-pool entry with a `rarity` but no meaningful `xp_cost` — the column exists on the row but is never read for payment). Redeeming a `chest` reward charges its `xp_cost` once, then picks randomly among the user's `chest_item` rows. This keeps the price of opening a chest fixed regardless of which prize it yields.

- [ ] **Step 1: Write the route**

```ts
// app/api/redeem/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { pickChestItem } from '@/lib/rewards';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const { rewardId } = await request.json();
  const supabase = createServiceClient();

  const { data: reward } = await supabase.from('rewards').select('*').eq('id', rewardId).eq('user_id', user.id).single();
  if (!reward) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('xp_balance').eq('id', user.id).single();
  if (!profile || profile.xp_balance < reward.xp_cost) {
    return NextResponse.json({ error: 'xp insuficiente' }, { status: 400 });
  }

  let redeemedItem: { name: string; rarity?: string } = { name: reward.name };

  if (reward.type === 'chest') {
    const { data: chestItems } = await supabase
      .from('rewards')
      .select('id, name, rarity')
      .eq('user_id', user.id)
      .eq('type', 'chest_item');

    if (!chestItems || chestItems.length === 0) {
      return NextResponse.json({ error: 'no hay objetos definidos para este cofre' }, { status: 400 });
    }

    const picked = pickChestItem(chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity })));
    redeemedItem = { name: picked.name, rarity: picked.rarity };
  }

  await supabase.rpc('increment_xp_balance', { p_user_id: user.id, p_amount: -reward.xp_cost });
  await supabase.from('redemptions').insert({ user_id: user.id, reward_id: reward.id, xp_spent: reward.xp_cost });

  return NextResponse.json({ redeemed: redeemedItem });
}
```

- [ ] **Step 2: Manual verification**

With a logged-in session (via the browser, since this route reads the auth cookie), insert a test reward directly in Supabase:
```sql
insert into public.rewards (user_id, type, name, xp_cost) values ('<your-user-id>', 'shop', '30 min de juego', 20);
```
Then from the browser console on the running app (`npm run dev`):
```js
fetch('/api/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rewardId: '<reward-id>' }) }).then(r => r.json()).then(console.log)
```
Expected: `{"redeemed":{"name":"30 min de juego"}}` and `profiles.xp_balance` decreased by 20 in the dashboard.

- [ ] **Step 3: Commit**

```bash
git add app/api/redeem
git commit -m "feat: add redeem route for shop and chest rewards"
```

---

### Task 10: Dashboard UI

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `createBrowserClient` (Task 7).
- Produces: the page a logged-in user lands on — no later task depends on its internals.

- [ ] **Step 1: Replace the placeholder page with a real dashboard**

```tsx
// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

interface Task {
  id: string;
  title: string;
  xp_value: number | null;
  status: string;
}

export default function Home() {
  const [xpBalance, setXpBalance] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  // Created once via lazy useState initializer — calling createBrowserClient() directly in the
  // component body would build a new client every render, and using it as a useEffect dependency
  // would then re-trigger that effect forever.
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('xp_balance').eq('id', user.id).single();
      setXpBalance(profile?.xp_balance ?? 0);

      const { data: taskRows } = await supabase
        .from('tasks')
        .select('id, title, xp_value, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setTasks(taskRows ?? []);
    }
    load();
  }, [supabase]);

  return (
    <main>
      <h1>XP: {xpBalance ?? '...'}</h1>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            {task.title} — {task.xp_value ?? '?'} xp ({task.status})
          </li>
        ))}
      </ul>
      <a href="/rewards">Ir a recompensas</a>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, log in, confirm the dashboard shows the current XP balance and the list of synced tasks with their XP and status.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add dashboard showing xp balance and tasks"
```

---

### Task 11: Rewards UI (shop, chest, catalog management)

**Files:**
- Create: `app/rewards/page.tsx`

**Interfaces:**
- Consumes: `createBrowserClient` (Task 7), `POST /api/redeem` (Task 9).
- Produces: the rewards page — terminal UI, no later task depends on it.

- [ ] **Step 1: Write the page**

```tsx
// app/rewards/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

interface Reward {
  id: string;
  type: 'shop' | 'chest' | 'chest_item';
  name: string;
  xp_cost: number;
  rarity: string | null;
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [name, setName] = useState('');
  const [xpCost, setXpCost] = useState(10);
  const [type, setType] = useState<'shop' | 'chest' | 'chest_item'>('shop');
  const [rarity, setRarity] = useState('common');
  const [message, setMessage] = useState('');
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  async function loadRewards() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data } = await supabase.from('rewards').select('*').eq('user_id', user.id);
    setRewards(data ?? []);
  }

  useEffect(() => {
    loadRewards();
  }, []);

  async function createReward() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('rewards').insert({
      user_id: user.id,
      type,
      name,
      // chest_item rows keep a placeholder xp_cost (schema requires > 0) but it's never read for payment.
      xp_cost: xpCost,
      rarity: type === 'chest_item' ? rarity : null,
    });
    setName('');
    await loadRewards();
  }

  async function redeem(rewardId: string) {
    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId }),
    });
    const data = await res.json();
    setMessage(data.error ? `Error: ${data.error}` : `Obtuviste: ${data.redeemed.name}`);
  }

  return (
    <main>
      <h1>Recompensas</h1>
      {message && <p>{message}</p>}

      <section>
        <h2>Crear recompensa</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nombre" />
        <input type="number" value={xpCost} onChange={(e) => setXpCost(Number(e.target.value))} />
        <select value={type} onChange={(e) => setType(e.target.value as 'shop' | 'chest' | 'chest_item')}>
          <option value="shop">tienda</option>
          <option value="chest">cofre (costo fijo por abrir)</option>
          <option value="chest_item">objeto de cofre (premio, sin costo propio)</option>
        </select>
        {type === 'chest_item' && (
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="common">comun</option>
            <option value="rare">raro</option>
            <option value="epic">epico</option>
          </select>
        )}
        <button onClick={createReward}>Crear</button>
      </section>

      <section>
        <h2>Tienda</h2>
        <ul>
          {rewards.filter((r) => r.type === 'shop').map((r) => (
            <li key={r.id}>
              {r.name} ({r.xp_cost} xp) <button onClick={() => redeem(r.id)}>Canjear</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Cofres</h2>
        <ul>
          {rewards.filter((r) => r.type === 'chest').map((r) => (
            <li key={r.id}>
              {r.name} ({r.xp_cost} xp) <button onClick={() => redeem(r.id)}>Abrir</button>
            </li>
          ))}
        </ul>
        <h3>Premios posibles</h3>
        <ul>
          {rewards.filter((r) => r.type === 'chest_item').map((r) => (
            <li key={r.id}>{r.name} [{r.rarity}]</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/rewards`, create one shop reward and one chest item, click "Canjear"/"Abrir" on each.
Expected: the message shows the redeemed item's name, and the dashboard's XP balance (Task 10) reflects the deduction after a refresh.

- [ ] **Step 3: Commit**

```bash
git add app/rewards
git commit -m "feat: add rewards page for catalog management and redemption"
```

---

### Task 12: PWA manifest

**Files:**
- Create: `public/manifest.json`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: an installable PWA — terminal task, nothing depends on it.

- [ ] **Step 1: Create the manifest**

```json
{
  "name": "Sistema de Recompensas",
  "short_name": "Recompensas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111111",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add two placeholder PNGs at `public/icon-192.png` and `public/icon-512.png` (any square image — replace with real branding later).

- [ ] **Step 2: Link the manifest**

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111111" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm start`, open the app in Chrome, open DevTools → Application → Manifest.
Expected: manifest loads with no errors, and Chrome shows an "Install" option in the address bar.

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png app/layout.tsx
git commit -m "feat: add PWA manifest for installability"
```
