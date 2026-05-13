# cPanel Deployment Standard

Use extract-overwrite deployments. Do not delete the live site root or backend folder before extracting archives.

## Normal Archives

- `frontend-deploy.zip`: extract into the public web root.
- `backend-deploy.zip`: extract into the public web root. This archive contains `backend/`, and the root `.htaccess` routes `/api/*` to `backend/public/`.
- `deploy-placeholder.zip`: extract into the public web root only when the temporary placeholder should replace the public surface.

## Server-Owned Files

Preserve these on the host between deploys:

- `backend/.env`
- `backend/uploads/`
- `backend/storage/`
- runtime logs/cache/media folders created by PHP

Normal deploy zips intentionally exclude secrets, uploaded media, logs/cache/tmp, source maps, git metadata, and dev-only scripts.

## Optional Config Restore

Only for first setup or emergency recovery:

```bash
ALLOW_SECRET_CONFIG_ZIP=true npm run deploy:config
```

This creates ignored `server-config-deploy.zip` containing only `backend/.env`. It is secret-bearing. Do not commit, email, or use it as a normal deploy artifact.
