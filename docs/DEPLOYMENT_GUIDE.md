# Deployment Guide – Bow Wow’s Dog Spa

This project is optimized for GoDaddy shared hosting with manual ZIP uploads. Follow the steps below for a clean deployment.

## 1. Prerequisites

- Node 18+
- PHP 8.1+ (CLI + cPanel runtime)
- MySQL 5.7+/8.x database created in GoDaddy
- SendGrid API key with permission to send mail from your verified domain

## 2. Build the bundles

From the repo root:

```bash
bash scripts/make-deploy-zips.sh   # builds both SPAs + placeholder, outputs deploy-*.zip
bash scripts/check-deploy-zips.sh  # optional sanity check
```

The build script compiles the React SPAs, refreshes placeholder/logo assets, and writes fresh `deploy-frontend.zip` and `deploy-backend.zip` to the repo root.

Default release posture:

- `deploy-backend.zip` excludes `backend/.env`, `backend/.env.production`, runtime uploads/media, and CLI-only backend tools.
- `deploy-frontend.zip` contains the live public site at `/`, the admin SPA at `/admin`, and the archived placeholder at `/placeholder`.

If you intentionally want the CLI migration/admin tools in the backend bundle, opt in explicitly:

```bash
INCLUDE_CLI_TOOLS_IN_DEPLOY=true bash scripts/make-deploy-zips.sh
INCLUDE_CLI_TOOLS_IN_DEPLOY=true bash scripts/check-deploy-zips.sh
```

## 3. Configure the backend

1. Upload `deploy-backend.zip` to your hosting account (e.g., `/home/{user}/bowwow-backend` or a subfolder under `public_html/api`).
2. Extract the ZIP; the contents include `backend/public`, `src`, `config`, `db`, and `migrations`. CLI scripts are excluded unless you built with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true`.
3. Copy `backend/.env.example` to `backend/.env`, then update the values (each block is labeled in the file):
   - `APP_URL` (usually `https://bowwowsdogspa.com`)
   - Database: `DB_HOST` (GoDaddy uses `localhost`), `DB_NAME`, `DB_USER`, `DB_PASS`
   - SendGrid: `SENDGRID_ENABLED`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `SENDGRID_STAFF_NOTIFICATIONS`, plus booleans for customer emails (`SENDGRID_SEND_CUSTOMER_RECEIPTS` / `SENDGRID_SEND_CUSTOMER_CONFIRMATIONS`)
   - Sessions: `SESSION_*` flags (`SESSION_SECURE=true` when HTTPS is forced)
   - Media pipeline settings (leave defaults unless storage differs)
4. Ensure the uploads tree defined by `UPLOAD_DIR` is writable by PHP. The default is `backend/uploads/` which must contain writable subdirectories:
   - `originals/`
   - `variants/optimized/`
   - `variants/webp/`
   - `manifests/`
   A `775` permission mask usually works on GoDaddy shared hosting.
5. Point an Apache virtual directory or subdomain (`/public_html/api`) to `backend/public`.
   - The included `.htaccess` routes all requests to `index.php`.

> Missing `.env` stops the backend immediately with a clear message, so keep `backend/.env` in place on the host. Never commit it, and never include it or `.env.production` in deploy ZIPs.

## 4. Database provisioning (No SSH)

For a clean install using phpMyAdmin:

1. Create the MySQL database + user inside GoDaddy (note the credentials for `.env`).
2. In phpMyAdmin, select the database and import/run `backend/db/master_schema.sql`.
3. Confirm that `schema_migrations` now contains a row such as `master_20250130_01`. Rerunning the file is safe; it only adds missing tables/columns/indexes.

### Optional: CLI migrations

If you have SSH/CLI access and intentionally included the CLI tools in the backend deploy, you can still apply the incremental migrations:

```bash
cd /path/to/backend
php scripts/run_migrations.php
```

The CLI runner executes each file under `backend/migrations/` sequentially. If you use the default deploy bundle, the CLI scripts are absent by design; use `master_schema.sql` via phpMyAdmin or rebuild with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true`.

### Seed the initial super admin

After migrations, create the first admin account (role `super_admin`) with the CLI seeder if you have intentionally deployed the CLI tools:

```bash
cd /path/to/backend
php scripts/seed_admin.php
```

The CLI script prompts for email/password (or reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`). Use `--reset` to overwrite an existing admin. On no-SSH/shared-host installs, seed the admin before packaging or use a controlled local/maintenance workflow instead of exposing a web seeder.

## 5. Deploy the front-end

1. Upload `deploy-frontend.zip` into your `public_html` (or subdomain) directory.
2. Extract; the archive already contains the correct structure:
   - `/index.html` + `/index.php` + `/.htaccess` → public SPA mounted at the site root
   - `/error-documents/` → branded static Apache fallback pages for `403`, `404`, `500`, and `503`
   - `/placeholder/` → archived placeholder page + static assets (logos)
   - `/admin/` → admin SPA build
3. Keep `backend` as a sibling directory of the deployed front-end so `/api` can be routed into `backend/public`.
4. Both SPAs expect the PHP API to be reachable at `/api`, so keep the backend’s `/public` folder mounted at `/api`.

Routing expectations on the live host:

- `/` serves the live site.
- `/preview` redirects to `/`.
- `/current` redirects to `/`.
- `/status/access-denied`, `/status/not-found`, `/status/server-error`, and `/status/maintenance` render the branded public status views.
- Unknown public URLs return a real `404`.
- `/placeholder/` remains archived and isolated.
- `/admin/login` is the real admin surface.
- `/api/*` is the backend entrypoint.

### Maintenance mode

The root `.htaccess` now supports a simple file-based maintenance toggle:

1. Create an empty `maintenance.flag` file in the same document root that contains the deployed `index.php` and `.htaccess`.
2. Public routes return a real `503` and Apache serves `/error-documents/503.html`.
3. `/admin/*`, `/api/admin/*`, and `/api/health` stay reachable so staff can still log in and health checks keep passing.
4. Remove `maintenance.flag` when the public site should go live again.

## 6. Environment-specific tweaks

- Enable HTTPS and set `session.secure` to `true`.
- Use GoDaddy’s cron or task scheduler to periodically prune expired booking holds if needed (sample SQL: `DELETE FROM booking_holds WHERE expires_at < NOW();`).

## 7. Real-host smoke test checklist

### Routing

1. Visit `/` and confirm the live public site renders.
2. Visit `/preview` and confirm it redirects to `/`.
3. Visit `/current` and confirm it redirects to `/`.
4. Visit an unknown public URL such as `/missing-page-check` and confirm you get the branded `404` page with Back + Home actions.
5. Visit `/status/access-denied`, `/status/not-found`, `/status/server-error`, and `/status/maintenance` and confirm each loads the expected branded state with the correct HTTP status.
6. Visit `/admin/login` and confirm the admin login renders correctly.
7. Visit `/privacy` and `/terms` and confirm the legal pages load with the correct root assets.

### Maintenance mode

1. Create `maintenance.flag` in the document root.
2. Confirm `/` and `/privacy` now return the branded `503` document.
3. Confirm `/admin/login` still loads.
4. Confirm `/api/health` still responds successfully.
5. Remove `maintenance.flag` and confirm `/` returns to the live public site.

### Backend & booking

1. Confirm `/api/public/site` returns the expected JSON payload.
2. Confirm schedule lookup works for a normal published date.
3. Confirm booking hold works.
4. Confirm booking request submission works end to end.
5. Confirm confirmed/declined booking actions update availability as expected.

### Uploads

1. Confirm the configured upload directory is writable by PHP.
2. Upload a booking attachment from the public form and confirm submission succeeds.
3. Download that attachment from the admin booking detail view and confirm the controlled download works.
4. Upload a media item from admin and confirm originals, variants, and manifests are written correctly.

### Email

1. Submit the contact form and confirm the staff email sends.
2. Submit a booking request and confirm the staff email sends.
3. Confirm a booking in admin and confirm the customer confirmation email sends.
4. Decline a booking in admin and confirm the customer decline email sends.

### Admin-only diagnostics

1. Visit `/admin/system` after logging in and verify the diagnostics checks are green.
2. Use this screen for environment verification only; there are no public debug endpoints.
