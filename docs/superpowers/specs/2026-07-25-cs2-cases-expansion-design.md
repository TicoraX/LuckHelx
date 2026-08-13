# CS2 case-opening expansion: real per-case pools, real pricing, full catalog

## Problem

Two commits landed today (`8fd7e2c`, `2d78f71`) already built a working
CS2 case-opening feature: `ChestReel.tsx` (roulette animation, tick sounds,
fullscreen reveal) and `csgo/seed-to-db.js` (seeds 15 real CS2 cases + their
skins into the `rewards` table as `chest` / `chest_item` rows). It's real,
integrated, and already has live data in `.local/data.db` — this spec builds
on it, it doesn't replace it.

Three problems block expanding it the way the user wants:

1. **Shared pool bug.** `chestItemPool` in `app/rewards/page.tsx` takes
   *every* `chest_item` row regardless of which chest it came from. All 15
   cases currently draw from one shared pool of 269 skins. Opening the
   "Chroma Case" can hand you a skin that only ever shipped in the "Danger
   Zone Case". Adding more cases on top of this makes it worse, not just
   bigger.
2. **Fake pricing.** Every case costs a hardcoded 50 XP
   (`csgo/seed-to-db.js:42`), regardless of whether it's a $0.30 case or a
   $12 one. The user wants cost to reflect real value.
3. **Artificial 15-case cap.** `csgo/fetch-cases.js:26` does
   `validCases.slice(0, 15)`. The catalog (`csgo/public/api/en/crates.json`)
   has hundreds of valid cases; the UI needs pagination/filters to make more
   than 15 usable.

Out of scope (explicitly deferred by the user): reselling skins back to XP,
and deleting the unused parts of the vendored `csgo/` catalog clone
(stickers, graffiti, music kits, the Chinese-language duplicate, its GitHub
Actions workflows, etc.) — that cleanup is a separate, later task.

## Data model

Add one table, don't touch the shape of `rewards`:

```sql
CREATE TABLE chest_contents (
  chest_id TEXT NOT NULL REFERENCES rewards(id),
  chest_item_id TEXT NOT NULL REFERENCES rewards(id),
  PRIMARY KEY (chest_id, chest_item_id)
);
```

This is the piece that's missing today. A chest's prize pool becomes "every
`chest_item` joined to this `chest_id` via `chest_contents`", instead of
"every `chest_item` that exists, period." A `chest_item` can appear in more
than one real case (some skins do ship in multiple CS2 cases), so this is a
many-to-many join table, not a column on `chest_item`.

**Knives/gloves are currently never seeded at all.** Each crate in
`crates.json` has two separate item lists: `contains` (the normal skins) and
`contains_rare` (the ultra-low-odds knife/glove drop, tagged
`rarity_ancient_weapon`/"Covert" — the same rarity id CS2 uses for its
highest normal-skin tier, so rarity alone can't distinguish "rare knife
pool" from "top-tier normal skin"; only *which list it came from* can).
`csgo/fetch-cases.js` only ever reads `c.contains`, so today no case can
ever drop a knife or glove. Since the user explicitly wants a "contains a
knife/glove" filter, `build-cases.js` must also read `contains_rare` and
seed those items into the same `chest_contents` pool for their case
(flagged, e.g. a `chest_item.rarity = 'epic'` bucket already fits, or a
dedicated marker if the pool needs to tell them apart later — a plan-time
detail). The filter itself becomes: does this case's `crates.json` entry
have a non-empty `contains_rare`. Rarity-weighted odds (real CS2 drop
chances per tier) are **not** in scope here — `buildReel` already does
uniform random over the pool, unchanged; adding weighting is a separate
future decision, not implied by this filter.

> **Superseded 2026-08-12.** The "separate future decision" was taken. Three
> things in this section no longer describe the code:
>
> - Rare-special items are seeded as `rarity = 'legendary'`, not `'epic'`.
> Sharing the `epic` bucket with ordinary Covert skins made the two
> indistinguishable, which is what the "dedicated marker" escape hatch above
> anticipated.
> - Odds are weighted **by tier**, not uniform and not per item
> (`lib/rewards.ts`). Per-item weighting made a tier's chance depend on how
> many variants it held: a case with 65 knives and 3 common skins handed out
> the rarest tier more than half the time. Rare-special sits at 1.5%, chosen
> over CS2's real 0.26% because at one case a day that figure puts the first
> knife 15 months out for an audience of one.
> - `buildReel` **is** touched: its 39 decoys draw from the same tier
> distribution as the prize. Left uniform, a real case turned the strip into a
> wall of identical gold stars and the star stopped meaning "this is rare".
>
> The `hasRareDrop` filter reads `rarity = 'legendary'` rather than
> `contains_rare.length > 0` as specified here. The two sets are identical by
> construction — `legendary` is exactly what `contains_rare` seeds — but the
> filter now depends on the rarity mapping staying that way. See `CLAUDE.md`.

`image` and `rarity_color` columns on `rewards` currently only exist because
`seed-to-db.js` ALTERs the table at runtime — they're absent from
`initSchema()` in `lib/db.ts`. Fold them into `initSchema()` as nullable
columns so a fresh database has them from the start; drop the ad-hoc
`ALTER TABLE` try/catch from the seed script.

## Pricing pipeline

Real case price → XP cost, 1:1 ($1 USD = 1 XP, rounded to the nearest
integer, minimum 1).

New script, `csgo/build-cases.js`, replaces `fetch-cases.js` +
`seed-to-db.js`'s hardcoded cost:

1. Read `csgo/public/api/en/crates.json`, filter to cases with
   `contains.length > 0` (this is the existing "valid case" filter, just no
   longer sliced to 15).
2. For each valid case, look up its Steam Community Market price via the
   public `priceoverview` endpoint
   (`https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=<name>`),
   using the case's `market_hash_name` from the catalog.
3. Cache results to `csgo/case-prices.json` (`{ [market_hash_name]: { usd, fetchedAt } }`),
   keyed by name, refetched only if missing or older than 7 days. This is
   what keeps repeat runs from hammering Steam's rate limit — a few hundred
   cases fetched once, then reused.
4. Sequential requests with a small delay between them (e.g. 300ms) rather
   than parallel — Steam's endpoint has no documented rate limit, but
   informally throttles/blocks bursts. If a lookup fails (missing price, non-200,
   network error), fall back to a fixed default (e.g. 50 XP) and log which
   cases fell back, rather than aborting the whole run.
5. Write `csgo/cs2-cases-preset.json` in the existing shape (id, name,
   description, image, items[]), plus the resolved `xpCost` per case.

`csgo/seed-to-db.js` changes minimally: read `xpCost` from the preset instead
of hardcoding 50, and additionally insert one `chest_contents` row per
`(case, item)` pair. It stays idempotent (skip rows that already exist by
id), and now also skips `chest_contents` pairs that already exist.

This pipeline only ever runs manually (`node csgo/build-cases.js && node
csgo/seed-to-db.js`) — it's a data-refresh step, not something the running
app calls. No live pricing calls happen from the Next.js server or the
client; nothing here touches request latency or adds a runtime dependency
on Steam being reachable.

## UI: `/rewards` Cofres tab

- **Pool fix**: `chestItemPool` is computed per-chest now (join against
  `chest_contents` for the chest currently being opened), not globally.
  Requires a new store function, `getChestPool(db, chestId): RewardRow[]`,
  and the `/api/rewards` response (or a new endpoint) needs to carry enough
  to compute this client-side, or the pool is fetched at open-time via a
  small dedicated request. (Exact API shape is a plan-time decision — either
  works, this spec fixes the direction, not the wire format.)
- **Pagination**: cases list paginates client-side, 20 per page (the full
  catalog after filtering to valid cases is at most a few hundred rows —
  no need for server-side pagination or infinite scroll).
- **Filters** (combine freely, all client-side over the already-loaded
  chest list):
  - Text search over case name.
  - XP cost range (min/max).
  - "Contiene cuchillo/guante" checkbox — see note below, this is
    `contains_rare.length > 0` on the source crate, not a rarity value.
  - Sort by `created_at` (proxy for catalog recency, since that's what's
    already on the `rewards` row) — newest or oldest first.

No new visual language decisions needed here — the CS2-native rarity-color
look for this section was already approved and is already implemented in
`ChestReel.tsx`/`globals.css` from the two existing commits.

## Testing

- `lib/chest-reel.ts` already has test coverage per repo convention — no
  change needed there, `buildReel` is untouched.
- New: a test for the chest→pool query (given seeded `chest_contents` rows,
  `getChestPool` returns only that chest's items, not the global set) —
  this is the regression test for the bug this spec exists to fix.
- New: a test for the price→XP rounding function in isolation (given a USD
  price, returns the right integer XP; given a missing/failed price, falls
  back to the default) — pure function, no network in tests.
- `csgo/build-cases.js`'s actual Steam Market calls are not unit-tested
  (network I/O, deliberately manual/offline in CI) — only the pure
  price-to-XP conversion is.

## Non-goals (explicit)

- No skin resale / XP buyback — deferred.
- No cleanup of unused `csgo/` catalog files (stickers, graffiti, zh-CN,
  GitHub workflows, etc.) — deferred, separate task.
- No live/per-view pricing display — pricing is a one-time seed-time input
  to `xp_cost`, not a running feature.
