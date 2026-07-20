# Dashboard structure: quest ledger, not a SaaS skeleton

## Problem

The "quest ledger" identity (moss/brass tokens, mono numerics, dashed
dividers) only lives in color/font choices so far. The dashboard's actual
skeleton is still the generic pattern: hero card + 3 equal-weight stat
tiles + form card + list card — four `.glass-card` boxes of identical
visual weight stacked vertically. That's a SaaS-dashboard structure wearing
ledger colors, not a ledger.

## Direction

One continuous sheet (`.ledger-sheet`), not stacked cards. Real ledger book
structure: column headers, dashed rule between entries, a blank line ready
for the next entry, a double-ruled total at the bottom. `.glass-card` is
NOT deleted — `/rewards` still uses it for its cards. Only `app/page.tsx`
stops using it.

## Structure (top to bottom)

1. **Masthead** (unboxed, sits directly on the page background): greeting
   + subtitle on the left, `StreakBadge` on the right. Below it, the
   existing `XpProgressBar` (level progress within the current 100-XP
   band) stays, narrow width, un-boxed — it's different information from
   the ledger total (current-level progress vs. lifetime balance) so it's
   kept, just not inside a card.

2. **Dense metadata line** (`.ledger-meta`): one line, mono, muted —
   `N pendientes · N completadas · racha N`. No XP figure here — XP only
   appears large once, in the footer (see below), to satisfy "the only
   large figure on the screen."

3. **Toolbar**: the search input, right-aligned, small, sitting just above
   the ledger head. Not a heading + card, just an input.

4. **The ledger sheet** (`.ledger-sheet`, replaces the list/form cards):
   - `.ledger-head`: column headers `FECHA · CONCEPTO · XP · ESTADO`, plus
     a trailing unlabeled 5th column for the row action (no header text —
     real ledgers don't label an actions column). Mono, uppercase,
     letter-spaced, double rule below.
   - `.ledger-row` (existing class, now grid instead of flex):
     `grid-template-columns: 5.5rem 1fr 5rem 7rem 4.5rem` (date / concept /
     xp / status / action), shared via a `--ledger-cols` custom property
     so head and rows never drift apart. XP right-aligned tabular mono.
     Date column added: `created_at` is already a column on `tasks`
     (see `supabase/migrations/0001_init.sql`) but wasn't selected by the
     dashboard query — add it to the `select()` and format short (`19 jul`).
     This is a page-local query change, not a schema/API change.
   - **Blank entry row** (`.ledger-row-new`): same grid, gutter cell shows
     `+` in accent color instead of a date. The concept cell holds the
     title `<input>`. The description `<input>` and the save `<button>`
     are only rendered once `newTitle.trim().length > 0` — an empty ledger
     line doesn't show controls it doesn't need yet.
   - **Footer** (`.ledger-foot`): double rule above, `Saldo total` label
     left, XP balance right — large mono figure, `var(--accent-xp)`. This
     is the one large numeral on the page.

5. **Empty / loading state**: `.ledger-head` stays visible in both cases
   (a ledger without entries still has its columns). Loading: 3 faint
   placeholder rows (`opacity: 0.35`, em-dash placeholders) instead of the
   gray shimmer `.skeleton` bars — `.skeleton` itself is NOT deleted since
   `/rewards` still uses it for shop/chest loading. Empty (no tasks, not
   loading): same faint rows plus the existing "no tasks" message.

## Constraints honored

- Zero new dependencies — plain CSS added to `app/globals.css`.
- Zero changes to `app/api/`, `lib/`, `supabase/` — the only "new data"
  used (`created_at`) is already a column on `tasks`, added to this page's
  existing client-side `select()` call, not a new endpoint.
- Light/dark and accessibility preserved: all colors still route through
  the existing CSS custom properties (both themes), inputs keep their
  `aria-label`s, focus-visible untouched.
- `.glass-card` stays in `globals.css`, used by `/rewards`.

## Judgment calls (not fully specified in the brief, decided here)

- Grid column widths and the specific `--ledger-cols` value.
- Mobile (`≤640px`): the 5-column grid doesn't fit narrow screens. Redefine
  `--ledger-cols` to `1fr 4.5rem` inside the existing mobile media query
  and hide the date/status cells (`display: none`) — concept, XP, and the
  action button are the only columns that matter at that width. This
  matches the app's existing mobile-simplification pattern (bottom nav
  swap, single-column stat grid before this change) rather than
  introducing a new responsive strategy.
- Removed the now-dead `.stats-grid` / `.stat-card` / `.stat-icon` /
  `.stat-info` rules from `globals.css` since after this change nothing in
  the app references them (`/rewards` never used them either — confirmed
  via grep before removing).
- `.skeleton` keyframes/rule are left untouched (still used by `/rewards`).
