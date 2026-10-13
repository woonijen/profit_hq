# 0004. Metrics are computed by single-pass aggregation pipelines

Status: Accepted (Phases 4 and 5). Definitions and index review: [docs/metrics.md](../metrics.md)

## Context

The dashboard needs headline numbers for a period _and_ the previous one, and a revenue/margin
series per day or month. Money sums must be exact, a day must be a day in the store's time
zone, and the numbers on the cards must agree with the points of the chart.

## Decision

All metrics are computed in MongoDB with aggregation pipelines, in **one pass over the orders**:

- **`$match` first**, on `storeId`, a `processedAt` range and the counted statuses, so the
  `(storeId, processedAt)` index serves it (asserted with `explain` in the tests).
- **No `$unwind` of line items.** Order-level money (discount, tax, refund) would be multiplied
  by the number of lines. Per-order COGS is worked out with `$map` over the lines instead, and
  the result is grouped per order.
- **Summary**: the current and previous periods are adjacent, so one `$match` covers both and a
  `$group` keyed on a `$cond` puts each order in its period. The two periods are never queried
  separately.
- **Trend**: `$dateTrunc` with the store's time zone cuts days or months (DST included), and
  `$dateToString` names the bucket by its local date. Buckets without orders produce no row; the
  service fills them with zeros afterwards, so charts get a continuous series.
- **Pipelines return sums only** (counts and cents). Everything derived (net revenue, profit,
  AOV, margin, changes) is computed in plain, unit-tested code (`metrics/summary.ts`
  `deriveTotals`). Summary and trend share the match stage, the COGS expression and the
  accumulators (`metrics/period-sums.ts`) and the same `deriveTotals`, so they cannot disagree;
  a test checks that the points of a range add up to the summary.
- **Money is integer cents** end to end; ratios are plain numbers; a ratio with a zero
  denominator is `null`, never 0 or NaN.
- Period bounds are computed in the store's zone (`utils/date-range.ts`) and passed in as UTC
  instants; the pipeline never does calendar arithmetic itself.

## Consequences

- One indexed read per request, no joins; fast at the current scale (about a thousand orders
  per store) and linear in the orders of the period.
- The index does not cover the query: COGS needs every order's lines, so documents are fetched.
  Not measured at much larger scale.
- Pre-aggregated daily rollups would be faster for very large stores but would need cache
  invalidation on every sync and refund; deliberately not built yet.
- Refunds are attributed to the order's period, not the refund date (see `docs/metrics.md`),
  so a past period can shrink when a refund arrives later. This keeps each order
  self-consistent.
- Business definitions live in one document and one code path, so changing a definition is a
  small, reviewable change with a test.

## Alternatives considered

- **`$unwind` lines, then group**: simple to write, but inflates order-level sums; needs a second
  stage to undo it.
- **Compute in Node from fetched orders**: easy to read, but moves every order of the period
  over the network and loses the index-backed server-side reduction.
- **Two queries (current, previous)**: simpler pipelines, twice the reads, and no guarantee both
  saw the same data.
- **Materialised daily rollups**: see consequences; a later optimisation, not a first design.
