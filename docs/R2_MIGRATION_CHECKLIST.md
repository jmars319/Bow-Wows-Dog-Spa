# R2 Migration Checklist

Bow Wow currently keeps the placeholder deploy authoritative. Use this checklist when the full public/admin app is approved and media uploads need to move from cPanel disk to Cloudflare R2.

## Bucket Setup

- Use the standard Bow Wow bucket pair:
  - `bowwowsdogspa-com-media-public`
  - `bowwowsdogspa-com-media-private`
- Serve future public media from `https://cdn.bowwowsdogspa.com`.
- Use separate prefixes for:
  - `originals/`
  - `variants/optimized/`
  - `variants/webp/`
  - `manifests/`
  - `attachments/`
- Attach `cdn.bowwowsdogspa.com` to the public bucket only; private attachments must stay behind backend download routes.
- Create least-privilege credentials for this site bucket pair only.
- Purge exact CDN URLs with `npm run cdn:purge -- https://cdn.bowwowsdogspa.com/path/to/file` only when replacing an existing public object.

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
