# R2 Migration Checklist

Bow Wow currently keeps the placeholder deploy authoritative. Use this checklist when the full public/admin app is approved and media uploads need to move from cPanel disk to Cloudflare R2.

## Bucket Setup

- Create one dedicated R2 bucket for Bow Wow media.
- Use separate prefixes for:
  - `originals/`
  - `variants/optimized/`
  - `variants/webp/`
  - `manifests/`
  - `attachments/`
- Configure a public-read path or signed-download path that matches the final media policy.
- Create least-privilege credentials for this site only.

## App Changes

- Keep the existing admin upload UI.
- Switch the storage adapter from local disk to R2.
- Store media records with provider `r2`, object keys, MIME, size, checksum, alt text, caption, dimensions, and usage metadata.
- Keep old cPanel upload references as legacy fallback until they are intentionally migrated.
- Keep built-in site images bundled unless staff needs to manage them.

## Migration Checks

- Upload a new image and confirm original, optimized, WebP, and manifest objects are written.
- Upload a safe document attachment and confirm it downloads through the controlled endpoint.
- Confirm delete/archive blocks in-use media.
- Confirm public pages fall back to bundled images when an old upload is missing.
- Confirm deploy zips still exclude runtime uploads and generated variants.

## Rollback

- Leave local upload fallback in place until R2 has been validated on the production host.
- Keep old cPanel upload folders untouched until all production references have been migrated or intentionally retired.
