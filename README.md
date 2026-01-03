# Bow Wow’s Dog Spa Platform

Monorepo for the Bow Wow’s Dog Spa build, covering:

- `frontend/public-app`: Public single-page site with booking + contact forms.
- `frontend/admin-app`: Admin SPA with RBAC-protected modules for content, bookings, schedule, media, etc.
- `backend`: PHP API with SendGrid integration, MySQL persistence, media processing, and audit logging.
- `scripts`: Helper build scripts that emit deploy-ready ZIPs for GoDaddy.
- `docs`: Deployment + operator runbooks.

## Quick start

```bash
# Public SPA
cd frontend/public-app
npm install
npm run dev

# Admin SPA
cd ../admin-app
npm install
npm run dev

# PHP backend (ensure backend/.env is configured first)
cd ../../backend
php -S localhost:8000 -t public
```

> First-time setup: copy `backend/.env.example` to `backend/.env`, fill in DB + SendGrid + preview gate values, and ensure the file stays out of version control.

See `docs/DEPLOYMENT_GUIDE.md` for cPanel deployment steps and `docs/OPERATOR_NOTES.md` for day-to-day workflows.

## Configuration overview (`backend/.env`)

`backend/.env.example` is grouped into labeled sections so operators can skim the knobs quickly:

- **Application** – `APP_URL`, `APP_ENV`, `APP_DEBUG`.
- **Database** – GoDaddy credentials (`DB_HOST=localhost`, plus DB/user/pass).
- **SendGrid Email**
  - `SENDGRID_ENABLED`
  - `SENDGRID_STAFF_NOTIFICATIONS`
  - `SENDGRID_SEND_CUSTOMER_RECEIPTS`
  - `SENDGRID_SEND_CUSTOMER_CONFIRMATIONS`
  - `SENDGRID_API_KEY`, `SENDGRID_FROM_*`
- **Sessions** – cookie name, lifetime, `SESSION_SECURE` (set `true` when HTTPS enforced).
- **Media & Upload Processing** – `UPLOAD_DIR`, size/quality knobs, width profiles.
- **Preview Gate** – password, secret, cookie, TTL, and master enable flag.

Missing `.env` results in a clear bootstrap error so the backend never runs with partial config.

## Preview placeholder & gate

- `/` renders a lightweight placeholder with logo + contact info pulled from the API (noindex/nofollow).
- `/preview` is a simple password gate. On success it sets an HttpOnly cookie for 24h and redirects to `/current`.
- `/current` serves the public SPA but is protected by the preview gate when `PREVIEW_GATE_ENABLED=true`.
- Configure the gate via `backend/.env`:
  - `PREVIEW_GATE_ENABLED`
  - `PREVIEW_GATE_PASSWORD`
  - `PREVIEW_GATE_SECRET` (signing key for preview tokens)
  - `PREVIEW_GATE_COOKIE` (optional)
  - `PREVIEW_GATE_COOKIE_TTL`
- Set `PREVIEW_GATE_ENABLED=false` to skip the placeholder/gate and always load `/current`.

## Dev & deploy scripts

Generic helper scripts live under `scripts/` (see `Generic-Scripts-Reference.md` for philosophy). Highlights:

| Command | Description |
| --- | --- |
| `bash scripts/dev-start.sh` | Launch backend PHP server plus the public + admin Vite dev servers. |
| `bash scripts/dev-stop.sh` | Stop all dev servers (logs/pids in `.dev/`). |
| `bash scripts/dev-status.sh` | Show PID + port status for backend/public/admin services. |
| `bash scripts/dev-verify.sh` | Full smoke test: stop → start → check (backend/public/admin) → restart → re-check. |
| `bash scripts/make-deploy-zips.sh` | Builds React apps, refreshes preview assets, and produces `deploy-frontend.zip` + `deploy-backend.zip`. |
| `bash scripts/check-deploy-zips.sh` | Quick sanity-check of the generated deploy archives. |

- Copy `scripts/dev-config.example.sh` to `.dev/dev-config.sh` to override default ports/paths (backend/public/admin).
- Logs and pid files live under `.dev/`.
- In dev, the public SPA runs at `http://127.0.0.1:5173/` and the admin SPA at `http://127.0.0.1:5174/admin/login` (adjust ports via `.dev/dev-config.sh`).
- Deploy zips exclude secrets (`backend/.env`, uploads, node_modules) and include the placeholder + preview gate files so they can be uploaded directly to GoDaddy.

Brand assets live under `frontend/public-app/src/assets/logos/` (with PNG + WebP variants) and are reused by the placeholder as well as the React SPAs.
