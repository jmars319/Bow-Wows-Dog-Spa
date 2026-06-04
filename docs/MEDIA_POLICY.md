# Media Policy

## Current Deploy
- The placeholder deploy remains authoritative.
- The full app stays upload-capable for future gallery, retail, and content media, but production uploads are not part of the placeholder deploy archive.
- Local E2E uploads and content fixtures are cleaned after tests so manual review does not show test content.
- Full-app media uploads now follow the shared cPanel media contract: safe images plus PDF, text/CSV, Word, and Excel attachments only.
- Uploaded images receive normalized, hash-suffixed storage keys and optimized variants. Normal admin screens show simple file labels and do not expose generated variant internals.
- Image pickers stay image-only; documents are kept in the media library as attachments and are not selectable for public image slots.

## R2 Storage
- Keep the existing admin upload UI.
- Store new full-app uploads in Cloudflare R2 using the Bow Wow public/private bucket pair.
- Serve public images through `https://cdn.bowwowsdogspa.com`.
- Keep old cPanel upload references as legacy fallback until intentionally migrated.
- Use isolated prefixes for originals, variants, manifests, and attachments.

## Never Commit
- Production uploads, downloaded live-reference zips, local snapshots, `.env`, `.env.production`, logs, caches, or temporary deploy staging folders.
