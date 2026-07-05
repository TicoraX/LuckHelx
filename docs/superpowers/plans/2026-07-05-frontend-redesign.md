# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark/purple-gradient UI with a sober, editorial visual system (light/dark theme, Fraunces+Inter typography) and add targeted animations — a CS:GO-style chest-opening reel, an animated XP counter, and task-completion exit animations — across the three existing pages (dashboard, login, rewards).

**Architecture:** Pure CSS custom-property tokens drive theming (no CSS-in-JS, no Tailwind). `framer-motion` is added as the only new dependency, used narrowly for the two animations that need it (animated counter, exit-on-unmount); everything else is plain CSS keyframes. The chest reel's landing math is a pure, unit-tested function (`buildReel`) consumed by a thin visual component.

**Tech Stack:** Next.js 14 (existing), `next/font/google` (Fraunces, Inter), `framer-motion` (new), Vitest (existing).

## Global Constraints

- No new dependencies beyond `framer-motion` — everything else uses native CSS/JS per the spec's YAGNI call.
- Chest reel items have a fixed CSS width of `120px` (`overflow: hidden` + `text-overflow: ellipsis`) — `buildReel`'s `itemWidth` parameter must stay a real constant, never text-dependent.
- Theme tokens use these exact CSS variable names in both light and dark: `--bg`, `--bg-card`, `--text-main`, `--text-muted`, `--accent`, `--accent-hover`, `--border`.
- Typography variables: `--font-heading` (Fraunces), `--font-body` (Inter).
- No sound/audio in this phase. No "crash into a wall" task-completion animation in this phase — both explicitly deferred per the spec.
- The chest reel always animates toward a result the backend already returned — never spin before the API call resolves.

---

### Task 1: Add framer-motion dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `framer-motion` importable from any component in later tasks.

- [ ] **Step 1: Add the dependency**

Add this line inside `"dependencies"` in `package.json` (after `"googleapis"`):

```json
    "framer-motion": "^11.11.17",
```

- [ ] **Step 2: Install and verify**

Run: `npm install`
Expected: installs without errors, `node_modules/framer-motion` exists.

Run: `npm run build`
Expected: build still succeeds (framer-motion isn't used anywhere yet, so this just confirms the install didn't break anything).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion dependency"
```

---

### Task 2: Rewrite globals.css with theme tokens and animation keyframes

**Files:**
- Modify: `app/globals.css` (full rewrite)

**Interfaces:**
- Produces: CSS custom properties (`--bg`, `--bg-card`, `--text-main`, `--text-muted`, `--accent`, `--accent-hover`, `--border`, `--font-heading`, `--font-body`) resolved via `:root[data-theme="light"]` / `:root[data-theme="dark"]`; utility classes `.fade-in`, `.pop-in`; reel classes `.reel-viewport`, `.reel-marker`, `.reel-track`, `.reel-item` (fixed `120px` item width); shared `.app-header`, `.header-actions`, `.nav-link`, `.theme-toggle` classes — used by Task 4's Header/ThemeToggle and Tasks 8, 9, 11's pages.

- [ ] **Step 1: Replace the full file**

```css
:root {
  --font-heading: 'Fraunces', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;

  --bg: #1c1a17;
  --bg-card: #26231f;
  --text-main: #f2ede6;
  --text-muted: #a39c8f;
  --accent: #d4805f;
  --accent-hover: #c46a48;
  --border: rgba(255, 255, 255, 0.08);
}

:root[data-theme='light'] {
  --bg: #faf8f5;
  --bg-card: #ffffff;
  --text-main: #1c1a17;
  --text-muted: #6b6459;
  --accent: #a8583e;
  --accent-hover: #8a4530;
  --border: rgba(0, 0, 0, 0.08);
}

:root[data-theme='dark'] {
  --bg: #1c1a17;
  --bg-card: #26231f;
  --text-main: #f2ede6;
  --text-muted: #a39c8f;
  --accent: #d4805f;
  --accent-hover: #c46a48;
  --border: rgba(255, 255, 255, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text-main);
  min-height: 100vh;
  transition: background 0.2s, color 0.2s;
}

h1, h2, h3 {
  font-family: var(--font-heading);
  font-weight: 600;
}

/* ---- Shared header (dashboard + rewards) ---- */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  font-family: var(--font-body);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.nav-link:hover {
  color: var(--text-main);
}
.nav-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Theme toggle ---- */
.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-main);
  font-size: 1rem;
  transition: border-color 0.15s;
}
.theme-toggle:hover {
  border-color: var(--accent);
}

/* ---- XP badge ---- */
.xp-badge {
  background: var(--accent);
  color: #fff;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 1.1rem;
}

/* ---- Home dashboard (app/page.tsx) ---- */
.home-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}
.task-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.task-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.1rem 1.4rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  overflow: hidden;
}
.task-title {
  font-size: 1.05rem;
  font-weight: 500;
}
.task-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.task-xp {
  color: var(--accent);
  font-weight: 600;
}
.task-status {
  font-size: 0.8rem;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  background: var(--border);
  color: var(--text-muted);
  text-transform: capitalize;
}

/* ---- Login (app/login/page.tsx) ---- */
.login-page {
  background: var(--bg);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  max-width: 400px;
  width: 90%;
}
.btn-google {
  background: var(--accent);
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 2rem;
  width: 100%;
}
.btn-google:hover {
  background: var(--accent-hover);
}

/* ---- Rewards (app/rewards/page.tsx) ---- */
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}
.alert {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid #10b981;
  color: #10b981;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  text-align: center;
  font-weight: 500;
}
.alert.error {
  background: rgba(239, 68, 68, 0.08);
  border-color: #ef4444;
  color: #ef4444;
}
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}
@media (min-width: 768px) {
  .grid {
    grid-template-columns: 300px 1fr;
  }
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}
.card-title {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.75rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.form-group label {
  font-size: 0.85rem;
  color: var(--text-muted);
}
input, select {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.7rem 1rem;
  color: var(--text-main);
  font-family: inherit;
  transition: border-color 0.15s;
}
input:focus, select:focus {
  outline: none;
  border-color: var(--accent);
}
.btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
}
.btn:hover {
  background: var(--accent-hover);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}
.reward-item {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  text-align: center;
  gap: 0.85rem;
}
.reward-name {
  font-weight: 600;
  font-size: 1rem;
}
.reward-cost {
  color: var(--accent);
  font-weight: 600;
  font-size: 0.85rem;
}
.btn-action {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-main);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  width: 100%;
  font-weight: 500;
}
.btn-action:hover {
  border-color: var(--accent);
}
.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rarity-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
  color: #fff;
}
.rarity-common {
  background: #6b7280;
}
.rarity-rare {
  background: #3b82f6;
}
.rarity-epic {
  background: var(--accent);
}

/* ---- CSS-only animations ---- */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.fade-in {
  animation: fadeInUp 0.3s ease-out both;
}

@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.85);
  }
  70% {
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
.pop-in {
  animation: popIn 0.35s ease-out both;
}

/* ---- Chest reel ---- */
.reel-viewport {
  position: relative;
  width: 100%;
  max-width: 600px;
  height: 140px;
  margin: 0 auto 1.5rem;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
}
.reel-marker {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent);
  transform: translateX(-50%);
  z-index: 2;
}
.reel-track {
  display: flex;
  align-items: center;
  height: 100%;
  will-change: transform;
}
.reel-item {
  flex: 0 0 120px;
  width: 120px;
  height: 110px;
  margin: 0 5px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  text-align: center;
  overflow: hidden;
}
.reel-item span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npm run build`
Expected: build succeeds (existing pages still reference classes that exist in this file — `.container`, `.card`, `.btn`, etc. — nothing removed that Tasks 9-11 haven't updated yet, since those tasks come later and will adopt the renamed/removed classes like `.home-header`/`.header` → `.app-header`. Pages will look unstyled/broken visually until Tasks 9-11 land, but the build itself must still compile.)

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: replace theme with light/dark CSS tokens and animation keyframes"
```

---

### Task 3: Typography and no-flash theme script in layout.tsx

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `--font-heading`/`--font-body` variable names (Task 2).
- Produces: `data-theme` attribute set on `<html>` before hydration, and the `fraunces`/`inter` CSS variable classes applied to `<html>` — consumed by every page via `var(--font-heading)`/`var(--font-body)` in `globals.css`.

- [ ] **Step 1: Replace the file**

```tsx
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

// Runs before React hydrates — reads the saved theme (or system preference) and applies
// data-theme immediately, so there's no flash of the wrong theme on first paint.
const NO_FLASH_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1c1a17" />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run build && npm start`, open the app in a browser, open DevTools → Elements, confirm `<html>` has both a `data-theme="dark"` (or `"light"`) attribute and the two font variable classes from `next/font`.
Expected: no visible flash of an unstyled/wrong-theme page on reload; DevTools → Network shows font files served from your own origin (`/  _next/static/media/...`), not `fonts.googleapis.com`.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add Fraunces/Inter fonts and no-flash theme script"
```

---

### Task 4: ThemeToggle and shared Header components

**Files:**
- Create: `components/ThemeToggle.tsx`
- Create: `components/Header.tsx`

**Interfaces:**
- Consumes: `.theme-toggle`, `.app-header`, `.header-actions` CSS classes (Task 2); `data-theme` attribute convention (Task 3).
- Produces: `<ThemeToggle />` (no props) and `<Header left={ReactNode}>{children}</Header>` — used by Tasks 8 and 11 (dashboard and rewards pages).

- [ ] **Step 1: Create ThemeToggle**

```tsx
// components/ThemeToggle.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light' || current === 'dark') setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Cambiar tema">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

- [ ] **Step 2: Create Header**

```tsx
// components/Header.tsx
'use client';

import ThemeToggle from './ThemeToggle';

export default function Header({
  left,
  children,
}: {
  left: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <header className="app-header">
      {left}
      <div className="header-actions">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build succeeds (these components aren't imported anywhere yet, so this just confirms they compile in isolation).

- [ ] **Step 4: Commit**

```bash
git add components/ThemeToggle.tsx components/Header.tsx
git commit -m "feat: add ThemeToggle and shared Header components"
```

---

### Task 5: FadeIn and AnimatedNumber components

**Files:**
- Create: `components/FadeIn.tsx`
- Create: `components/AnimatedNumber.tsx`

**Interfaces:**
- Consumes: `.fade-in`/`.pop-in` CSS classes (Task 2), `framer-motion`'s `animate` (Task 1).
- Produces: `<FadeIn>{children}</FadeIn>` (used by Tasks 8, 9, and 11 — all three pages) and `<AnimatedNumber value={number} />` (used by Task 8 — dashboard only).

- [ ] **Step 1: Create FadeIn**

```tsx
// components/FadeIn.tsx
export default function FadeIn({ children }: { children: React.ReactNode }) {
  return <div className="fade-in">{children}</div>;
}
```

- [ ] **Step 2: Create AnimatedNumber**

```tsx
// components/AnimatedNumber.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

export default function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [pulsing, setPulsing] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;

    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });

    setPulsing(true);
    const pulseTimeout = setTimeout(() => setPulsing(false), 600);

    prevValue.current = value;
    return () => {
      controls.stop();
      clearTimeout(pulseTimeout);
    };
  }, [value]);

  return <span className={pulsing ? 'pop-in' : undefined}>{display}</span>;
}
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/FadeIn.tsx components/AnimatedNumber.tsx
git commit -m "feat: add FadeIn and AnimatedNumber components"
```

---

### Task 6: Chest reel math (buildReel)

**Files:**
- Create: `lib/chest-reel.ts`
- Test: `lib/chest-reel.test.ts`

**Interfaces:**
- Produces: `buildReel(pool: ReelChestItem[], winnerId: string, itemWidth: number, containerWidth: number, rand?: () => number): { items: ReelChestItem[]; targetOffset: number }` and the `ReelChestItem` type — used by Task 7 (`ChestReel` component).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/chest-reel.test.ts
import { describe, it, expect } from 'vitest';
import { buildReel, ReelChestItem } from './chest-reel';

const pool: ReelChestItem[] = [
  { id: '1', name: 'common item', rarity: 'common' },
  { id: '2', name: 'rare item', rarity: 'rare' },
  { id: '3', name: 'epic item', rarity: 'epic' },
];

describe('buildReel', () => {
  it('places the winner at the fixed landing index in the strip', () => {
    const { items } = buildReel(pool, '2', 120, 600, () => 0);
    expect(items[34].id).toBe('2');
  });

  it('computes a targetOffset that centers the winner under the viewport middle', () => {
    const { targetOffset } = buildReel(pool, '2', 120, 600, () => 0);
    const cellWidth = 130; // itemWidth (120) + fixed 10px gap
    const winnerCenter = 34 * cellWidth + cellWidth / 2;
    expect(targetOffset).toBe(winnerCenter - 300);
  });

  it('throws on an empty pool', () => {
    expect(() => buildReel([], '1', 120, 600)).toThrow();
  });

  it('throws when winnerId is not in the pool', () => {
    expect(() => buildReel(pool, 'missing', 120, 600)).toThrow();
  });

  it('fills non-winner slots using the provided rand function', () => {
    const { items } = buildReel(pool, '2', 120, 600, () => 0.999999);
    expect(items[0].id).toBe('3');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- chest-reel.test.ts`
Expected: FAIL — `Cannot find module './chest-reel'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/chest-reel.ts
export interface ReelChestItem {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic';
}

export interface ReelResult {
  items: ReelChestItem[];
  targetOffset: number;
}

const REEL_LENGTH = 40;
const WINNER_INDEX = 34;
const ITEM_GAP = 10;

export function buildReel(
  pool: ReelChestItem[],
  winnerId: string,
  itemWidth: number,
  containerWidth: number,
  rand: () => number = Math.random
): ReelResult {
  if (pool.length === 0) throw new Error('cannot build a reel from an empty pool');

  const winner = pool.find((item) => item.id === winnerId);
  if (!winner) throw new Error(`winnerId ${winnerId} not found in pool`);

  const cellWidth = itemWidth + ITEM_GAP;

  const items: ReelChestItem[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    items.push(i === WINNER_INDEX ? winner : pool[Math.floor(rand() * pool.length)]);
  }

  const winnerCenter = WINNER_INDEX * cellWidth + cellWidth / 2;
  const targetOffset = winnerCenter - containerWidth / 2;

  return { items, targetOffset };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- chest-reel.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/chest-reel.ts lib/chest-reel.test.ts
git commit -m "feat: add chest reel landing math (buildReel)"
```

---

### Task 7: ChestReel visual component

**Files:**
- Create: `components/ChestReel.tsx`

**Interfaces:**
- Consumes: `buildReel`, `ReelChestItem` (Task 6); `.reel-viewport`/`.reel-marker`/`.reel-track`/`.reel-item` CSS classes (Task 2).
- Produces: `<ChestReel pool={ReelChestItem[]} winnerId={string} onDone={() => void} />` — used by Task 11 (rewards page).

- [ ] **Step 1: Create the component**

```tsx
// components/ChestReel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReel, ReelChestItem } from '@/lib/chest-reel';

const ITEM_WIDTH = 120;
const SPIN_DURATION_MS = 4500;

export default function ChestReel({
  pool,
  winnerId,
  onDone,
}: {
  pool: ReelChestItem[];
  winnerId: string;
  onDone: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<ReelChestItem[]>([]);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const containerWidth = viewportRef.current?.clientWidth ?? 600;
    const { items: reelItems, targetOffset } = buildReel(pool, winnerId, ITEM_WIDTH, containerWidth);
    setItems(reelItems);

    // Start at 0, then move to targetOffset on the next frame so the CSS transition animates it
    // instead of jumping straight there.
    requestAnimationFrame(() => {
      setSpinning(true);
      setOffset(targetOffset);
    });

    const timeout = setTimeout(onDone, SPIN_DURATION_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="reel-viewport" ref={viewportRef}>
      <div className="reel-marker" />
      <div
        className="reel-track"
        style={{
          transform: `translateX(-${offset}px)`,
          transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.85, 0.25, 1)` : 'none',
        }}
      >
        {items.map((item, i) => (
          <div key={i} className="reel-item">
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ChestReel.tsx
git commit -m "feat: add ChestReel visual component"
```

---

### Task 8: Dashboard page redesign

**Files:**
- Modify: `app/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Header`, `FadeIn`, `AnimatedNumber` (Tasks 4-5); `framer-motion`'s `AnimatePresence`/`motion` (Task 1).
- Produces: no change to the page's route or external behavior — same `/api/sync-now`, `/api/tasks/create`, `/api/tasks/complete` calls as before.

- [ ] **Step 1: Replace the file**

```tsx
// app/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import FadeIn from '@/components/FadeIn';
import AnimatedNumber from '@/components/AnimatedNumber';

interface Task {
  id: string;
  title: string;
  xp_value: number | null;
  status: string;
}

export default function Home() {
  const [xpBalance, setXpBalance] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  const loadDashboard = useCallback(async () => {
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
  }, [supabase, router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/sync-now', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
      } else {
        setSyncMessage('Sincronizado.');
        await loadDashboard();
      }
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(''), 4000);
    }
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
      } else {
        setNewTitle('');
        setNewDescription('');
        await loadDashboard();
      }
    } finally {
      setCreating(false);
      setTimeout(() => setSyncMessage(''), 4000);
    }
  }

  async function completeTask(taskId: string) {
    setCompletingId(taskId);
    try {
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
        setTimeout(() => setSyncMessage(''), 4000);
      } else {
        await loadDashboard();
      }
    } finally {
      setCompletingId(null);
    }
  }

  const activeTasks = tasks.filter((t) => t.status !== 'credited');

  return (
    <FadeIn>
      <main className="home-container">
        <Header
          left={
            <div className="xp-badge">
              XP: <AnimatedNumber value={xpBalance ?? 0} />
            </div>
          }
        >
          <button className="nav-link" onClick={syncNow} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
          <a href="/rewards" className="nav-link">
            Ir a recompensas →
          </a>
          <button className="nav-link" onClick={signOut}>
            Cerrar sesión
          </button>
        </Header>

        {syncMessage && <p style={{ color: 'var(--text-muted)' }}>{syncMessage}</p>}

        <div className="task-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nueva tarea (ej. lavar los platos)"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descripción (opcional)"
          />
          <button className="btn" onClick={createTask} disabled={creating || !newTitle.trim()}>
            {creating ? 'Creando...' : 'Crear tarea'}
          </button>
        </div>

        <h2 style={{ marginBottom: '1.5rem' }}>Tus Tareas</h2>
        {activeTasks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay tareas aún.</p>
        ) : (
          <ul className="task-list">
            <AnimatePresence initial={false}>
              {activeTasks.map((task) => (
                <motion.li
                  key={task.id}
                  className="task-item"
                  layout
                  exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="task-title">{task.title}</span>
                  <div className="task-meta">
                    <span className="task-xp">+{task.xp_value ?? '?'} XP</span>
                    <span className="task-status">{task.status}</span>
                    <button
                      className="btn-action"
                      onClick={() => completeTask(task.id)}
                      disabled={completingId === task.id}
                      style={{ width: 'auto' }}
                    >
                      {completingId === task.id ? '...' : 'Completar'}
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, log in, confirm: XP badge shows the balance; creating a task adds a row; clicking "Completar" on a task makes its row fade/collapse out (not just change a status label) and the XP badge counts up smoothly to the new balance.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redesign dashboard with new theme, header, and animations"
```

---

### Task 9: Login page redesign

**Files:**
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `.login-page`/`.login-card`/`.btn-google` CSS classes (Task 2); `FadeIn` (Task 5); `h1` picks up `--font-heading` automatically from the global rule.
- Produces: no behavior change — same `signInWithOAuth` call as before.

- [ ] **Step 1: Replace the file**

```tsx
// app/login/page.tsx
'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import FadeIn from '@/components/FadeIn';

export default function LoginPage() {
  const supabase = createBrowserClient();

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/tasks',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <FadeIn>
      <div className="login-page">
        <main className="login-card">
          <h1 style={{ margin: 0, fontSize: '2.25rem' }}>EStiri</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '1.05rem' }}>
            Inicia sesión para gestionar tus tareas y recompensas
          </p>
          <button className="btn-google" onClick={signIn}>
            Entrar con Google
          </button>
        </main>
      </div>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/login`. Confirm the card uses the new sober palette (no purple gradient text), and toggling the theme from `/` (once logged in) and coming back to `/login` shows the matching theme (no toggle control on this page by design — it just respects whatever `data-theme` is already set).

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: redesign login page with new theme"
```

---

### Task 10: Redeem route returns the winning chest item's id

**Files:**
- Modify: `app/api/redeem/route.ts`

**Interfaces:**
- Produces: `POST /api/redeem` response for `type: 'chest'` rewards now includes `redeemed.id` (the winning `chest_item` row's id) in addition to `name`/`rarity` — required by Task 11 so `ChestReel` can locate the winner inside the pool it renders.

- [ ] **Step 1: Update the redeemedItem type and chest branch**

In `app/api/redeem/route.ts`, change:

```ts
  let redeemedItem: { name: string; rarity?: string } = { name: reward.name };
```

to:

```ts
  let redeemedItem: { id?: string; name: string; rarity?: string } = { name: reward.name };
```

And change:

```ts
    const picked = pickChestItem(chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity })));
    redeemedItem = { name: picked.name, rarity: picked.rarity };
```

to:

```ts
    const picked = pickChestItem(chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity })));
    redeemedItem = { id: picked.id, name: picked.name, rarity: picked.rarity };
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/redeem/route.ts
git commit -m "feat: include winning chest item id in redeem response"
```

---

### Task 11: Rewards page redesign with ChestReel integration

**Files:**
- Modify: `app/rewards/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Header`, `FadeIn` (Task 4-5); `ChestReel` (Task 7); `redeemed.id` on chest responses (Task 10).
- Produces: no route/behavior change beyond the chest-opening flow now showing the reel animation before revealing the result.

- [ ] **Step 1: Replace the file**

```tsx
// app/rewards/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import FadeIn from '@/components/FadeIn';
import ChestReel from '@/components/ChestReel';

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
  const [chestWinner, setChestWinner] = useState<{ id: string; name: string; rarity: string } | null>(null);
  const [revealedItem, setRevealedItem] = useState<{ name: string; rarity: string } | null>(null);
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
      xp_cost: xpCost,
      rarity: type === 'chest_item' ? rarity : null,
    });
    setName('');
    await loadRewards();
  }

  async function redeem(reward: Reward) {
    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId: reward.id }),
    });
    const data = await res.json();

    if (data.error) {
      setMessage(`Error: ${data.error}`);
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (reward.type === 'chest' && data.redeemed.id) {
      setChestWinner(data.redeemed);
      return;
    }

    setMessage(`¡Obtuviste: ${data.redeemed.name}!`);
    setTimeout(() => setMessage(''), 5000);
  }

  const chestItemPool = rewards
    .filter((r) => r.type === 'chest_item')
    .map((r) => ({ id: r.id, name: r.name, rarity: (r.rarity ?? 'common') as 'common' | 'rare' | 'epic' }));

  return (
    <FadeIn>
      <main className="container">
        <Header left={<h1 style={{ margin: 0, fontSize: '1.75rem' }}>Recompensas</h1>}>
          <a href="/" className="nav-link">
            ← Volver al inicio
          </a>
        </Header>

        {chestWinner && (
          <ChestReel
            pool={chestItemPool}
            winnerId={chestWinner.id}
            onDone={() => {
              setRevealedItem({ name: chestWinner.name, rarity: chestWinner.rarity });
              setChestWinner(null);
              setTimeout(() => setRevealedItem(null), 5000);
            }}
          />
        )}

        {revealedItem && (
          <div className="alert pop-in">
            ¡Obtuviste: {revealedItem.name}!{' '}
            <span className={`rarity-badge rarity-${revealedItem.rarity}`}>{revealedItem.rarity}</span>
          </div>
        )}

        {message && <div className={`alert ${message.startsWith('Error') ? 'error' : ''}`}>{message}</div>}

        <div className="grid">
          <aside>
            <section className="card">
              <h2 className="card-title">Nueva recompensa</h2>
              <div className="form-group">
                <label>Nombre</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. 1 hora de juego" />
              </div>
              <div className="form-group">
                <label>Costo XP</label>
                <input type="number" value={xpCost} onChange={(e) => setXpCost(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={type} onChange={(e) => setType(e.target.value as 'shop' | 'chest' | 'chest_item')}>
                  <option value="shop">Tienda</option>
                  <option value="chest">Cofre</option>
                  <option value="chest_item">Objeto de cofre</option>
                </select>
              </div>
              {type === 'chest_item' && (
                <div className="form-group">
                  <label>Rareza</label>
                  <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
                    <option value="common">Común</option>
                    <option value="rare">Raro</option>
                    <option value="epic">Épico</option>
                  </select>
                </div>
              )}
              <button className="btn" onClick={createReward} style={{ marginTop: '1rem' }}>
                Crear
              </button>
            </section>
          </aside>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <section className="card">
              <h2 className="card-title">Tienda</h2>
              {rewards.filter((r) => r.type === 'shop').length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No hay objetos en la tienda.</p>
              ) : (
                <div className="reward-grid">
                  {rewards
                    .filter((r) => r.type === 'shop')
                    .map((r) => (
                      <div key={r.id} className="reward-item">
                        <span className="reward-name">{r.name}</span>
                        <span className="reward-cost">{r.xp_cost} XP</span>
                        <button className="btn-action" onClick={() => redeem(r)}>
                          Canjear
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="card">
              <h2 className="card-title">Cofres</h2>
              {rewards.filter((r) => r.type === 'chest').length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No hay cofres disponibles.</p>
              ) : (
                <div className="reward-grid">
                  {rewards
                    .filter((r) => r.type === 'chest')
                    .map((r) => (
                      <div key={r.id} className="reward-item">
                        <span className="reward-name">📦 {r.name}</span>
                        <span className="reward-cost">{r.xp_cost} XP</span>
                        <button className="btn-action" onClick={() => redeem(r)} disabled={!!chestWinner}>
                          Abrir
                        </button>
                      </div>
                    ))}
                </div>
              )}

              <h3 style={{ marginTop: '2rem', fontSize: '1rem', color: 'var(--text-muted)' }}>Premios posibles</h3>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {rewards
                  .filter((r) => r.type === 'chest_item')
                  .map((r) => (
                    <li
                      key={r.id}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                      }}
                    >
                      {r.name} <span className={`rarity-badge rarity-${r.rarity}`}>{r.rarity}</span>
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/rewards`. Create a chest reward, at least two `chest_item` prizes, and open the chest. Confirm: the reel appears and spins for ~4.5s, lands exactly on an item, then shows the "¡Obtuviste: ...!" reveal with a rarity badge. Confirm shop redemption still works with a plain text message (no reel).

- [ ] **Step 3: Commit**

```bash
git add app/rewards/page.tsx
git commit -m "feat: redesign rewards page with ChestReel integration"
```

---

## Self-Review Notes

- **Spec coverage:** theme tokens (Task 2), typography (Tasks 2-3), no-flash script (Task 3), ThemeToggle/Header (Task 4), FadeIn/AnimatedNumber (Task 5), buildReel + tests (Task 6), ChestReel (Task 7), all three page redesigns (Tasks 8-9, 11), redeem route id field (Task 10) — every spec section maps to a task. "Fuera de alcance" items (sound, wall-crash animation) are intentionally absent.
- **Type consistency:** `ReelChestItem` (Task 6) is used identically in `ChestReel` (Task 7) and the rewards page's `chestItemPool` (Task 11). `redeemedItem`'s `id` field (Task 10) matches `chestWinner.id` usage in Task 11.
- **Placeholder scan:** none found.
