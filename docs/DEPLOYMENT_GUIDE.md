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

The build script compiles the React SPAs, refreshes placeholder/logo assets, adds the preview gate helpers, and writes fresh `deploy-frontend.zip` and `deploy-backend.zip` to the repo root.

## 3. Configure the backend

1. Upload `deploy-backend.zip` to your hosting account (e.g., `/home/{user}/bowwow-backend` or a subfolder under `public_html/api`).
2. Extract the ZIP; the contents include `backend/public`, `src`, `config`, `migrations`, and scripts.
3. Copy `backend/.env.example` to `backend/.env`, then update the values (each block is labeled in the file):
   - `APP_URL` (usually `https://bowwowsdogspa.com`)
   - Database: `DB_HOST` (GoDaddy uses `localhost`), `DB_NAME`, `DB_USER`, `DB_PASS`
   - SendGrid: `SENDGRID_ENABLED`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `SENDGRID_STAFF_NOTIFICATIONS`, plus booleans for customer emails (`SENDGRID_SEND_CUSTOMER_RECEIPTS` / `SENDGRID_SEND_CUSTOMER_CONFIRMATIONS`)
   - Sessions: `SESSION_*` flags (`SESSION_SECURE=true` when HTTPS is forced)
   - Media pipeline settings (leave defaults unless storage differs)
   - Preview gate controls: `PREVIEW_GATE_ENABLED`, `PREVIEW_GATE_PASSWORD`, `PREVIEW_GATE_SECRET` (long random string), cookie name/TTL if needed
4. Ensure the uploads tree defined by `UPLOAD_DIR` is writable by PHP. The default is `backend/uploads/` which must contain writable subdirectories:
   - `originals/`
   - `variants/optimized/`
   - `variants/webp/`
   - `manifests/`
   A `775` permission mask usually works on GoDaddy shared hosting.
5. Point an Apache virtual directory or subdomain (`/public_html/api`) to `backend/public`.
   - The included `.htaccess` routes all requests to `index.php`.

> Missing `.env` stops the backend immediately with a clear message, so keep `backend/.env` in place (never commit it, and never include it in deploy ZIPs).

## 4. Database provisioning (No SSH)

For a clean install using phpMyAdmin:

1. Create the MySQL database + user inside GoDaddy (note the credentials for `.env`).
2. In phpMyAdmin, select the database and import/run `backend/db/master_schema.sql`.
3. Confirm that `schema_migrations` now contains a row such as `master_20250130_01`. Rerunning the file is safe; it only adds missing tables/columns/indexes.

### Optional: CLI migrations

If you have SSH/CLI access you can still apply the incremental migrations:

```bash
cd /path/to/backend
php scripts/run_migrations.php
```

The CLI runner executes each file under `backend/migrations/` sequentially.

### Seed the initial super admin

After migrations, create the first admin account (role `super_admin`) using one of:

- **Temporary web endpoint (no SSH required)**  
  1. Set `ADMIN_SEED_KEY=some-long-random-string` in `backend/.env`.  
  2. Deploy the backend.  
  3. Visit `https://yourdomain.com/api/seed_admin.php?key=THE_KEY&email=admin@example.com&password=StrongPass123!` (use HTTPS). Optional `force=1` overwrites an existing user.  
  4. Remove `ADMIN_SEED_KEY` (or delete `backend/public/seed_admin.php`) after the admin is created.

- **CLI seeder (when SSH is available)**
  ```bash
  cd /path/to/backend
  php scripts/seed_admin.php
  ```
  The CLI script prompts for email/password (or reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`). Use `--reset` to overwrite an existing admin.

## 5. Deploy the front-end

1. Upload `deploy-frontend.zip` into your `public_html` (or subdomain) directory.
2. Extract; the archive already contains the correct structure:
   - `/index.php` + `/.htaccess` → placeholder + `/preview` gateway (root requests route here)
   - `/placeholder/` → static assets (logos) used by the placeholder
   - `/current/` → public SPA build guarded by `current/gate.php`
   - `/admin/` → admin SPA build
3. Ensure `/current` remains alongside `/placeholder` and `/index.php`. `/current/.htaccess` routes all `/current` requests through the gate so the preview cookie is checked before serving any asset.
4. `/preview` shares the same configuration as the backend (reads `backend/.env`), so keep `backend` as a sibling directory of the deployed front-end.
5. Both SPAs expect the PHP API to be reachable at `/api`, so keep the backend’s `/public` folder mounted at `/api`.

## 6. Environment-specific tweaks

- Enable HTTPS and set `session.secure` to `true`.
- Use GoDaddy’s cron or task scheduler to periodically prune expired booking holds if needed (sample SQL: `DELETE FROM booking_holds WHERE expires_at < NOW();`).

## 7. Smoke test

1. Visit `/privacy` and `/terms` to confirm routing works.
2. Submit the public booking form (should emit SendGrid emails).
3. Log into `/admin/login`, confirm dashboard data loads.
4. Upload a media asset and confirm it appears under `backend/uploads/` (original + variants + manifest).
5. Confirm booking status transitions update both the booking list and public availability.
6. Visit `/preview`, enter the configured password, and confirm `/current` now renders the SPA while ungated visits redirect back to `/preview`.
7. Visit `/admin/system` and verify the diagnostics checks are green (or follow the remediation hints shown in the UI).
