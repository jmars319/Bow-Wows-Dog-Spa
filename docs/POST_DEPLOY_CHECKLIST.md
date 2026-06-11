# Post-Deploy Checklist

Use this after any Bow Wow placeholder deploy, and again before any future full-app launch.

## Placeholder Deploy

- Confirm `/` loads the branded placeholder page.
- Confirm `/privacy` and `/terms` load from the deployed root.
- Confirm unknown URLs return the branded not-found page.
- Confirm the deploy zip did not include full-app backend files, uploads, logs, caches, source maps, or local env files.
- Confirm `site-deploy.zip`, `backend-deploy.zip`, `frontend-deploy.zip`, and `server-config-deploy.zip` are absent from the web root or return `403`/`404`.
- Confirm the placeholder remains `noindex` until the full app is approved for launch.

## Full-App Pre-Launch Checks

- Confirm `/admin/login` loads from the admin app.
- Sign in and open `/admin/system`.
- Review the System Checks screen:
  - API health is ready.
  - Admin login is ready.
  - Database connection is ready.
  - Required full-app tables are present.
  - Upload folders are writable.
  - SendGrid is configured if booking/contact emails should send.
  - Image processing support is available.
- Confirm `api/.env` came from `backend/.env.production` in the deploy artifact.
- Confirm `api/.htaccess` blocks direct access to backend internals.
- Confirm `api/uploads/.htaccess` exists, but no uploaded media files are shipped in the deploy zip.

## Manual Smoke

- Public: home, booking flow, contact form, gallery/service pages, legal pages, and branded error pages.
- Admin: dashboard, bookings, schedule, services, content, media, retail/catalog, users, audit log, calendar prep, and system checks.
- Email: staff contact/booking notifications and customer confirmation/decline emails.
- Media: upload one test image, confirm variants are generated, then remove the test asset.

Do not use placeholder deployment success as proof that the full app is ready. The placeholder and full app have separate deployment confidence checks.
