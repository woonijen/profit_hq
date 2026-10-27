# Customer retention

What the CRM Segmenter means by VIP, At-Risk and Churned customers and how they are worked
out. The code (`backend/src/retention/`) implements this document; if the two disagree, fix
whichever is wrong. Money and orders follow [metrics.md](metrics.md); the days arithmetic follows
[dead-stock.md](dead-stock.md).

The question is "who is buying, who is slipping away, and who is gone?", answered from
**recency** (how long since the last order) and **frequency** (how many orders), with **lifetime
spend** shown next to them so the merchant sees what each customer is worth.

## Who is a customer

The unit is the **customer**, identified by `customerShopifyId`.

- Orders without one (**guest checkouts**) cannot be tied to a person, so they are left out of
  every customer figure. The report says how many counted orders were skipped
  (`guestOrders`), so the page can show "N orders from guest checkouts are not included".
- A customer needs at least one counted order to appear. Customers who registered but never
  bought are not listed: the sync imports orders, and a customer record with no orders has
  nothing to segment.

### What counts as an order

The same orders the revenue metrics count: `financialStatus` of `PAID`, `PARTIALLY_REFUNDED` or
`REFUNDED` (see [metrics.md](metrics.md)). Voided, pending, expired, authorized and partially
paid orders are ignored, so an unpaid cart never makes someone look recently active.

A **fully refunded order still counts as an order** (it lowers AOV the same way, and the
customer did come back) but adds nothing to lifetime spend.

## The three numbers per customer

| Number              | Definition                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Orders**          | Number of counted orders: the frequency.                                                                                                |
| **Days since last** | Calendar days in the **store's time zone** from the customer's latest counted order (`processedAt`) to today. An order today is 0 days. |
| **Lifetime spend**  | Sum of the Net Revenue of their counted orders: gross − discounts − refunds, taxes excluded. Integer cents.                             |

Days since last is counted exactly like the dead-stock "days inactive" (same function), so the
two pages cut days the same way and agree with the dashboard ranges.

Lifetime spend is net of refunds attributed to the order, as everywhere else: a refund that
arrives later lowers the customer's spend, not their recency.

## Segments

Every customer falls into exactly one segment. The rules are checked in this order and the first
match wins:

| Segment     | Rule                                                            |
| ----------- | --------------------------------------------------------------- |
| **Churned** | Days since last order is **more than 60**.                      |
| **At-Risk** | Days since last order is **31 to 60**.                          |
| **VIP**     | **3 or more orders** and last order within **30 days**.         |
| **Active**  | Everyone else: ordered within 30 days, but fewer than 3 orders. |

- **Why this order.** Lapsing outranks loyalty: a customer with ten orders who has been silent
  for 45 days is **At-Risk**, not VIP. That is the case the merchant most wants to see, and it is
  why VIP is only checked once the customer is known to be recent.
- **Active is a neutral fourth group.** The three actionable groups are VIP, At-Risk and Churned.
  Without Active, a first-time buyer from last week would have to be called one of them. The UI
  shows Active, but quietly: no alert color, and it is not part of the "needs attention" cues.
- **Boundaries** are inclusive on the older side of each cut: 30 days is still recent (VIP or
  Active), 31 is At-Risk, 60 is still At-Risk, 61 is Churned. Tests cover each of these days.

### Thresholds

The cut-offs are named constants in `backend/src/retention/segments.ts`
(`CHURNED_AFTER_DAYS = 60`, `AT_RISK_AFTER_DAYS = 30`, `VIP_MIN_ORDERS = 3`); change them there
and here together. They are fixed for now rather than a store setting, like the markdown tiers.

They are tuned to the simulated store, whose order history is 90 days
(`MOCK_HISTORY_DAYS`): with a longer cut-off, no customer could ever be Churned in the demo. A
real store buys less often than a mock one, so it would use longer windows (for example 90 and
180 days); that is a one-line change in the constants, and a per-store setting is the next step
if it is ever needed.

## Response

`GET /api/stores/:storeId/customers/segments?segment=…&sort=…&direction=…&page=…&pageSize=…`
(see `/api/docs` once built).

- `segment` is optional: `VIP`, `AT_RISK`, `CHURNED` or `ACTIVE`. Without it every customer is
  listed.
- `sort` is `lifetimeSpend` (default), `orders` or `lastOrder` (days since last order);
  `direction` is `desc` (default) or `asc`. Ties are broken by customer identifier, then
  customer id, so paging is stable.
- Each row: customer id, **identifier** (the email), name, lifetime spend, orders, last order
  date, days since last order and segment.
- **Identifier and name** come from the customer's most recent order that has one, so a changed
  email shows the current one. A customer with no email on any order is shown by their numeric
  Shopify id. The name is a display extra and may be `null`.
- `summary` always covers **every customer**, whatever the `segment` filter, so the summary
  cards stay put while the table is filtered by them. Per segment: customers, lifetime spend,
  **share of revenue** (the segment's spend ÷ the spend of all listed customers, `null` when
  that is 0) and **average spend** (spend ÷ customers, rounded to a cent, 0 when there are no
  customers, like AOV). It also carries the customer total and `guestOrders`.
- The share is of the revenue that belongs to known customers, so it adds up to 100% even though
  guest checkouts have revenue of their own.

## How it is computed

Like dead stock, in two steps, with the second in plain code that is unit-tested without a
database:

1. **One aggregation over the store's orders**, in a single pass: `$match` on `storeId`, the
   counted statuses and a non-null customer; per-order net revenue worked out with `$map` over
   the lines (no `$unwind`, so order-level discount and refund are never multiplied by the line
   count, see [0004](adr/0004-aggregation-design.md)); then `$group` by `customerShopifyId`:
   order count, `$max` of `processedAt`, the sum of net revenue, and the email and name of the
   latest order. A second, tiny `$group` (or a `$facet`) counts the guest orders.
2. **`classify` in code**: days since last order and the segment of each customer, then the
   segment filter, sort, pagination and the per-segment summary.

Segments are **computed on every read, not stored** on a customer or an order. They depend on
today's date, so a stored label would go stale without any data changing, and a threshold
change would need a rewrite of every customer. See the same argument for dead stock in
[0005](adr/0005-dead-stock-computed-on-read.md).

The aggregation has no date bounds on purpose: lifetime spend and the last order of a customer
reach back as far as the data does. It starts from the `storeId` prefix of the
`(storeId, processedAt)` index and returns one small row per customer, so the result stays small
however many orders there are; a DB test checks the plan uses an index. A dedicated
`(storeId, customerShopifyId, processedAt)` index is added only if that check or an `explain`
shows the prefix is not enough. The cost is that every counted order of the store is read once
per request: fine for the simulated data (about a thousand orders), and the reason a per-customer
rollup maintained by the sync is the documented next step, not an accident.

## Simulated data

The mock Shopify generator (`backend/src/shopify/mock/generator.ts`) plants named scenarios, so
every segment exists in the demo store, all inside its 90-day history: frequent recent buyers
(VIP), frequent buyers who went quiet for 31 to 60 days and for more than 60 days, one-time
buyers 31 to 60 days and more than 60 days ago, and one-time recent buyers (Active). Guest
checkouts stay in the data. The customer's name now travels on the order (`customerName`), so
the first sync after that change rewrites every order once, as the dead-stock change did for
products. Run `npm run seed`, or sync, to load them.
