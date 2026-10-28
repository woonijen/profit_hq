# ProfitHQ — Your Tasks

Legend: `[ ]` todo · `[x]` done. These are tasks only you can do. Claude's tasks live in [todo.md](todo.md).

- [x] 1. MongoDB Atlas: create a DB user, allow your IP (and later hosting IPs) in Network Access, copy the connection string
- [x] 2. Create a SEPARATE test database/user (e.g. `profithq_test`) for automated tests
- [x] 3. Create `backend/.env` from `.env.example`: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (generate each with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`), `CLIENT_ORIGIN`
- [x] 4. Create `frontend/.env` from `.env.example` (API base URL)
- [x] 5. Run `npm install` at the root after the scaffold is created (Claude ran it for Phase 0; re-run whenever dependencies change)
- [ ] 6. Review and commit each completed phase manually (suggested: one commit per phase, conventional commits)
- [ ] 7. Manually test each completed phase (Claude will provide a checklist per phase)
- [ ] 8. Choose a LICENSE for the repo (MIT suggested for a portfolio project)
- [ ] 9. Create the GitHub repo and push; add CI secrets if needed (e.g. `MONGODB_URI_TEST`)
- [ ] 10. Take screenshots/GIF of the dashboard for the README once Phase 6 is done
- [ ] 11. (Later) Create hosting accounts for deployment (backend + frontend) and add production env vars
- [x] 12. Manually test Phase 1 auth (after `npm install`, `npm run dev`):
  - Register at `/register` (password ≥ 10 chars) → you land on the dashboard and see your email + Log out in the header
  - Reload the page → you stay logged in (silent refresh); in DevTools → Application → Cookies, `refresh_token` is httpOnly with path `/api/auth`
  - Log out → back to `/login`; visiting `/` redirects to `/login`
  - Wrong password and unknown email both show "Invalid email or password"
  - Registering the same email twice shows "An account with this email already exists"
  - Reuse detection: log in, copy the `refresh_token` cookie value, reload once (rotates it), then paste the old value back and reload → you are logged out, and the newest cookie no longer works either
  - `GET /api/auth/me` without a token returns 401 with the standard error envelope
  - More than 10 failed logins in 15 minutes returns 429 `TOO_MANY_REQUESTS`
- [x] 13. Manually test Phase 2 (after `npm run dev`):
  - Register a new user → in Atlas, the `stores` collection has one document for them (`shopDomain` like `demo-xxxxxxxx.myshopify.com`, currency `USD`, timezone `UTC`)
  - Existing users registered before Phase 2 have no store yet; that is expected (the sync in Phase 3 will create it)
  - Registering with a duplicate email still returns 409 and creates no store
- [x] 14. Test Phase 3 (after `npm install`):
  - Put the dedicated test database URI in `backend/.env` as `MONGODB_URI_TEST` (see `.env.example`; it must not be your dev database), then run `npm test -w backend`. All 6 database tests in `sync.service.test.ts` should pass (this is what todo #34 waits on; tell Claude if any fail)
  - `npm run dev`, log in, then call the API with your access token (DevTools → Network, or curl): `GET /api/stores` returns your store (it is created now if you registered before Phase 2)
  - `POST /api/stores/<id>/sync` returns `202` with a `running` run; `GET /api/stores/<id>/sync/latest` shortly after shows `succeeded` with products ~24 and orders ~1000 inserted
  - Run the POST twice more: counts show `inserted: 0, updated: 0` and `unchanged` equal to the totals. In Atlas, `orders` has the same document count and `updatedAt` values do not change
  - Fire two POSTs at once (or right after each other): the second returns `409 CONFLICT`
  - Another user's store id returns `404`; no token returns `401`
- [x] 15. Test Phase 4 (after `npm install`):
  - (Done by Claude: 58/58 pass.) Run `npm test -w backend`: all database tests should pass, including the new `metrics.service.test.ts` (4 tests: the hand-computed fixture, store time zone cut-offs, an empty store, and the index check). Tell Claude if any fail; todo #40 and #41 wait on this
  - (Done by Claude: that account had never synced, so it got a first sync, nothing to rewrite.) **Re-sync your dev store once** (`POST /api/stores/<id>/sync`). Order lines now carry `refundedQuantity`, so every previously synced order is rewritten once (`updated` = all orders, COGS snapshots are kept). Until then, COGS of refunded orders is overstated
  - (Done by Claude on the test database; only the dev-store re-sync above is left for you.) `GET /api/stores/<id>/metrics/summary?range=30d` (also `7d`, `90d`; no `range` means 30d) returns `range`, `metrics` (each with `current`, `previous`, `changeRatio`), and `costCoverage`. Sanity check: `netRevenueCents = grossRevenueCents − discountsCents − refundsCents`, and `netProfitCents = netRevenueCents − cogsCents`
  - `range=1y` returns `400 VALIDATION_ERROR`; another user's store returns `404`; no token returns `401`
- [x] 16. Test Phase 5 (backend, after `npm install`): (Done by you: 77/77 pass, including the 8 new `getTrend (database)` tests. Endpoint checks done by Claude on the test database, then cleaned up.) `GET /api/stores/<id>/metrics/trend?range=30d&granularity=day` returns 30 points (days without orders are zeros with `netMargin: null`); `granularity=month` returns 1–2 points flagged `partial`; `granularity=week` returns `400 VALIDATION_ERROR`
- [x] 17. Test Phase 6 (after `npm install`, since Recharts was added; `npm run dev`):
  - Brand-new account: the dashboard shows "Run your first sync". Click it: button shows "Syncing…" and is disabled, cards and chart show pulsing skeletons, the header says "Syncing your store data…", then "Sync complete · N orders changed" for ~5 seconds, then "Last synced <time>"; cards and chart fill in without a page reload
  - Reload while a sync is running: it still shows as syncing, and finishes on its own
  - Date range (7/30/90 days) and Daily/Monthly toggle change the numbers and chart, and the URL (`?range=7d&granularity=month`); reloading or pasting the URL keeps the view; an invalid value falls back to 30d/daily
  - Cards: Gross revenue, COGS, Net profit (with net margin underneath), AOV, each with a % change vs the previous period. COGS going up shows red, the others going up show green. On 90d the previous period is nearly empty, so changes look large or are missing (expected)
  - Chart: bars = net revenue (left axis), line = net margin (right axis); hover shows a tooltip; "Show data as a table" lists the same numbers
  - Stop the backend and reload: the dashboard shows an error with "Try again"; start it again and click it
  - Keyboard only: Tab reaches the range buttons, the sync button and the chart toggle with a visible focus ring. Set the OS to dark mode: the whole app (including login) switches theme
- [x] 18. Test Phase 7 (after `npm install`, new dependencies were added):
  - (Done by Claude: backend 137/137 including all database tests, frontend 49/49.) `npm test` with `MONGODB_URI_TEST` set
  - (Done by Claude on the test database, then cleaned up; your dev database was not touched.) `npm run seed` creates `demo@profithq.dev` and syncs 24 products and about 1,100 orders; the second run leaves everything unchanged. Still open for you: run `npm run seed` once against your dev database if you want the demo account there, and log in with `demo@profithq.dev` / `demo-password-123`
  - (Done by Claude over HTTP with browser-style `Origin` headers.) Login, silent refresh, a refresh from a foreign origin (403, and the real session keeps working), summary, trend, sync (a second start while running gives 409), logout, refresh after logout (401), and the docs routes
  - Still open, needs a browser: open http://localhost:4000/api/docs. Swagger UI should render with no console errors; "Try it out" works on `GET /api/health`; use the Authorize button with an access token (from the login response in DevTools) and call `GET /api/stores/{storeId}/metrics/trend`. Then click through the app once (log in, reload, log out, sync a few times) to confirm the UI still behaves after the security changes
- [x] 19. Docker (skipped by choice: Docker is not installed and will not be tested locally. The Dockerfiles and compose file are unverified; the CI `docker` job is where they would first be built)
- [ ] 20. In GitHub, once the repo exists (#9): add the repository secret `MONGODB_URI_TEST` (Settings, Secrets and variables, Actions) and check that the first CI run is green; without the secret CI still passes but skips the database tests
- [ ] 21. Add screenshots for the README (see #10): save them as `docs/screenshots/dashboard.png` (and a dark-mode one), then uncomment the image line in the README's screenshot comment

- [x] 22. Test Dead-Stock Planner (Phase 9, tasks 70–75, 83):
  - Run `npm test` with `MONGODB_URI_TEST` set. The new database tests (`inventory.service.test.ts`) have not been run, because Claude does not run database tests
  - Sync again (the Sync button, or `npm run seed`): products now carry a created date, so the first sync after this change rewrites every product. The mock data also changed, so the demo store has stalled products
  - Open "Dead stock" in the sidebar: the list should shrink as the window grows (30 ⊇ 60 ⊇ 90), the two never-sold products stay in all three (one shows "Cost missing"), and the exact counts depend on the random catalog. The product created 10 days ago and the one that sold 20 days ago never appear
  - The 30/60/90 buttons change the table and the URL (`?window=60`); sorting by the column headers flips ascending/descending; with fewer than 26 rows there is no pagination (expected)
  - After a sync finishes, the table refreshes by itself
- [x] 23. Test Holding Cost (Phase 9, tasks 71, 76–78, 82, 84, 85):
  - (Done by you: 15 files, 192/192 pass, after allowing your IP in Atlas.) Run `npm test` with `MONGODB_URI_TEST` set. New database tests: the settings endpoint in `store-access.test.ts` and the holding-cost cases in `inventory.service.test.ts`; Claude has not run them
  - Open "Dead stock": four cards (Dead SKUs, Units stuck, Capital tied up, Holding cost per month) and a "Holding cost / month" column. With the default 2%, a row's cost is 2% of its stock value; the never-sold product without a cost shows "Cost missing" and is not in the totals
  - Change the rate field (try `3.5`, `3,5` and `3.5%`): Save enables only when the value differs, "Saved" appears, and the cards and column update without a reload. Reload: the new rate is still there
  - Invalid input (`abc`, `101`, `2.555`, empty) shows an error under the field and does not call the server. Keyboard only: the field and Save button are reachable and show a focus ring
- [x] 24. Test Smart Markdowns (Phase 9, tasks 79–81, 86):
  - (Done by you.) Run `npm test` with `MONGODB_URI_TEST` set: the new database assertions are in `inventory.service.test.ts`; Claude has not run them
  - Open "Dead stock": each row has a "Suggested markdown" cell with a badge and the new price, and the current price struck through under it. A row idle 30–59 days shows −15%, 60–89 days −30%, 90+ days −50% (compare with the "Days inactive" column); the never-sold products are 90+ and show −50%
  - A row whose new price is under its cost also shows "⚠ Below cost: loses $X per unit" in a bordered label (readable without color). With the demo data some 50% rows should hit it; the row with "Cost missing" never shows the warning
  - Switch the window to 60 and 90: a variant keeps the same discount in every window it appears in

- [x] 25. Check the Dead stock page states (Phase 9, task 87):
  - (Checked by Claude with Playwright against mocked data: the title and window filter show while the skeletons load, and the title stays at the same position when the data arrives.) Reload the page: the "Dead stock" title and window filter stay put while the skeletons show (no jump when the data arrives)
  - (Checked by Claude with Playwright: Tab reaches the table, ArrowRight scrolls it, and the Product column stays pinned.) Narrow the browser to phone width: the table scrolls sideways with the Product column pinned on the left; Tab reaches the table and the arrow keys scroll it
  - (Dark mode checked by Claude with Playwright against mocked API data, in the scratchpad: table, badges, below-cost label and pinned Product column are readable. Nothing for you to do.)

- [x] 26. Decide the CRM Segmenter rules (Phase 10, task 91). (Decided by Claude at your request, written into `todo.md` task 91; tell Claude if you want any changed: guest checkouts left out; segments by first match, Churned = no order for over 60 days, At-Risk = 31–60 days, VIP = 3+ orders and an order within 30 days, everyone else "Active" as a neutral fourth group; thresholds are fixed constants tuned to the 90-day mock history; the customer's name is captured on orders, so the first sync after that rewrites every order. Nothing for you to do.)

- [x] 27. Test the customer name capture (Phase 10, task 92):
  - (Done by Claude at your request, with `MONGODB_URI_TEST`: backend 220/220 with no test skipped, frontend 110/110. A new database test in `sync.service.test.ts` checks that synced orders store the customer id, email and name, and that guest checkouts store nulls; the existing idempotency test still shows a second sync changes nothing.) Run `npm test` with `MONGODB_URI_TEST` set
  - (Done by you, with the Atlas check: an order has `customerName`, and a guest order has it as `null`.) Sync once (the Sync button, or `npm run seed`). This rewrites every order once, because the content hash now includes the name. A second sync should leave everything unchanged. In Atlas, an order of your dev store should now have `customerName` (for example "Ada Lovelace"), and a guest-checkout order should have it as `null`

- [x] 28. Test the CRM Segmenter backend (Phase 10, tasks 93–97):
  - (Done by Claude at your request, with `MONGODB_URI_TEST`: backend 282/282 with no test skipped before the last generator change below; run `npm test` once more before you commit.) Run `npm test` with `MONGODB_URI_TEST` set
  - (Done by you: `npm run seed`.) Sync again
  - (Done by Claude against your dev store with the backend started by Claude, which was stopped afterwards: login, the endpoint, filter `segment=VIP` with `sort=orders&direction=asc&pageSize=5&page=2`, `sort=lastOrder&direction=desc` listing the longest-silent first, all 150 customers checked against the segment rules with 0 violations, spend sorted high to low, `guestOrders` 154, 400 in the usual error shape for `segment=vip`, `pageSize=500`, `page=0` and `sort=name`, 401 without a token, 404 for an unknown store, and an empty page past the end.)
  - Found and fixed by Claude: the mock data had only 150 customers for about 1,000 orders, so 115 of 150 were VIP (77%). The default is now 600 customers (about 440 buy): roughly a fifth VIP, the rest split between Active, At-Risk and Churned. Sync again to load it (it rewrites the orders once more); the Customers page then has about 440 rows, so about 18 pages
- [x] 29. Test the Customers page (Phase 10, tasks 98–99, first version):
  - Open "Customers" in the sidebar. The table lists customers by lifetime spend, highest first, with the customer (name over the email), segment, spend, orders and last order (date plus "N days ago"). With more than 25 customers there is Previous / Next
  - The All / VIP / At-Risk / Churned / Active buttons filter the table and change the URL (`?segment=AT_RISK`); reload keeps the view; open the URL with `?segment=vip` or `?sort=foo`: it falls back to all customers, by spend. Check that each segment's rows make sense: a VIP has 3+ orders and an order within 30 days; an At-Risk last order is 31–60 days ago; a Churned one is over 60 days ago
  - Sort by clicking the Lifetime spend, Orders and Last order headers: a new column starts descending, a second click flips it. "Last order" descending lists the longest-silent customers first. Sorting or filtering goes back to page 1
  - Under the table, "N orders from guest checkouts are not included" shows (the mock data has guest checkouts). After a sync finishes the table refreshes by itself
  - Reload: the title and filter stay while the skeleton shows. Phone width: the table scrolls sideways with the Customer column pinned; Tab reaches the table and the arrow keys scroll it. Dark mode: readable
  - Known and expected for now: the segment is plain text (the colored badge is task 100) and the filter buttons will be replaced by clickable summary cards (task 101)

- [x] 30. Check that the page no longer scrolls (App shell, task 106). (Dashboard and Customers checked by you at desktop size. Dead stock was put back to its old layout on your request: its content flows normally, the table scrolls sideways only.)
  - (Checked by Claude with Playwright against mocked API data, nothing written anywhere, screenshots in the scratchpad.) Customers at 1280x800, 1280x500 and 1280x300: the window never scrolls; the table box shrinks (530, 230 and 218px high) and scrolls inside; only at 300px high is there no room left, and then the content area scrolls, not the window. In dark mode, scrolled down and sideways: the header row and the Customer column stay pinned, with the dark card background and no extra line under the header. Tab reaches the table; Page Down and the arrow keys scroll it
  - (Checked by Claude at phone width, 390x844.) Dashboard, Dead stock and Customers: the window does not scroll in either direction, the content area scrolls to the very bottom (the pagination and the chart's "Show data as a table" link are reachable), and on Dead stock the table scrolls sideways with the Product column pinned and Tab plus the arrow keys work
  - Found and fixed by Claude while checking: the window could still scroll (75px on the dashboard, 1,800px down and 290px sideways on Dead stock), because the screen-reader-only text (`sr-only`, absolutely positioned) sat outside the shell's clipping. The shell is now `relative`, so it clips them. Not visible, but it showed up as blank space when scrolling the window
  - Nothing left for you here, but restart `npm run dev` (Ctrl+C and run it again): Claude briefly started a second Vite to look at the pages, which refreshed the shared dependency cache, so your running dev server may fail to load the dashboard chart ("Failed to fetch dynamically imported module") until it is restarted

- [x] 31. Test the segment badge (Phase 10, task 100):
  - Open "Customers". Every row's Segment is now a pill with an icon and the name: VIP (star, purple), At-Risk (warning triangle, amber), Churned (person with a minus, red), Active (pulse line, green)
  - Filter by each segment and check the pill matches the filter. The pills are not a color-only signal: the icon and the word are there too
  - (Checked by Claude with Playwright against mocked API data, nothing written anywhere, at your request.) Dark mode (OS setting): each pill has a dark tint with light text and stays readable (contrast 8.5:1 to 10.4:1); light mode: dark text on a pale tint (6.4:1 to 7.4:1)
  - (Checked by Claude, 390x844 in light and dark.) Phone width: the pill does not wrap onto two lines (22px high), the window does not scroll, and the table scrolls sideways with the Customer column pinned
  - (Checked by Claude with the accessibility tree.) Screen reader or text-only check: the cell reads as just the segment name (the icon is hidden)

- [x] 32. Test the segment summary cards (Phase 10, task 101):
  - Open "Customers". Four cards sit under the title, one per segment: the badge, the number of customers, the share of revenue and the average spend. The All / VIP / At-Risk / Churned / Active buttons are gone
  - Click a card: it gets a green outline, the table shows only that segment, and the URL gets `?segment=…`. The numbers on the cards do not change (they always cover every customer). Click the same card again: the filter clears and the outline goes away. Clicking another card switches the filter and goes back to page 1
  - The four shares of revenue add up to about 100% (a segment with no revenue shows "No revenue", an empty one "No spend yet")
  - Keyboard: Tab reaches each card, Enter or Space toggles it. With a screen reader each card is a toggle button that reads the segment, the count, the share and the average spend
  - Reload with `?segment=AT_RISK` in the URL: the At-Risk card is already selected. Dark mode and phone width (2 cards per row): readable, nothing cut off, and the page still does not scroll as a whole
  - After a sync finishes the cards refresh by themselves. While loading, four skeleton cards show in place of the cards

- [x] 33. Test the Customers states (Phase 10, task 102):
  - (Checked by Claude with Playwright against a mocked API, a 500 answer that then turned into a 200, nothing written anywhere: the red "Could not load customers" box with the server's message and "Try again" shows, the title stays, no cards or table, and "Try again" loads them.) Error: stop the backend (Ctrl+C on `npm run dev`'s backend, or turn the network off in the browser's dev tools), reload "Customers": a red "Could not load customers" box with "Try again" shows, the title stays, and no cards or table show. Start the backend again and press "Try again": the cards and table load
  - (Checked by Claude with a mocked "never synced" answer: "Run your first sync" with the Sync button, no cards or table, and the customers endpoint is not called.) First run: with a brand-new account (register another user) "Customers" shows "Run your first sync" with the Sync button, like the dashboard
  - (Checked by Claude with a response delayed by 2.5 seconds: four skeleton cards and a skeleton table, a busy region for screen readers, no real cards yet, and the title stays at the same position when the data arrives.) Loading: reload with the network throttled to "Slow 4G" in dev tools: four skeleton cards and a skeleton table show, then the real ones replace them with no jump of the title
  - (Checked by Claude with mocked answers, in light and dark mode, since the mock data cannot produce them: "No customers yet" with "154 orders were placed as a guest checkout…" and no cards, and "No At-Risk customers right now" with the At-Risk card pressed, the other cards visible and the hint to select it again; pressing it again shows everyone and removes `?segment=` from the URL.)
  - (Checked by Claude through the page: the hidden live region reads "15 customers", then "5 VIP customers" after pressing the VIP card. Claude cannot run VoiceOver, and you chose to skip that check as not critical, so how it sounds is untested.) Screen reader (VoiceOver, Cmd+F5): after pressing a segment card, "N VIP customers" is announced; the table is read with its column headers and the customer name as the row header
