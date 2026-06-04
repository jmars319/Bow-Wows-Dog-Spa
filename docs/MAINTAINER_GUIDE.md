# Maintainer Guide

This guide captures the current Bow Wow maintenance decisions without relying on loose reference files.

## Current Source Of Truth

- `README.md` and `docs/README.md` are the entry points.
- `docs/SYSTEM_OVERVIEW.md` describes the placeholder/full-app split and architecture.
- `docs/DEVELOPER_GUIDE.md` covers local setup, scripts, and verification workflow.
- `docs/DEPLOYMENT_GUIDE.md` is the deployment and database-migration reference.
- `docs/OPERATOR_NOTES.md` covers operator workflows for the full app.
- `docs/MEDIA_POLICY.md` covers permanent assets, R2-backed uploads, local fallback, and attachment policy.
- `docs/CONTENT_REFERENCE.md` preserves old content strategy notes without treating them as live truth.

## Production State

- The placeholder deploy is still the active production target.
- The full public/admin app should stay buildable and testable, but it is not the live target until explicitly approved.
- Any full-app development must keep catalog-only retail concepts labeled as pre-launch/internal until the client approves checkout behavior.

## Do-Not-Break Workflows

- Keep placeholder packaging and placeholder routes noindex and standalone.
- Keep `/admin/login`, `/api/*`, booking, content, media, services, gallery, users, and system workflows stable in the full app.
- Keep SendGrid contact/booking mail configurable and safe when unconfigured locally.
- Keep upload/runtime folders out of deploy zips except protected upload folder scaffolding where the deploy script intentionally includes it.
- Keep the full app aligned with the shared cPanel admin convention: client `admin` plus dedicated webmaster admin, username support, and normal `/admin` routing.
- Keep System Checks as the first admin place to review database, upload, SendGrid, media, and deploy-readiness issues.
- Keep Media Manager and upload labels non-technical for staff; generated variants and storage keys belong in diagnostics only.

## Relaunch Guardrails

- Before relaunching the full app, confirm the live database includes `admin_users.username` and `admin_users.display_name`.
- Seed both the client admin and webmaster admin after the schema is current.
- Re-check legal/status/contact pages, full public app forms, uploads, SendGrid, and all active admin modules before replacing the placeholder.

## Retired Assumptions

- Do not treat old generated phone, address, pricing, social, service, or retail copy as live truth.
- Do not turn catalog-only retail prep into live checkout.
- Do not preserve `api/storage/` for placeholder deploys; current placeholder runtime data is disposable.
- Do not add `frontend/shared/src` just to satisfy the folder shape. Extract shared frontend code during the relaunch pass only when it removes real duplication.

## Verification Baseline

Before full-app changes are published:

```bash
npm run lint
npm run test:unit
npm run test:e2e
npm run build
npm run test:deploy
npm run test:all
```

For placeholder-only changes, use `bash scripts/make-placeholder-deploy-zip.sh` and the placeholder deploy checks.
