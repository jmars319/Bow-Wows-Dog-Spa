# Developer Guide

Use this guide for local development on Bow Wow's full app. Production currently uses the placeholder deploy unless the client explicitly approves full-app launch.

## Local Setup

Install dependencies in each frontend app:

```bash
cd frontend/public-app && npm install
cd ../admin-app && npm install
cd ../..
npm install
composer install --working-dir=backend
```

Configure local backend values:

```bash
cp backend/.env.example backend/.env
```

Fill in local database, SendGrid-safe defaults, session, and media settings. Keep `backend/.env` out of git.

The full PHP backend uses the shared `jamarq/cpanel-backend-kit` Composer package for cPanel-safe primitives. This repo carries the approved package artifact under `third_party/composer/` so CI and deploy packaging do not require private Git credentials. Do not commit `backend/auth.json`, tokens, or `backend/vendor/`.

## Dev Servers

Use the repo scripts instead of starting pieces manually:

```bash
npm run dev:start
npm run dev:status
npm run dev:stop
```

Manual review uses the public dev origin. `/admin` and `/admin/login` should work from that same origin, with the direct admin port kept for debugging only. Automated tests use `npm run dev:test` so test ports clean themselves up.

## Verification

For normal full-app changes:

```bash
npm run lint
npm run test:unit
npm run test:e2e
npm run build
npm run test:deploy
npm run test:all
```

For placeholder-only changes:

```bash
npm run deploy:placeholder
npm run check:live-reference
```

If a check is skipped because local database or email config is unavailable, document the exact reason in the final handoff.

## Development Guardrails

- Keep placeholder and full-app deployment confidence separate.
- Keep full-app public routes, `/admin/login`, and `/api/*` stable.
- Keep public form records SQL-backed before email notification.
- Keep admin System Checks as the first place to inspect DB, uploads, SendGrid, media, and deploy readiness.
- Keep normal admin media labels non-technical; generated variant names and storage keys belong only in diagnostics.
- Google Calendar sync and R2 are part of the full-app launch foundation. Keep retail checkout and full-app production launch behind separate approval.

## Deploy Shape

Full-site deploys stage:

```text
/          public app
/admin     admin app
/api       PHP backend
```

`backend/.env.production` is copied into the artifact as `api/.env`. The artifact must exclude local env files, uploaded media, generated variants, storage, logs, caches, source maps, test output, git metadata, and placeholder source folders.

The placeholder deploy is separate and root-only. It must not include backend code, uploads, runtime data, or secrets.
