# System Overview

Bow Wow's Dog Spa has two deployment surfaces:

- **Placeholder site:** the current production-authoritative noindex mini site, packaged by `npm run deploy:placeholder`.
- **Full public/admin app:** the future launch surface, packaged by `npm run deploy:make` when explicitly approved.

Do not treat full-app readiness as permission to replace the placeholder. The placeholder remains the live target until the relaunch checklist is complete.

## Architecture

```text
frontend/
  public-app/   Public Vite app for the full site
  admin-app/    Admin Vite app for /admin
backend/        PHP API source, staged as /api for full-site deploys
placeholder/    Temporary production placeholder source
scripts/        Dev, verification, and deploy helpers
docs/           Maintainer, deployment, media, and content references
```

The full app follows the cPanel spine used by the other sites: public at `/`, admin at `/admin`, and backend at `/api`. Bow Wow does not currently have a `frontend/shared/src` folder because the full app predates the latest shared-code split. Add one during the relaunch pass only when shared code extraction reduces real duplication.

## Public Surface

The full public app includes booking, contact, services, gallery, retail/catalog groundwork, legal/status pages, branded error pages, and Google Calendar-backed availability for booking slots.

The placeholder site includes only coming-soon status, legal pages, brand assets, noindex behavior, and static Apache routing.

## Admin Surface

The full admin app includes dashboard, bookings, schedule, services, site content, gallery/media, retail/catalog groundwork, users, audit log, Google Calendar sync, and System Checks.

Before full-app relaunch, confirm:

- `admin_users.username` and `admin_users.display_name` exist in production.
- The client `admin` login and dedicated webmaster admin login both exist.
- `/admin/login`, `/api/*`, media uploads, SendGrid, booking flows, and all active admin modules pass local and production smoke checks.

## Backend

The backend is a custom PHP API using `backend/public/index.php` locally and staged as `/api/index.php` in the cPanel artifact. Internal code lives under `backend/src`, with migrations/schema under `backend/migrations` and `backend/db`.

Default full-site deploys intentionally exclude CLI tools, migrations, schema SQL, tests, local env files, logs, caches, storage, and uploaded media. Build with `INCLUDE_CLI_TOOLS_IN_DEPLOY=true` only for an explicit maintenance need.

## Runtime Storage

Full-app uploads use R2 from launch, with `api/uploads/` retained only as a local fallback and legacy compatibility layer. Placeholder deploys do not preserve or rely on runtime upload data.

## Future Work

- Relaunch decision and production database schema confirmation.
- Optional extraction of duplicated frontend code into `frontend/shared/src`.
- Production R2 smoke and legacy upload fallback cleanup after the full app is approved for launch.
- Retail checkout only after catalog-only behavior is explicitly changed.
