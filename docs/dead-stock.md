# Dead stock

What "dead stock" means in ProfitHQ and how it is worked out. The code
(`backend/src/inventory/`) implements this document; if the two disagree, fix whichever is
wrong. Money and orders follow [metrics.md](metrics.md).

Dead stock is stock that is sitting on the shelf: units you hold, and have not sold for a while.
The planner lists it, so the merchant can decide what to discount or stop reordering.

## Definition

A **variant** is dead stock for a window of **N days** (30, 60 or 90) when all of these hold:

1. Its product is `ACTIVE` (archived and draft products are not for sale, so idle stock there
   is not a selling problem).
2. `inventoryQuantity > 0`.
3. It has not sold on any of the last N calendar days, today included: its **days inactive** is
   at least N.

The unit is the variant, because that is where Shopify keeps the stock count. The UI shows the
product title with the variant beneath it.

### What counts as a sale

A line of an order counts as a sale when:

- the order is **counted** by the revenue metrics (`PAID`, `PARTIALLY_REFUNDED` or `REFUNDED`;
  voided, pending, expired, authorized and partially paid orders are ignored, see
  [metrics.md](metrics.md)), and
- `quantity − refundedQuantity > 0`, i.e. at least one unit stayed sold. A line that was
  refunded in full is not a sale.

The time of the sale is the order's `processedAt`. Refunds are not sales, and a refund arriving
later never makes a variant look "recently sold".

### Days inactive

Calendar days in the **store's time zone** from the last sale to today: a sale earlier today is 0
days, yesterday's is 1. So "dead for 30 days" is the same as "no sale on any of the last 30
calendar days", and it is consistent with how the dashboard cuts its date ranges.

A variant that **never sold** counts from the day its product was created in Shopify
(`shopifyCreatedAt`; products stored before that field existed use the time we first saw them).
A brand-new product is therefore not flagged until it has sat for the full window.

## Windows are cumulative

A variant that is dead for 60 days is also dead for 30. Each window answers "what has not sold
in the last N days", so a bigger window is a subset of a smaller one.

## Response

`GET /api/stores/:storeId/inventory/dead-stock?window=30|60|90&sort=…&direction=…&page=…&pageSize=…`
(see `/api/docs`).

- `sort` is `daysInactive` (default), `stockValue` or `quantity`; `direction` is `desc`
  (default) or `asc`. Rows without a value (unknown cost) always come last; ties are broken by
  product title, then variant id, so paging is stable.
- `totals` cover every dead variant, not just the page: variant count, units, and **capital tied
  up** (`stockValueCents`) and the **monthly holding cost** (`monthlyHoldingCostCents`).
- **Stock value** is `inventoryQuantity × unitCost`. A variant without a cost has no value
  (`null`): it is still listed, but left out of `stockValueCents` and
  `monthlyHoldingCostCents`, and counted in `variantsMissingCost`: the same "unknown is not
  free" rule as COGS.

## Holding cost

What it costs to keep the stuck stock: storage, insurance, and the money tied up in it.

- Per variant per month = `inventoryQuantity × unitCost × holdingCostRate`, rounded half up to a
  whole cent. `null` when the unit cost is unknown ("cost missing").
- `monthlyHoldingCostCents` in `totals` is the sum of the **rounded rows** over every dead
  variant (not just the page), so the total always equals what the rows add up to.
- The rate is a per-store setting, `holdingCostRate`: a fraction of stock value per month,
  **default 0.02 (2%)**, from 0 to 1 in steps of 0.0001 (0.01%). It is stored as a fraction
  (the UI shows a percent) and stores created before the setting read as the default. The
  report echoes the rate it used as `holdingCostRate`.
- Change it with `PATCH /api/stores/:storeId/settings` (`{ "holdingCostRate": 0.035 }`); the
  stores list carries it as `settings.holdingCostRate`.
- The 0.01% step is deliberate: the arithmetic is `quantity × cost × (rate × 10 000) ÷ 10 000`
  on integers, so there is no float drift and a half cent always rounds the same way.

## How it is computed

Two queries, merged in memory by `buildDeadStockReport` (pure code, unit-tested without a
database):

1. The store's active products that have a variant in stock.
2. An aggregation over the store's orders giving the **last sale of every variant**
   (`$match` counted orders → `$unwind` lines → keep lines with net units → `$group` by variant,
   `$max` of `processedAt`).

Dead stock is computed on every read rather than stored as a flag on the product, so it is
always consistent with the latest sync and there is nothing to keep in step.

### Indexes

- The aggregation has no date bounds on purpose: how long a variant has been idle can exceed
  any window. It starts from the `storeId` prefix of the `(storeId, processedAt)` index, and its
  output is one row per variant that ever sold, so it stays small however many orders exist.
  The DB test in `inventory.service.test.ts` checks that the plan uses an index.
- The cost is that every order of the store is read, once per request. Fine for the simulated
  data (about a thousand orders). If a real store outgrows that, keep a per-variant
  `lastSoldAt` that the sync maintains; that is the reason this is a documented decision and
  not an accident.

## Simulated data

The mock Shopify generator (`backend/src/shopify/mock/generator.ts`) plants stalled products,
so every case exists in the demo store: products that stopped selling 20, 35, 50, 65 and 80 days
before the end of the history, two that never sold (one with a missing cost), and one created 10
days ago. All of them are active and in stock. Run `npm run seed`, or sync, to load them.

## Markdown suggestions

Every row carries a suggested discount, picked by its **days inactive**:

| Days inactive | Suggested discount |
| ------------- | ------------------ |
| under 30      | none               |
| 30–59         | **15%**            |
| 60–89         | **30%**            |
| 90 or more    | **50%**            |

The tiers are by how long the variant has been idle, not by the window you are looking at: a
variant idle for 75 days gets 30% in the 30-day and the 60-day views alike. Every row of a
window is already idle for at least that window, so a row never lands under the first tier
(30 days) in practice.

- `suggestedPriceCents` = current price × (100 − discount) ÷ 100, rounded half up to a cent
  (integer maths).
- `marginAfterMarkdownCents` = suggested price − unit cost, per unit; `null` when the cost is
  unknown.
- `belowCost` is true when the suggested price is **under** the unit cost, so the tool never
  recommends a loss without saying so. Selling exactly at cost is break-even and is not flagged.
  With an unknown cost there is nothing to compare with: `belowCost` is false and the row is
  marked "cost missing".

The tier thresholds are the named constant `MARKDOWN_TIERS` in
`backend/src/inventory/markdown.ts`; change them there and here together.
