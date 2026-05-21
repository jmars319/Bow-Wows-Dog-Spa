# Deployment Guide – Bow Wow’s Dog Spa

This project is optimized for GoDaddy shared hosting with manual ZIP uploads. Follow the steps below for a clean deployment.

For the short standard policy shared by the cPanel sites, see `docs/CPANEL_DEPLOYMENT_STANDARD.md`.

## 1. Prerequisites

- Node 18+
- PHP 8.1+ (CLI + cPanel runtime)
- MySQL 5.7+/8.x database created in GoDaddy
- SendGrid API key with permission to send mail from your verified domain

## 2. Build the bundles

From the repo root:

```bash
bash scripts/make-deploy-zips.sh   # builds both SPAs, outputs site-deploy.zip
bash scripts/check-deploy-zips.sh  # optional sanity check
```

The build script compiles the React SPAs, refreshes public logo assets, and writes fresh `site-deploy.zip` to the repo root.

For a temporary placeholder-only deployment, build the standalone mini site instead:

```bash
bash scripts/make-placeholder-deploy-zip.sh   # outputs deploy-placeholder.zip
```

Default release posture:

- `site-deploy.zip` stages the ignored local `backend/.env.production` file as `api/.env`, excludes all other `.env*` files, and excludes legacy config PHP files, runtime uploads/media, logs/cache/tmp, tests, source maps, git files, and CLI/schema tools by default. It contains the live public site at `/`, the admin SPA at `/admin`, and the PHP backend at `/api`.
- `site-deploy.zip` may include `api/uploads/.htaccess` as the upload-directory guard, but no uploaded media.
- `deploy-placeholder.zip` is a separate root-only mini site with its own `index.php`, `.htaccess`, `robots.txt`, legal pages, error documents, and `/assets` logos. It must not contain backend, source, upload, log, cache, `.env`, git, or source-map files.

If you intentionally want the CLI migration/admin tools in the backend bundle, opt in explicitly:

```bash
INCLUDE_CLI_TOOLS_IN_DEPLOY=true bash scripts/make-deploy-zips.sh
INCLUDE_CLI_TOOLS_IN_DEPLOY=true bash scripts/check-deploy-zips.sh
```

## 3. Configure the backend

1. Upload `site-deploy.zip` to the public web root and extract-overwrite.
2. Confirm the extracted backend entrypoint is `api/index.php`. CLI scripts are excluded unless you built with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true`.
3. Confirm local `backend/.env.production` contains the production values before building; the deploy zip packages it as `api/.env`:
   - `APP_URL` (usually `https://bowwowsdogspa.com`)
   - Database: `DB_HOST` (GoDaddy uses `localhost`), `DB_NAME`, `DB_USER`, `DB_PASS`
   - SendGrid: `SENDGRID_ENABLED`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `SENDGRID_STAFF_NOTIFICATIONS`, plus booleans for customer emails (`SENDGRID_SEND_CUSTOMER_RECEIPTS` / `SENDGRID_SEND_CUSTOMER_CONFIRMATIONS`)
   - Sessions: `SESSION_*` flags (`SESSION_SECURE=true` when HTTPS is forced)
   - Media pipeline settings (leave defaults unless storage differs)
4. Ensure the uploads tree defined by `UPLOAD_DIR` is writable by PHP. The default in the deployed layout is `api/uploads/` which must contain writable subdirectories:
   - `originals/`
   - `variants/optimized/`
   - `variants/webp/`
   - `manifests/`
   A `775` permission mask usually works on GoDaddy shared hosting.
5. Keep `api/.htaccess` in place. It routes API requests to `api/index.php` and blocks direct access to internals such as `src/`, `bootstrap/`, `migrations/`, and scripts.

> Missing `.env` stops the backend immediately with a clear message. Never commit `backend/.env.production`; it is copied into deploy ZIPs only as `api/.env`.

## 4. Database provisioning (No SSH)

For a clean install using phpMyAdmin:

1. Create the MySQL database + user inside GoDaddy (note the credentials for `.env`).
2. In phpMyAdmin, select the database and import/run `backend/db/master_schema.sql`.
3. Confirm that `schema_migrations` now contains a row such as `master_20250130_01`. Rerunning the file is safe; it only adds missing tables/columns/indexes.

### Required before full-site relaunch: admin usernames

Bow Wow's current live production surface is the placeholder. Before relaunching the full public/admin app, make sure the production DB has the same admin username fields used by the other cPanel sites. Older Bow Wow databases may only have email-based admin users.

The preferred path is to run `backend/db/master_schema.sql` in phpMyAdmin. If you only need the admin username/display-name patch, run:

```sql
SET @dbName := DATABASE();

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @dbName
    AND table_name = 'admin_users'
    AND column_name = 'username'
);
SET @ddl := IF(
  @exists = 0,
  'ALTER TABLE admin_users ADD COLUMN username VARCHAR(100) NULL AFTER email',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @dbName
    AND table_name = 'admin_users'
    AND index_name = 'uniq_admin_users_username'
);
SET @ddl := IF(
  @exists = 0,
  'ALTER TABLE admin_users ADD UNIQUE KEY uniq_admin_users_username (username)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @dbName
    AND table_name = 'admin_users'
    AND column_name = 'display_name'
);
SET @ddl := IF(
  @exists = 0,
  'ALTER TABLE admin_users ADD COLUMN display_name VARCHAR(191) NULL AFTER email',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

After this schema patch, seed or update admin users so every active admin has both `username` and `email` populated.

### Optional: CLI migrations

If you have SSH/CLI access and intentionally included the CLI tools in the backend deploy, you can still apply the incremental migrations:

```bash
cd /path/to/backend
php scripts/run_migrations.php
```

The CLI runner executes each file under `backend/migrations/` sequentially. If you use the default deploy bundle, the CLI scripts and schema files are absent by design; use the repo copy of `backend/db/master_schema.sql` via phpMyAdmin or rebuild with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true`.

### Seed the initial super admin

After migrations, create the first admin account (role `super_admin`) with the CLI seeder if you have intentionally deployed the CLI tools:

```bash
cd /path/to/backend
php scripts/seed_admin.php
```

The CLI script prompts for email/password (or reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`). Use `--reset` to overwrite an existing admin. On no-SSH/shared-host installs, seed the admin before packaging or use a controlled local/maintenance workflow instead of exposing a web seeder.

## 5. Deploy the front-end

1. Upload `site-deploy.zip` into your `public_html` (or subdomain) directory.
2. Extract-overwrite; the archive already contains the correct structure:
   - `/index.html` + `/index.php` + `/.htaccess` → public SPA mounted at the site root
   - `/error-documents/` → branded static Apache fallback pages for `403`, `404`, `500`, and `503`
   - `/admin/` → admin SPA build
   - `/api/` → PHP backend runtime
3. Both SPAs expect the PHP API to be reachable at `/api`, so preserve `api/uploads/` between full-site releases. Runtime storage, logs, cache, and temp folders are disposable and should not be treated as business data.

Routing expectations on the live host:

- `/` serves the live site.
- `/status/access-denied`, `/status/not-found`, `/status/server-error`, and `/status/maintenance` render the branded public status views.
- Unknown public URLs return a real `404`.
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
2. Visit an unknown public URL such as `/missing-page-check` and confirm it returns the branded `404` page with Back + Home actions.
3. Visit `/status/access-denied`, `/status/not-found`, `/status/server-error`, and `/status/maintenance` and confirm each loads the expected branded state with the correct HTTP status.
4. Visit `/admin/login` and confirm the admin login renders correctly.
5. Visit `/privacy` and `/terms` and confirm the legal pages load with the correct root assets.

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
