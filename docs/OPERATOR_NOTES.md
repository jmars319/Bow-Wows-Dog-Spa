# Operator Notes – Bow Wow’s Dog Spa

## Local dev quick start
- Run `bash scripts/dev-start.sh` to boot the backend plus the public (`5173`) and admin (`5174`) Vite servers.
- Public SPA: http://127.0.0.1:5173/ (proxying `/api` to `php -S 127.0.0.1:8088`).
- Admin SPA: http://127.0.0.1:5174/admin/login (adjust ports/paths via `.dev/dev-config.sh`).
- `bash scripts/dev-status.sh` reports PID/port health; `bash scripts/dev-stop.sh` tears everything down when you’re done.

## Booking workflow
1. Public guests open the Booking section, reserve a time button (hold lasts 10 minutes), and submit the intake form.
2. Backend creates a `booking_requests` record with `pending_confirmation`, logs the action, notifies staff, and emails the guest a receipt.
3. Admins review entries under **Booking Requests**:
   - `Confirm` locks the slot, releases the hold, and emails the guest confirmation.
   - `Decline` or `Cancel` frees the slot and captures optional notes.
4. Dashboard surfaces counts for new/pending/confirmed bookings, plus the latest audit items.

## Schedule setup
- **Weekday Templates**: define default time buttons for each weekday (comma-separated `HH:MM` values). Disable unused days by setting `is_enabled` to `0`.
- **Date Overrides**: specify closed days or custom schedules for holidays and special events. Overrides supersede weekday templates.
- A slot is considered unavailable when:
  - A pending request holds the time within its hold window.
  - An admin confirmed booking already uses the time.
  - A manual hold exists (via public selection) and has not expired.

## Content management
- **Text & Site Info**: update hero copy, about text, policy blocks, serving-area tagline, and default email language.
- **Happy Clients**: add before/after blurbs with optional image references (selected from the Media Library).
- **Retail**: maintain boutique products with optional prices and featured flags.
- **Media Manager**: upload photos (XHR progress UI) and provide category/alt/title/caption. Originals land in `backend/uploads/originals` and responsive variants + WebP + manifests are generated automatically per the Generic Image Pipeline spec.

## RBAC summary
- `super_admin`: full access, plus Admin Users screen.
- `manager`: dashboard, booking, schedule, content, media, happy clients, retail, audit.
- `scheduler`: schedule + booking views.
- `content_editor`: content, retail, happy clients, media.

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

## Preview gate
- `/` renders a placeholder with the latest logo + contact info. `/preview` accepts the preview password (configured via `PREVIEW_GATE_PASSWORD`).
- Successful preview submissions set an HttpOnly cookie for 24 hours, granting access to `/current` where the live SPA is mounted.
- Toggle the gate globally with `PREVIEW_GATE_ENABLED` inside `backend/.env`. Set it to `false` when the build is ready for full public release.
- Update `PREVIEW_GATE_SECRET` (long random string) whenever you rotate the preview password so previously issued cookies immediately invalidate.
- Updating the password requires clearing the preview cookie (or waiting for expiry) before the new password is enforced.

## Admin provisioning
- Run `php backend/scripts/seed_admin.php` after migrations to create the initial `super_admin` (named `admin`). Provide credentials via prompts or `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.
- Use `--reset` or `ADMIN_FORCE_RESET=1` to rotate the password for the existing admin user without manual SQL.
