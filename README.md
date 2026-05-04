# Bow Wow’s Dog Spa Platform

Monorepo for the Bow Wow’s Dog Spa build, covering:

- `frontend/public-app`: Public single-page site with booking + contact forms.
- `frontend/admin-app`: Admin SPA with RBAC-protected modules for content, bookings, schedule, media, etc.
- `backend`: PHP API with SendGrid integration, MySQL persistence, media processing, audit logging, a provider-agnostic calendar sync foundation for future Google, Microsoft, or Apple booking sync, and catalog groundwork for future online product sales.
- `scripts`: Helper build scripts that emit deploy-ready ZIPs for GoDaddy.
- `docs`: Deployment + operator runbooks.

## Quick start

```bash
# Install frontend deps once
cd frontend/public-app && npm install
cd ../admin-app && npm install
cd ../..

# Start the shared local stack
bash scripts/dev-start.sh
```

> First-time setup: copy `backend/.env.example` to `backend/.env`, fill in local DB + email values, and keep it out of version control. `backend/.env` is the local/dev file in this repo; production secrets should live in the real host environment model and are never bundled into deploy ZIPs.

See `docs/DEPLOYMENT_GUIDE.md` for cPanel deployment steps and `docs/OPERATOR_NOTES.md` for day-to-day workflows.

## Configuration overview (`backend/.env`)

`backend/.env.example` is grouped into labeled sections so operators can skim the knobs quickly:

- **Application** – `APP_URL`, `APP_ENV`, `APP_DEBUG`.
- **Database** – GoDaddy credentials (`DB_HOST=localhost`, plus DB/user/pass).
  - `DB_TEST_NAME` for the backend test harness.
  - `BOWWOW_TEST_REUSE_CONFIGURED_DB` only when you intentionally want tests to back up and temporarily reuse the configured DB.
- **SendGrid Email**
  - `SENDGRID_ENABLED`
  - `SENDGRID_STAFF_NOTIFICATIONS`
  - `SENDGRID_SEND_CUSTOMER_RECEIPTS`
  - `SENDGRID_SEND_CUSTOMER_CONFIRMATIONS`
  - `SENDGRID_API_KEY`, `SENDGRID_FROM_*`
- **Sessions** – cookie name, lifetime, `SESSION_SECURE` (set `true` when HTTPS enforced).
- **Media & Upload Processing** – `UPLOAD_DIR`, size/quality knobs, width profiles.
- **Calendar Sync Foundation** – `CALENDAR_SYNC_ENABLED`, `CALENDAR_SYNC_DEFAULT_TIMEZONE`, `CALENDAR_SYNC_MAX_JOB_ATTEMPTS`.
- **Admin seeding (optional)** – use the CLI script `php backend/scripts/seed_admin.php` after configuring `backend/.env` in local/CLI workflows or in a deploy built with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true`.

Missing `.env` results in a clear bootstrap error so the backend never runs with partial config.

## Public site & placeholder archive

- `/` serves the full public SPA.
- `/status/access-denied`, `/status/not-found`, `/status/server-error`, and `/status/maintenance` provide branded full-page status routes for intentional redirects and support flows.
- `/placeholder/` preserves the former placeholder page as a separate archived surface and is not linked from the live site.
- `/admin/login` is the real admin surface.
- `/api/*` is the PHP backend entrypoint.
- Old `/preview` and `/current` URLs redirect to `/` so stale bookmarks keep working.
- Unknown public URLs now return a real `404` while still landing in the public app shell.
- If a `maintenance.flag` file exists in the deployed document root, public routes return a real `503` and Apache serves the branded maintenance document while `/admin/*`, `/api/admin/*`, and `/api/health` stay reachable.

## Dev & deploy scripts

Generic helper scripts live under `scripts/` (see `Generic-Scripts-Reference.md` for philosophy). Highlights:

| Command | Description |
| --- | --- |
| `bash scripts/dev-start.sh` | Launch backend PHP server plus the public + admin Vite dev servers. |
| `bash scripts/dev-stop.sh` | Stop all dev servers (logs/pids in `.dev/`). |
| `bash scripts/dev-status.sh` | Show PID + port status for backend/public/admin services. |
| `bash scripts/dev-verify.sh` | Full smoke test: stop → start → check (backend/public/admin) → restart → re-check. |
| `bash scripts/verify-public-error-pages.sh` | Verify public status-route codes, static error documents, and maintenance behavior against a staged frontend bundle. |
| `bash scripts/make-placeholder-deploy-zip.sh` | Build `deploy-placeholder.zip` for the temporary root placeholder only, without exposing the unfinished public SPA. |
| `bash scripts/make-deploy-zips.sh` | Builds React apps, refreshes placeholder assets, and produces `deploy-frontend.zip` + `deploy-backend.zip`. |
| `bash scripts/check-deploy-zips.sh` | Quick sanity-check of the generated deploy archives. |

- Copy `scripts/dev-config.example.sh` to `.dev/dev-config.sh` to override default ports/paths (backend/public/admin).
- Logs and pid files live under `.dev/`.
- In dev, browse everything from `http://127.0.0.1:5173/`: the public SPA lives at `/` and the admin SPA is available at `/admin/login`. The admin Vite server still runs separately on `5174` by default, but only as an internal upstream for the shared `5173` origin (adjust ports via `.dev/dev-config.sh`).
- Deploy zips exclude secrets and runtime state by default, including `backend/.env`, `backend/.env.production`, `backend/uploads/`, generated media, and CLI-only backend scripts.
- If you intentionally need the backend CLI tools on-host, rebuild with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true bash scripts/make-deploy-zips.sh`.
- The frontend deploy zip includes the live root SPA, the admin SPA under `/admin`, and the archived placeholder files under `/placeholder`.
- While the full site is waiting on approval, run `bash scripts/make-placeholder-deploy-zip.sh` and deploy `deploy-placeholder.zip` to the domain document root. It ships the branded noindex placeholder, favicon/error assets, legal pages, and root Apache rules only.

## Testing

Frontend:

```bash
cd frontend/public-app && npm test
cd ../admin-app && npm test
```

Backend:

```bash
php backend/tests/run.php
```

Browser smoke suite:

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Full local verification:

```bash
bash scripts/test-all.sh
# or
npm run test:all
```

- Preferred setup: point `DB_TEST_NAME` at a dedicated scratch MySQL database the app user can reset freely.
- Fallback for locked-down local environments: run `BOWWOW_TEST_REUSE_CONFIGURED_DB=1 php backend/tests/run.php` only if you explicitly want the runner to back up the configured DB, reset it during the suite, and restore it afterward.
- For this repo’s current local workflow, it is also acceptable to reuse `bowwow_dev` as long as you treat it as disposable during the run and do not interrupt the suite midway through backup/restore.
- The backend suite covers current content, retail/media, schedule/booking, and calendar-sync foundation behavior.
- The retail model now stores optional future-sales prep metadata (SKU, stock status, fulfillment mode, and sales intent) plus a dormant variants table, but the live site remains catalog-only until checkout work is explicitly implemented.
- The browser smoke suite seeds a deterministic admin user plus a future booking date via `php backend/scripts/seed_e2e_fixtures.php` before launching Playwright.
- `scripts/test-all.sh` is the safest single local command right now: it backs up the configured dev DB, runs backend tests, frontend tests/builds, the Playwright smoke suite, then restores the DB on exit.
- GitHub Actions now runs PHP lint, backend tests, frontend tests/builds, and the Playwright smoke suite on every push to `main`, pull request, or manual dispatch.

## Real-host smoke test

Verify these on the real Apache/GoDaddy host after each deploy:

- Routing: `/` loads the live site, `/preview` redirects to `/`, `/current` redirects to `/`, `/admin/login` works, `/privacy` plus `/terms` render correctly, unknown public URLs return a branded `404`, and `/status/maintenance` returns a branded `503`.
- Maintenance mode: creating `maintenance.flag` in the document root serves the branded `503` document for public routes while `/admin/login`, `/api/admin/*`, and `/api/health` remain reachable; removing the file restores normal public traffic.
- Backend: `/api/public/site` returns expected JSON, schedule lookup works, booking hold works, and booking request submission works.
- Calendar sync groundwork: `/admin/calendar-sync` loads, provider slots save/delete, and confirmed booking transitions do not error when the sync queue tables are present.
- Uploads: the configured upload directory is writable, booking attachment upload works, and admin attachment download works.
- Email: contact submissions send staff mail, booking requests send staff mail, and booking confirmation/decline flows send the expected customer mail.

Use `/admin/system` after logging in for non-public environment checks such as DB, uploads, and SendGrid configuration.

Brand assets live under `frontend/public-app/src/assets/logos/` (with PNG + WebP variants) and are reused by the archived placeholder as well as the React SPAs.
