# 0003. COGS is snapshotted onto each order line at sync time

Status: Accepted (Phase 2). Definitions: [docs/metrics.md](../metrics.md)

## Context

Net profit is revenue minus cost of goods sold (COGS). A product's cost changes over time
(suppliers, currency, bulk deals). If profit were computed by looking up the _current_ cost of
each product, then editing a cost today would silently rewrite the profit of every past order,
and last quarter's report would change between two views.

## Decision

The unit cost is **copied onto each order line when the order is first synced**
(`unitCostCents`) and is never rewritten afterwards. COGS of a line is
`unitCostCents × (quantity − refundedQuantity)`. Profit queries read only the order, never the
product collection.

- A line whose cost was unknown at sync time stores `null`, counts as 0 COGS, and is reported
  through `costCoverage` (the share of gross revenue sitting on costed lines) so the UI can warn
  that profit is overstated. A `null` is not filled in later, even if the cost is entered,
  because that would change history.
- When an existing order is rewritten (Shopify changed it), the sync keeps the stored cost of
  lines it already had (`sync/reconcile.ts`). The snapshot is deliberately outside the content
  hash ([0002](0002-idempotent-sync.md)).
- Refunded units are assumed restocked, so their cost is not a loss; `refundedQuantity` is
  kept on the line for this.

## Consequences

- Past profit is stable and reproducible; a cost change affects only orders synced after it.
- Profit aggregations need no join with products, which keeps them to a single indexed pass
  ([0004](0004-aggregation-design.md)).
- Fixing a wrong cost for past orders is not possible through normal syncing. It would need an
  explicit, deliberate "restate costs" operation, which does not exist yet.
- Orders synced before their product's cost was known stay "uncosted" for good. The dashboard
  surfaces this instead of hiding it.
- Order documents carry one extra integer per line.

## Alternatives considered

- **Look the cost up at query time** ($lookup into products): always current, but history
  changes whenever a cost is edited, and every aggregation pays for a join.
- **A versioned cost history per product** with an effective-date lookup: exact, and allows
  restating, but needs a cost-history model and date-range joins; heavy for a first version.
