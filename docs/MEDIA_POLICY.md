# Media Policy

## Current Deploy
- The placeholder deploy remains authoritative.
- The full app stays upload-capable for future gallery, retail, and content media, but production uploads are not part of the placeholder deploy archive.
- Local E2E uploads and content fixtures are cleaned after tests so manual review does not show test content.

## Future R2 Pass
- Keep the existing admin upload UI.
- Store new full-app uploads in Cloudflare R2 instead of cPanel disk after buckets, custom domains, and scoped tokens are available.
- Keep old cPanel upload references as legacy fallback until intentionally migrated.

## Never Commit
- Production uploads, downloaded live-reference zips, local snapshots, `.env`, `.env.production`, logs, caches, or temporary deploy staging folders.
