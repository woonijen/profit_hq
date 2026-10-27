# ProfitHQ — Task Board

Legend: `[ ]` todo · `[x]` done. IDs are stable; never renumber. Ordered by priority.
Tasks that only you can do live in [user_todo.md](user_todo.md).

## Phase 0 — Foundation

- [x] 1. Root monorepo setup: npm workspaces, root package.json scripts (dev, build, lint, typecheck, test), .gitignore, .editorconfig, .nvmrc
- [x] 2. Shared tooling: tsconfig.base.json, ESLint flat config, Prettier, lint-staged/husky (optional hooks)
- [x] 3. Backend scaffold: TS config, Express app/server split (app.ts vs server.ts), tsx dev runner, folder layout (routes → controllers → services → models)
- [x] 4. Zod-validated env config (backend/src/config/env.ts) + backend/.env.example
- [x] 5. Mongoose connection module with graceful shutdown + GET /api/health
- [x] 6. Core middleware: helmet, cors (credentials), rate-limit, JSON body limit, request-id, pino-http
- [x] 7. Central error handling: AppError, notFound + error middleware, consistent error response shape (no asyncHandler needed: Express 5 forwards rejected promises)
- [x] 8. Request validation middleware (Zod) + typed request helpers
- [x] 9. Frontend scaffold: Vite + React 19 + TS, Tailwind setup, path aliases, frontend/.env.example
- [x] 10. Frontend app shell: React Router, QueryClientProvider, layout (sidebar/topbar), error boundary, 404 page
- [x] 11. API client (fetch/axios wrapper) with base URL, typed errors, credentials: include

## Phase 1 — Authentication (JWT access + refresh rotation)

- [x] 12. User model (email unique, passwordHash, timestamps) + password hashing util
- [x] 13. Token utils: sign/verify access JWT; generate opaque refresh token; hash for storage
- [x] 14. RefreshToken model (userId, tokenHash, family, expiresAt, revokedAt, replacedBy, userAgent/ip) + TTL index
- [x] 15. POST /api/auth/register and /login (sets refresh httpOnly+Secure+SameSite cookie, returns access token)
- [x] 16. POST /api/auth/refresh — rotation + reuse detection (revoke whole family on reuse)
- [x] 17. POST /api/auth/logout (revoke current family, clear cookie) and GET /api/auth/me
- [x] 18. requireAuth middleware (Bearer access token) + auth-specific rate limits
- [x] 19. Frontend auth: AuthProvider, in-memory access token, silent refresh on load
- [x] 20. API client 401 interceptor: single-flight refresh + retry, force logout on failure
- [x] 21. Login / Register pages (form validation, error display) + ProtectedRoute / PublicOnlyRoute

## Phase 2 — Domain model & simulated Shopify data

- [x] 22. Store model (ownerId, shopDomain, currency, timezone) + store bootstrap on register or first sync
- [x] 23. Product/variant model with unitCost; compound unique (storeId, shopifyId)
- [x] 24. Order model: embedded line items with COGS snapshot, discounts, taxes, refunds, financialStatus, processedAt; indexes for (storeId, processedAt) and unique (storeId, shopifyId); capture customer fields now for later Dead Stock / Retention work
- [x] 25. SyncRun model (status, counts inserted/updated/unchanged, startedAt/finishedAt, error)
- [x] 26. Shopify payload types + Zod schemas (orders, products, customers) modeled on the Admin GraphQL API (Order, LineItem, ProductVariant incl. inventoryItem.unitCost, Customer, Refund), simplified for the simulation
- [x] 27. Deterministic mock Shopify data generator (seeded RNG, N days of orders, refunds, discounts) — same seed ⇒ same payload; output shaped like real Admin GraphQL responses (edges/nodes, pageInfo cursors, MoneyV2 strings, gid:// ids)
- [x] 28. Mock "Shopify API" adapter behind a ShopifyClient interface (so a real client can be swapped in later)

## Phase 3 — Idempotent Sync Engine

- [x] 29. Mappers: Shopify payload → internal documents (normalize money, dates, COGS lookup from product cost)
- [x] 30. bulkWrite layer: batched, unordered upserts keyed on (storeId, shopifyId); $set mutable fields, $setOnInsert immutable; skip unchanged via contentHash
- [x] 31. Sync service: fetch pages → map → bulkWrite in chunks → aggregate BulkWriteResult into SyncRun; products synced before orders
- [x] 32. Concurrency guard: prevent two simultaneous syncs per store (lock via SyncRun status / unique partial index)
- [x] 33. POST /api/stores/:id/sync (auth + ownership check) and GET /api/stores/:id/sync/status|latest
- [x] 34. Idempotency proof: documented invariant + automated test — run sync 3×, revenue/order counts identical
- [x] 35. Partial-failure handling: per-batch error capture, resumable, clear SyncRun error info

## Phase 4 — Net Profit Dashboard (backend)

- [x] 36. docs/metrics.md: exact definitions of Gross Revenue, Net Revenue, COGS, Taxes, Net Profit, AOV, Net Margin
- [x] 37. Date-range parsing util (7d/30d/90d → UTC bounds in store timezone) + Zod schema
- [x] 38. Aggregation pipeline: summary metrics ($match → $unwind lines → $group) with $facet/single-pass design
- [x] 39. GET /api/stores/:id/metrics/summary?range=… returning cards + previous-period comparison
- [x] 40. Index review with explain() notes; add covering indexes if needed
- [x] 41. Unit/integration tests for pipelines using a seeded fixture with hand-computed expected values

## Phase 5 — Trend data (backend)

- [x] 42. Aggregation pipeline: $dateTrunc by day|month in store timezone → revenue, COGS, net profit, net margin
- [x] 43. Gap-filling (zero rows for days with no orders) so charts have continuous series
- [x] 44. GET /api/stores/:id/metrics/trend?range=7d|30d|90d&granularity=day|month
- [x] 45. Tests for trend bucketing, timezone edge cases, gap fill

## Phase 6 — Frontend: Sync + Dashboard + Trends

- [x] 46. Typed API hooks (TanStack Query): useSummary, useTrend, useSyncStatus, useStartSync
- [x] 47. Sync status state machine (idle → syncing → success | error → idle) via useReducer/mutation state
- [x] 48. SyncButton + SyncStatusIndicator (a11y: aria-live, disabled while syncing, auto-reset after success, retry on error)
- [x] 49. Skeleton components (card, chart) + Tailwind animate-pulse; shown while syncing/loading
- [x] 50. Metric cards: Gross Revenue, COGS, Net Profit, AOV (currency/percent formatters, delta vs prev period)
- [x] 51. Date range filter (7/30/90) synced to URL search params
- [x] 52. Recharts trend chart: revenue vs net margin (dual axis), tooltip, legend, responsive container
- [x] 53. Day/Month granularity toggle
- [x] 54. Empty / error / first-run states ("Run your first sync")
- [x] 55. Invalidate dashboard queries after successful sync
- [x] 56. Responsive layout + dark-mode-ready Tailwind tokens; accessibility pass (focus, contrast, chart labels)

## Phase 7 — Quality, DX & Portfolio polish

- [x] 57. Backend test setup: Vitest + Supertest against dedicated cloud test DB; auth flow tests incl. refresh reuse detection
- [x] 58. Frontend tests: auth guard, sync state machine, metric card formatting (Vitest + RTL)
- [x] 59. Seed script (npm run seed) to create demo user + store + mock data
- [x] 60. OpenAPI/Swagger doc (or typed route docs) for the API
- [x] 61. GitHub Actions CI: install, lint, typecheck, test, build
- [x] 62. Dockerfiles + docker-compose (app only; Mongo stays on Atlas)
- [x] 63. README: overview, screenshots, architecture diagram, setup, env table, API summary
- [x] 64. ADRs in docs/adr: token rotation, idempotent sync, COGS snapshot, aggregation design
- [x] 65. Security review pass: cookie flags, CORS, rate limits, NoSQL-injection sanitization, secrets, logging PII

## Phase 8 — Backlog (planned, not in current scope)

- [ ] 66. Dead Stock: 30/60/90-day no-sale flags, holding cost, markdown suggestions (umbrella task, broken down in Phase 9: tasks 70–90; tick when all of those are done)
- [ ] 67. Customer Retention: VIP / At-Risk / Churned segmentation by recency & frequency
- [ ] 68. Real Shopify OAuth + webhooks (replace mock adapter)
- [ ] 69. Deployment (Render/Fly + Vercel/Netlify) and production env hardening

## Phase 9 — Dead-Stock Intelligence (Inventory Optimization)

Three features: Dead-Stock Planner (products with stock but zero line-item sales over 30/60/90 days), Holding Cost Calculator (monthly cost of stagnant stock via a configurable storage cost multiplier), Smart Markdowns (15% / 30% / 50% suggestions by how long a product has been inactive). Not started; implement one group at a time.

### Foundation

- [x] 70. docs/dead-stock.md: write up the decisions below and link it from docs/metrics.md. (Done; the doc refines (b) to reuse the revenue metrics' counted order statuses, and (c) to calendar days in the store time zone, like the dashboard ranges.) **Decided:** (a) unit of analysis is the variant (that is where `inventoryQuantity` lives); the UI can group rows by product. (b) Dead stock = `inventoryQuantity > 0` on an ACTIVE product and zero net units sold in the window, where a line's net units = `quantity − refundedQuantity`, so a fully refunded line is not a sale; order-level cancelled/voided orders are excluded. (c) Windows are rolling 30/60/90 days ending now, in the store timezone; a variant is dead for window W if its last sale is older than W days. (d) Days inactive = days since last net sale; if it never sold, days since the product's Shopify created date (so a brand-new product is not flagged). (e) Holding cost per variant per month = `inventoryQuantity × unitCost × holdingCostRate`. (f) Markdown tiers by days inactive: under 30d → none, 30–59d → 15%, 60–89d → 30%, 90d+ → 50%; a tier applies only if the variant is dead for that window. (g) Variants with null unit cost still get flagged and markdown suggestions, but are excluded from holding-cost totals and marked "cost missing"
- [x] 71. Store settings: add `holdingCostRate` to the Store model as a fraction of stock value per month (**default 0.02 = 2%/month**, validated 0–1, stored as a number not a percent string; the UI shows it as a percent) + Zod validation + a named default constant (no `.env` var). Documented in task 70
- [x] 72. Mock data + seed: make the generator deterministically produce dead-stock scenarios (variants with stock but no sales for 30/60/90+ days, a never-sold variant, a variant with null unitCost) with varied `inventoryQuantity`; confirm the sync mapper carries `inventoryQuantity` through; update seed script

### Dead-Stock Planner (backend)

- [x] 73. Aggregation: last-sold date + units sold per variant (`$match` store/date → `$unwind` lines → `$group` by variantId), merged with products' variants that have stock; index review with explain() notes
- [x] 74. Service + `GET /api/stores/:id/inventory/dead-stock?window=30|60|90` (auth + ownership, Zod query schema, sorting, pagination) returning rows with stock qty, last sold date, days inactive and stock value
- [x] 75. Backend tests: seeded fixture with hand-computed expected dead-stock rows for each window, including boundary days and never-sold items

### Holding Cost Calculator (backend)

- [x] 76. Pure holding-cost function: monthly cost = qty × unitCost × holdingCostRate; handle `unitCostCents == null` (excluded from totals, flagged as "cost missing"); integer-cents math, no float drift
- [x] 77. `PATCH /api/stores/:id/settings` to update `holdingCostRate` (auth + ownership + validation); include per-row and total monthly holding cost + capital tied up in the dead-stock response
- [x] 78. Unit tests for the holding-cost function (rounding, null cost, zero stock, rate edge cases) + endpoint test for the settings update

### Smart Markdowns (backend)

- [x] 79. Pure markdown-tier function: days inactive → none (<30) / 15% (30–59) / 30% (60–89) / 50% (90+); thresholds as named constants matching docs/dead-stock.md
- [x] 80. Include `suggestedDiscountPct`, `suggestedPriceCents` and margin after markdown in each row; warn when the suggested price falls below unit cost (never recommend selling at a loss silently)
- [x] 81. Unit tests for tier boundaries and below-cost warning

### Frontend

- [x] 82. Typed API hooks (TanStack Query): useDeadStock, useUpdateHoldingCostRate (invalidates the inventory queries on update; inventory is invalidated after a sync too). The settings come with the stores list (`store.settings`), so there is no separate useStoreSettings hook
- [x] 83. Dead-Stock page + route + sidebar nav entry; 30/60/90 window filter synced to URL search params (reuse the date-range filter pattern); sortable, paginated table
- [x] 84. Summary cards: dead SKUs, units stuck, capital tied up, monthly holding cost
- [x] 85. Holding cost rate control (inline editable, validated, a11y labels) wired to the settings endpoint
- [x] 86. Smart Markdown column: discount badge (15/30/50%), suggested price, below-cost warning styling that does not rely on color alone
- [x] 87. Skeleton, empty ("No dead stock, nice"), error and first-run states; responsive table; dark-mode tokens; accessibility pass
- [x] 88. Frontend tests: window filter URL sync, markdown badge rendering, holding cost rate form, formatters

### Docs

- [ ] 89. Update README feature list + screenshots, OpenAPI entries for the new endpoints
- [ ] 90. ADR in docs/adr: dead-stock definition and the choice to compute it on read (aggregation) rather than storing flags
