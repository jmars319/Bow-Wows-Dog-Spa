# Documentation Index

Start here for Bow Wow placeholder/full-app maintenance guidance.

## Core Docs

- `docs/SYSTEM_OVERVIEW.md` - architecture, placeholder/full-app split, and relaunch boundaries.
- `docs/DEVELOPER_GUIDE.md` - local setup, dev scripts, and verification workflow.
- `docs/DEPLOYMENT_GUIDE.md` - cPanel deployment, placeholder deploy, and admin schema migration notes.
- `docs/OPERATOR_NOTES.md` - day-to-day operational notes for the full app.
- `docs/MAINTAINER_GUIDE.md` - do-not-break workflows, retired assumptions, and relaunch guardrails.
- `docs/MEDIA_POLICY.md` - bundled assets, R2-backed uploads, local fallback, and attachment policy.
- `docs/POST_DEPLOY_CHECKLIST.md` - placeholder and full-app post-deploy smoke checks.
- `docs/R2_MIGRATION_CHECKLIST.md` - R2 validation and legacy upload migration checks for full-app media.
- `docs/CONTENT_REFERENCE.md` - archived copy/strategy notes, clearly marked as reference.

## Current Production State

The placeholder deploy remains authoritative until the full public/admin app is explicitly approved for launch. Full-app docs are maintained so development can resume cleanly, but they are not a signal to deploy the full app today.

## Current Standards

- Public app: `frontend/public-app` for the future full public site.
- Admin app: `frontend/admin-app` for the future full `/admin` surface.
- Backend source: `backend/`, staged as `/api` in full-site deploys.
- Runtime preservation: `api/uploads/` only as full-app local fallback/legacy compatibility; placeholder deploys should not preserve test/runtime storage.
- Admin maintenance: full app uses System Checks for DB, upload, SendGrid, media, and deploy-readiness diagnostics.
