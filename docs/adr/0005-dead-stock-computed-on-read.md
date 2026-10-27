# 0005. Dead stock is computed on read, per variant, not stored as flags

Status: Accepted (Phase 9). Definitions and index notes: [docs/dead-stock.md](../dead-stock.md)

## Context

The merchant wants to know which products have stock but have stopped selling (30, 60 or 90
days), what that stock costs to hold, and what discount to try. "Dead" depends on the window
asked, on today's date and on the latest sync, so any stored answer goes stale on its own, even
if no data changes. Shopify keeps the stock count on the variant, and a product can have
variants that sell very differently.

## Decision

- **The unit is the variant**, not the product. The UI groups the title and variant for display.
- **A variant is dead for a window of N days** when its product is `ACTIVE`,
  `inventoryQuantity > 0` and it has not sold on any of the last N calendar days in the store's
  time zone. A sale is a line on an order the revenue metrics count, with at least one unit that
  was not refunded; a fully refunded line is not a sale. A variant that never sold counts from
  the day its product was created, so a new product is not flagged on day one.
- **Dead stock is computed on every read.** One aggregation finds the last sale of each variant
  (`$match` counted orders, `$unwind` lines, `$group` by variant with `$max` of `processedAt`);
  a second query reads the in-stock variants; `buildDeadStockReport` merges them in plain,
  unit-tested code. No flag, no `lastSoldAt` field, no scheduled job.
- **Holding cost and markdown tiers are pure functions** of the row (quantity, cost, price, days
  inactive) and one per-store setting, the holding cost rate (a fraction per month, default
  2%). Integer cents throughout; an unknown unit cost is `null` and is left out of the totals
  rather than counted as free, the same rule as COGS.

## Consequences

- Always consistent with the latest sync, with nothing to keep in step: a new order, a refund or
  a changed stock count shows on the next request, and the windows can never disagree.
- The last-sale aggregation has no date bounds, so it reads every order of the store on each
  request. It is index-assisted by the `(storeId, processedAt)` prefix and returns one small row
  per variant, which is fine at about a thousand orders per store. Not measured at larger scale.
- If a store outgrows that, the planned step is a per-variant `lastSoldAt` maintained by the
  sync. That is a different consistency model (it must also handle refunds that arrive later),
  which is why it is not built before it is needed.
- Changing the rate changes every holding cost at once, because nothing was frozen. That is
  intended here: it is a planning figure, not a ledger. (COGS is the opposite, see
  [0003](0003-cogs-snapshot.md).)

## Alternatives considered

- **A `deadSince` or `isDead` flag on the product or variant, set by the sync**: cheap reads,
  but it fixes one window, goes stale as days pass without any sync, and has to be revisited on
  every refund and stock change.
- **A stored `lastSoldAt` per variant**: the scalable version of this design; deferred (see
  consequences).
- **Per product instead of per variant**: simpler table, but hides the variant that is stuck
  while its sibling sells, and stock lives on the variant.
- **Group `$unwind` lines by variant over each window separately**: three reads instead of one,
  and the windows could disagree if data changed in between.
