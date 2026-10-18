# LuckHelx

**English** · [Español](README.es.md)

LuckHelx turns your daily tasks into experience points (XP). An LLM (DeepSeek) rates how hard each task is, and you spend the XP you earn in a personal shop, on CS2 cases with real drop odds, on trade-up contracts, or in 1v1 case battles against bots.

It is a local desktop app packaged with Electron. There are no accounts and no cloud backend: everything lives in one SQLite file on your machine.

## Tech stack

* Next.js 14 (App Router, TypeScript) for the UI and the API routes.
* Electron to ship the app as a desktop binary.
* better-sqlite3 as the local on-disk database (one file, one user).
* DeepSeek API, with your own key, to estimate the XP of each task.
* Web Audio API for procedural clicks, fanfares and the case reel sound.
* Vitest for unit and domain tests.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the desktop app in development:
   ```bash
   npm run electron:dev
   ```
   This opens an Electron window backed by the local Next.js server. The database is created on first run in `%APPDATA%/luckhelx/data.db` on Windows, or in the matching user data folder on other systems.

3. Add your DeepSeek key:
   Open Settings in the app and paste your API key. It is stored in the local SQLite file. `GET /api/settings` only reports whether a key exists and never returns it.

4. Run it as a web app only:
   To try it in the browser without Electron:
   ```bash
   npm run dev
   ```
   In this mode the database lives in `.local/data.db`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js development server (web) |
| `npm run electron:dev` | Desktop app in development |
| `npm run build` | Next.js production build |
| `npm run electron:build` | Builds the portable Windows executable |
| `npm test` | Runs the Vitest suite (237 tests) |
| `node csgo/build-cases.js` | Rebuilds `csgo/cs2-cases-preset.json` from the CS2 catalog and fetches Steam prices |
| `node csgo/seed-to-db.js` | Seeds cases, skins and their links into SQLite with an idempotent UPSERT |

## How it works

1. The dashboard opens straight away, with no login screen.
2. DeepSeek rates every new task to assign its XP. Identical descriptions hit a local cache, so the API is not called twice for the same text.
3. When you mark a task as done, SQLite updates the XP balance atomically.
4. In the catalog you define rewards you buy directly and chests that open at random.
5. The catalog ships with 477 real CS2 cases. Each case only drops the skins it contains in the actual game.
6. The economy follows the CS2 market: 1 USD equals 1.00 XP (stored as 100 integer units). Official keys cost 2.49 XP. Case prices follow the Steam Market: the cheapest, such as Snakebite and Fracture, cost 0.25 XP, and rare or older cases cost much more. Cases without a current Steam price fall back to 1.50 XP.
7. Odds are set per rarity tier, not per item. The app first rolls the tier, then picks a random item inside it. The top tier, which holds knives and gloves, has a 1.5% chance.
8. You can keep the skins you unbox in your inventory, sell them at 100% of their market price, combine them in trade-up contracts (10 items of one grade for one of the next grade), or bet them in 1v1 case battles against simulated bots.
9. If Steam has no price for a skin, the app assigns a fixed value by rarity, from $0.50 for common items to $120.00 for knives and gloves, so a sale never gets blocked.
10. The app computes a CS2 Premier Rating (from 1,000 to 35,000+ points) from how consistently you complete habits over a rolling week, your active streak multiplier and daily missions. After more than two days without activity, the rating drops gradually.

## Case opening sound

The reel looks for `public/sounds/case-open.mp3` and plays it from second 5. The file is not in the repository for copyright reasons. If it is missing, the app falls back to procedural clicks generated with the Web Audio API, with no external files.

Press Escape or click during the spin to skip the animation. The server decides the drop as soon as the spin starts, so skipping does not change the result. If your system has `prefers-reduced-motion` enabled, the animation is skipped entirely (0 ms).

## Visual design

The interface borrows from a bookkeeping ledger: tasks are journal entries, XP is an auditable currency and rewards are stamped receipts. It uses warm ink, moss green and brass tones, with Roboto Slab for headings and IBM Plex Mono for numbers.

The CS2 cases section is the one deliberate exception: it uses the game's dark background and real rarity colors to match the original opening experience.

## Security and data integrity

* One local user: there are no sessions and no other people's data to protect. The database is a local file.
* The DeepSeek key stays in the local SQLite file, and no endpoint returns it.
* Every balance change, chest redemption, trade-up contract and case battle runs inside an atomic `db.transaction()`, with a non-negative balance check enforced in SQL.
* Rows in `redemptions`, `item_sales` and `case_battles` are immutable. History is never rewritten.
