# Metric definitions

Dead-stock definitions (the inventory side) live in [dead-stock.md](dead-stock.md); customer
segments (VIP, At-Risk, Churned) live in [retention.md](retention.md).

Exact definitions behind every number on the dashboard. The aggregation code
(`backend/src/metrics/`) implements this document; if the two disagree, fix whichever is wrong.

All money is integer cents in the store's currency. Ratios are plain numbers (0.25 = 25%).

## Which orders count

An order counts when its `financialStatus` is `PAID`, `PARTIALLY_REFUNDED` or `REFUNDED`, and its
`processedAt` falls inside the period.

Excluded: `VOIDED`, `EXPIRED`, `PENDING`, `AUTHORIZED` (no money was captured) and
`PARTIALLY_PAID` (not settled). An order that moves to a counted status on a later sync starts
counting from then on.

## Definitions

| Metric            | Definition                                                                           |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Gross Revenue** | Sum over lines of `unit price × quantity`, before discounts, refunds and tax.        |
| **Discounts**     | Sum of order discounts.                                                              |
| **Refunds**       | Sum of refunded amounts (excluding tax) on counted orders.                           |
| **Net Revenue**   | Gross Revenue − Discounts − Refunds.                                                 |
| **Taxes**         | Sum of order taxes. Reported for information only; never part of any revenue figure. |
| **COGS**          | Sum over lines of `unit cost snapshot × (quantity − refunded quantity)`. See below.  |
| **Net Profit**    | Net Revenue − COGS.                                                                  |
| **Orders**        | Number of counted orders.                                                            |
| **AOV**           | Net Revenue ÷ Orders, rounded to a cent. 0 when there are no orders.                 |
| **Net Margin**    | Net Profit ÷ Net Revenue. `null` when Net Revenue is 0.                              |

## Decisions

- **Refunds belong to the order's period.** A refund is subtracted in the period of the order it
  refunds (`processedAt`), not the day the refund was issued. Orders stay self-consistent
  (`gross − discounts − refunded` is that order's net revenue), at the cost that a past period's
  numbers can shrink when a refund arrives later.
- **COGS ignores refunded units.** We assume refunded goods go back to stock, so their cost is
  not a loss. (Shopify records a per-item "restocked" flag; the simulation does not.) A fully
  refunded order therefore contributes 0 revenue and 0 COGS.
- **COGS is a snapshot.** The unit cost is copied onto the order line when the line is first
  synced and never rewritten, so changing a product's cost later does not change past profit
  (see `docs/sync.md`).
- **Unknown cost counts as 0, and is reported.** A line whose cost was unknown at sync time adds
  0 to COGS, which flatters profit. `costCoverage` shows how much of Gross Revenue sits on lines
  with a known cost (1 = all, and 1 when there are no orders), so the UI can warn when it is
  below 1. An order synced while its cost was unknown keeps `null` even if the cost is entered
  later.
- **Fully refunded orders still count as orders**, so they lower AOV, like Shopify's own count.
- **Periods use the store's time zone.** "Last 7 days" means the 7 calendar days ending today
  (today is partial) in the store's zone, and the comparison period is the 7 calendar days
  right before them. Because today is partial, the comparison tends to look slightly worse
  early in the day. The same applies to 30 and 90 days.

## Period comparison

Each metric is returned for the current and the previous period with its change:

- Money and counts: `changeRatio = (current − previous) ÷ |previous|`, `null` when previous is 0.
- Net Margin: `deltaPoints = current − previous` (a difference of two ratios, not a percentage
  of one), `null` when either side has no margin.

## How the summary is computed

`backend/src/metrics/summary-pipeline.ts` makes one pass over the store's orders:

1. `$match` on `storeId`, the combined range `[previous.from, current.to)` and the counted
   statuses. The two periods touch, so one range read covers both.
2. `$addFields` works out each order's COGS and its "costed" gross from its lines with `$map`.
   Line items are not `$unwind`ed, so order-level money is never multiplied by the line count.
3. `$group` puts each order into `current` or `previous` by `processedAt` and sums everything.

`metrics/summary.ts` then derives Net Revenue, Net Profit, AOV, margin and the comparisons from
those sums (pure code, unit-tested without a database).

## Trend

`GET /api/stores/:storeId/metrics/trend?range=7d|30d|90d&granularity=day|month` returns the
current period as a series, one point per day or month, for charts. It counts, costs and sums
orders exactly like the summary (`metrics/period-sums.ts` is shared, and each point's figures
come from the same `deriveTotals`), so the points of a range add up to the summary's current
period. A test asserts that.

Each point has `date`, `orders`, `grossRevenueCents`, `netRevenueCents`, `cogsCents`,
`netProfitCents`, `netMargin` and `partial`. There is no previous-period series; the summary
carries the comparison.

- **Buckets are calendar days or months in the store's time zone.** `$dateTrunc` cuts at local
  midnight (or the 1st) and `$dateToString` names the bucket by that local date, `YYYY-MM-DD`
  (the 1st for months). The API sends dates, not instants, so the client never has to
  re-interpret them in the store's zone. A DST day is a single bucket, 23 or 25 hours long.
- **Gaps are filled.** Every day (or month) of the range gets a point; where nothing was sold the
  money and order counts are 0 and `netMargin` is `null`. The pipeline returns only buckets
  with orders, and `metrics/trend.ts` fills the rest, so the series is always continuous.
- **Month buckets are clipped to the range.** `30d` ending Jan 15 gives a December bucket
  (Dec 17–31 only) and a January bucket (Jan 1–15 only). A month that covers only part of its
  calendar month inside the range has `partial: true`, so the UI can say so instead of
  presenting it as a full month. Day buckets are never partial (today's is incomplete as in the
  summary, but that is not flagged).
- **`netMargin` is `null` on a bucket with no net revenue**, like everywhere else; a chart
  should draw a gap there, not 0%.

## Indexes

Review of the access path for the summary query:

- **`(storeId, processedAt)` serves it.** Equality on `storeId` and a range on `processedAt` is
  what this index is for. `summary` and `trend` use the same prefix.
  `backend/src/services/metrics.service.test.ts` asserts, for both pipelines, that the plan
  uses it and does not collection-scan.
- **No covering index.** COGS needs every order's `lineItems`, which no reasonable index could
  hold, so the documents are always fetched.
- **`financialStatus` is not in the index.** Adding it would only let the index skip the
  excluded orders (voided and so on, a few percent of orders) before fetching them, in exchange
  for a bigger index and slower writes on every sync. Not worth it; revisit if a real store
  has many non-counted orders.
- Not measured at scale: only the mock data size (about a thousand orders per store) has been
  exercised. Re-check with `explain('executionStats')` if stores grow by orders of magnitude.
