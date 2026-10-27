# Architecture decision records

Short records of the decisions that shape ProfitHQ: what was decided, why, and what it costs.
Each one is written when the decision is made and is not rewritten later; a change of mind is a
new record that supersedes the old one.

| #                                           | Decision                                                               | Status   |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| [0001](0001-refresh-token-rotation.md)      | Short-lived access token + rotating refresh token with reuse detection | Accepted |
| [0002](0002-idempotent-sync.md)             | Idempotent sync: natural keys, upserts and a content hash              | Accepted |
| [0003](0003-cogs-snapshot.md)               | COGS is snapshotted onto each order line at sync time                  | Accepted |
| [0004](0004-aggregation-design.md)          | Metrics are computed by single-pass aggregation pipelines              | Accepted |
| [0005](0005-dead-stock-computed-on-read.md) | Dead stock is computed on read, per variant, not stored as flags       | Accepted |

Format: Context, Decision, Consequences, Alternatives considered.
