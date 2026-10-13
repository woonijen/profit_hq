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
