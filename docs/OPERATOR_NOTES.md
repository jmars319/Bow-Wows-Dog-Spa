# Operator Notes – Bow Wow’s Dog Spa

## Local dev quick start
- Run `bash scripts/dev-start.sh` to boot the backend plus the public (`5173`) and admin (`5174`) Vite servers.
- Shared browser origin: http://127.0.0.1:5173/
- Public SPA: http://127.0.0.1:5173/ (proxying `/api` to `php -S 127.0.0.1:8088`).
- Admin SPA: http://127.0.0.1:5173/admin/login
- The admin Vite server still runs on `5174` by default, but it is treated as an internal upstream for `/admin` on the shared `5173` origin (adjust ports/paths via `.dev/dev-config.sh`).
- `bash scripts/dev-status.sh` reports PID/port health; `bash scripts/dev-stop.sh` tears everything down when you’re done.

## Booking workflow
1. Public guests open the Booking section, reserve a time button (hold lasts 10 minutes), and submit the intake form.
2. Backend creates a `booking_requests` record with `pending_confirmation`, logs the action, notifies staff, and emails the guest a receipt.
3. Admins review entries under **Booking Requests**:
   - `Confirm` locks the slot, releases the hold, and emails the guest confirmation.
   - `Decline` or `Cancel` frees the slot and captures optional notes.
4. Dashboard surfaces counts for new/pending/confirmed bookings, plus the latest audit items.

## Schedule setup
- **Weekday Templates**: define default time buttons for each weekday using the admin time-button picker. The quick-add field also normalizes loose input such as `1100`, `930`, or `2pm`.
- **Date Overrides**: specify closed days or custom schedules for holidays and special events. Overrides supersede weekday templates and can fully disable a date when needed.
- A slot is considered unavailable when:
  - A pending request holds the time within its hold window.
  - An admin confirmed booking already uses the time.
  - A manual hold exists (via public selection) and has not expired.

## Calendar sync groundwork
- The **Calendar Sync** admin screen stores future calendar targets for Google, Microsoft, and Apple without connecting any provider yet.
- Multiple targets can be saved at once so the business can decide later which calendars should receive confirmed bookings.
- Saving a slot here does **not** create calendar events on its own. Actual provider auth and event-writing work still has to be implemented later.
- The backend now records future sync jobs and event links in dedicated tables so confirmed-booking sync can be added without reshaping the booking lifecycle again.

## Content management
- **Text & Site Info**: update hero copy, about text, policy blocks, serving-area tagline, and default email language.
- **Gallery**: manage published groomed-pet, facility, retail, and before/after items that appear in the public photo-driven sections.
- **Retail**: maintain boutique products with optional prices and featured flags. The product form now also has an optional **Future online sales prep** section for SKU, stock status, fulfillment direction, and whether a product should stay catalog-only or eventually be eligible for online checkout.
- **Media Manager**: upload photos (XHR progress UI) and provide category/alt/title/caption. Originals land in `backend/uploads/originals` and responsive variants + WebP + manifests are generated automatically per the Generic Image Pipeline spec.

## Future online sales groundwork
- The live public site is still catalog-only. There is no cart, checkout, payment provider, shipping flow, tax handling, or order management yet.
- Backend scaffolding now exists so checkout can be added later without reshaping every product:
  - item-level SKU / stock / fulfillment / sales-intent fields
  - dormant `retail_item_variants` table for future sizes or product options
  - dormant commerce mode settings in `site_settings`
- Until checkout is explicitly implemented, treat those new product fields as internal prep only.

## RBAC summary
- `super_admin`: full access, plus Admin Users screen.
- `manager`: dashboard, booking, schedule, content, services, reviews, gallery, contact inbox, media, retail, audit, system.
- `scheduler`: schedule + booking views.
- `content_editor`: content, services, reviews, gallery, contact inbox, retail, media.

## Audit & compliance
- Every admin mutation (content save, booking changes, etc.) is recorded in `audit_log`.
- Use the **Audit Log** screen to review who did what and from which IP/agent.
- Privacy + Terms content is editable from the Text & Site Info screen and exposed publicly at `/privacy` and `/terms`.

## Media pipeline & storage
- The uploads tree (`backend/uploads/`) contains `originals/`, `variants/optimized/`, `variants/webp/`, and `manifests/`. Keep these folders writable (`775` on GoDaddy).
- Deleting a media entry removes the original, every derivative, and the manifest atomically.
- Public/admin image rendering uses `<picture>` with both WebP and raster `srcset` values. Avoid linking directly to `/uploads/*.jpg` except for fallbacks.

## System diagnostics
- Visit `/admin/system` (requires permissions) to view environment checks: PHP extensions, WebP support, SendGrid config, DB connectivity, and uploads directory permissions.
- Each failing row includes a remediation hint (e.g., "Set uploads/variants/webp writable (775)").
- Use this screen after deployments or host-level changes to verify the environment still satisfies the Generic Image Pipeline specification.

## Public site routing
- `/` is now the live public SPA.
- `/status/access-denied`, `/status/not-found`, `/status/server-error`, and `/status/maintenance` are the branded full-page public status routes.
- Unknown public URLs now return a real `404`.
- `/placeholder/` preserves the former placeholder page in its own folder so it can still be referenced without affecting the main site.
- `/preview` and `/current` are legacy paths that redirect to `/` for compatibility.
- `/admin/login` is the real admin surface.
- `/api/*` is the backend entrypoint.

## Maintenance mode
- Create an empty `maintenance.flag` file in the deployed document root to put the public site into maintenance mode.
- Public routes return a real `503` and Apache serves the branded `/error-documents/503.html` document.
- `/admin/*`, `/api/admin/*`, and `/api/health` stay reachable during maintenance.
- Remove `maintenance.flag` to restore the public site.

## Admin provisioning
- Run `php backend/scripts/seed_admin.php` after migrations to create the initial `super_admin` (named `admin`) in local/CLI workflows or on hosts where you intentionally included the CLI tools. Provide credentials via prompts or `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.
- Use `--reset` or `ADMIN_FORCE_RESET=1` to rotate the password for the existing admin user without manual SQL.
- Default deploy bundles exclude `backend/scripts/` entirely. If you need the CLI tools on a host intentionally, rebuild with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true`.

## Test workflow
- Backend integration tests: `php backend/tests/run.php`
- Frontend unit/integration tests: `cd frontend/public-app && npm test` and `cd frontend/admin-app && npm test`
- Browser smoke suite: `npm run test:e2e`
- Full local verification: `bash scripts/test-all.sh`
- `scripts/test-all.sh` backs up the configured dev DB first, runs the backend/frontend/browser suites, then restores the DB on exit. It is safe to use with `bowwow_dev` if you let the script finish cleanly.
- The Playwright seed step uses `backend/scripts/seed_e2e_fixtures.php` to create/update a deterministic `admin` user (`e2e-admin@bowwow.local`) and seed one future booking date with fixed time buttons.

## Release packaging
- `backend/.env` is the local/dev file in this repo unless your host setup deliberately uses that same path.
- `.env.production` is kept out of version control and must never be shipped in deploy archives.
- Deploy zips exclude secrets, runtime uploads/media, and CLI-only backend tools by default.
