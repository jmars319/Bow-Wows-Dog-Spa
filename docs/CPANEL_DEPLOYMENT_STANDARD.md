# cPanel Deployment Standard

Use extract-overwrite deployments. Do not delete the live site root or `api/` folder before extracting archives.

## Normal Archives

- `site-deploy.zip`: extract-overwrite into the public web root. This archive contains the public SPA at `/`, the admin SPA at `/admin`, and the PHP backend at `/api`.
- `deploy-placeholder.zip`: extract into the public web root only when the temporary placeholder should replace the public surface.

## Server-Owned Files

Preserve these on the host between deploys:

- `api/uploads/`
- `api/storage/`
- runtime logs/cache/media folders created by PHP

Normal deploy zips intentionally package ignored `backend/.env.production` as `api/.env` and exclude local env files, uploaded media, logs/cache/tmp, source maps, git metadata, and dev-only scripts. The normal site archive no longer ships the old `backend/` folder layout; `/api/index.php` is the backend entrypoint.

## Optional Config Restore

Only for emergency recovery outside the normal site deploy:

```bash
ALLOW_SECRET_CONFIG_ZIP=true npm run deploy:config
```

This creates ignored `server-config-deploy.zip` containing only `api/.env`. It is secret-bearing. Do not commit, email, or use it as a normal deploy artifact.
