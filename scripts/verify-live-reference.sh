#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_NAME="${SITE_NAME:-bowwowsdogspa.com}"
MODE="${LIVE_REFERENCE_MODE:-placeholder}"
LIVE_REF_ZIP="${LIVE_REF_ZIP:-$ROOT_DIR/../../../../_live-reference/bowwowsdogspa.com/deploy-placeholder.zip}"
CURRENT_ZIP="${CURRENT_ZIP:-$ROOT_DIR/deploy-placeholder.zip}"
PROD_ENV_FILE="${PROD_ENV_FILE:-$ROOT_DIR/backend/.env.production}"

log() { printf '[live-reference][%s] %s\n' "$SITE_NAME" "$*"; }
warn() { printf '[live-reference][%s][WARN] %s\n' "$SITE_NAME" "$*" >&2; }
fail() { printf '[live-reference][%s][ERROR] %s\n' "$SITE_NAME" "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"; }

need_cmd unzip
need_cmd grep
need_cmd sort
need_cmd comm
need_cmd shasum

[[ -f "$LIVE_REF_ZIP" ]] || fail "Live reference zip not found: $LIVE_REF_ZIP"
[[ -f "$CURRENT_ZIP" ]] || fail "Current deploy zip not found: $CURRENT_ZIP"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/live-reference.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
LIVE_LIST="$TMP_DIR/live.txt"
CURRENT_LIST="$TMP_DIR/current.txt"
unzip -Z1 "$LIVE_REF_ZIP" | sort > "$LIVE_LIST"
unzip -Z1 "$CURRENT_ZIP" | sort > "$CURRENT_LIST"

zip_has() { grep -E -q "$2" "$1"; }
require_current() { zip_has "$CURRENT_LIST" "$2" || fail "Current deploy zip missing $1"; }
forbid_current() { if zip_has "$CURRENT_LIST" "$2"; then fail "Current deploy zip contains disallowed $1"; fi; }

check_live_category() {
  local label="$1" live_pattern="$2" current_pattern="$3"
  if zip_has "$LIVE_LIST" "$live_pattern"; then
    if zip_has "$CURRENT_LIST" "$current_pattern"; then
      log "OK: $label"
    else
      warn "Live artifact contains $label, but current deploy does not show a matching path. Confirm this is intentionally superseded."
    fi
  fi
}

check_env_digest() {
  [[ "$MODE" == "full" ]] || return 0
  [[ -f "$PROD_ENV_FILE" ]] || fail "Production env file missing: $PROD_ENV_FILE"
  unzip -p "$CURRENT_ZIP" api/.env > "$TMP_DIR/current.env" 2>/dev/null || fail "Unable to read api/.env from current deploy zip"
  shasum -a 256 "$PROD_ENV_FILE" | awk '{print $1}' > "$TMP_DIR/source-env.sha"
  shasum -a 256 "$TMP_DIR/current.env" | awk '{print $1}' > "$TMP_DIR/current-env.sha"
  cmp -s "$TMP_DIR/source-env.sha" "$TMP_DIR/current-env.sha" || fail "api/.env does not match backend/.env.production digest"
  sed -n -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=.*/\1/p' "$PROD_ENV_FILE" | sort > "$TMP_DIR/source-env.keys"
  sed -n -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=.*/\1/p' "$TMP_DIR/current.env" | sort > "$TMP_DIR/current-env.keys"
  missing_keys="$(comm -23 "$TMP_DIR/source-env.keys" "$TMP_DIR/current-env.keys" || true)"
  [[ -z "$missing_keys" ]] || fail "api/.env is missing keys from backend/.env.production: $(tr '\n' ' ' <<< "$missing_keys")"
  log "OK: api/.env is packaged and matches production env digest"
}

check_full_deploy() {
  require_current "root index.html" '^index[.]html$'
  require_current "admin app at /admin" '^admin/index[.]html$'
  require_current "root .htaccess" '^[.]htaccess$'
  require_current "API env at api/.env" '^api/[.]env$'
  require_current "API .htaccess" '^api/[.]htaccess$'
  require_current "API entrypoint" '^api/(index|router)[.]php$'
  require_current "branded 403 page" '(^|/)(403[.]html|error-documents/403[.]html)$'
  require_current "branded 404 page" '(^|/)(404[.]html|error-documents/404[.]html)$'
  require_current "branded 500 page" '(^|/)(500[.]html|error-documents/500[.]html)$'
  require_current "branded 503 page" '(^|/)(503[.]html|error-documents/503[.]html)$'

  env_entries="$(grep -E '(^|/)[.]env($|[./])' "$CURRENT_LIST" || true)"
  if printf '%s\n' "$env_entries" | grep -Ev '^api/[.]env$' >/dev/null; then
    fail "Current deploy zip contains unexpected env files"
  fi
  forbid_current "source maps" '[.]map$'
  forbid_current "git metadata or macOS metadata" '(^|/)[.]git(/|$)|(^|/)[.]gitignore$|(^|/)[.]DS_Store$'
  forbid_current "repo source folders" '^(backend|frontend|src|node_modules|_live-reference)(/|$)'
  forbid_current "backend tests/scripts" '^api/(tests|scripts)(/|$)'
  forbid_current "runtime logs/tmp/storage/sessions" '^api/(logs|tmp|storage|sessions)(/|$)'

  upload_entries="$(grep -E '^api/uploads/' "$CURRENT_LIST" || true)"
  if [[ -n "$upload_entries" ]] && printf '%s\n' "$upload_entries" | grep -Ev '^api/uploads/?$|^api/uploads/[.]htaccess$' >/dev/null; then
    fail "Current deploy zip contains uploaded media; only api/uploads/.htaccess is allowed"
  fi
  cache_entries="$(grep -E '^api/cache/' "$CURRENT_LIST" || true)"
  if [[ -n "$cache_entries" ]] && printf '%s\n' "$cache_entries" | grep -Ev '^api/cache/?$|^api/cache/[.]htaccess$' >/dev/null; then
    fail "Current deploy zip contains runtime cache data; only api/cache/.htaccess is allowed"
  fi
  check_env_digest
}

check_placeholder_deploy() {
  require_current "placeholder index.php" '^index[.]php$'
  require_current "root .htaccess" '^[.]htaccess$'
  require_current "robots.txt" '^robots[.]txt$'
  require_current "privacy page" '^privacy[.]html$'
  require_current "terms page" '^terms[.]html$'
  require_current "placeholder assets" '^assets/'
  forbid_current "backend/API files" '^api(/|$)'
  forbid_current "env files" '(^|/)[.]env($|[./])'
  forbid_current "source/runtime folders" '^(backend|frontend|src|node_modules|uploads|logs|cache|tmp|_live-reference)(/|$)'
  forbid_current "source maps" '[.]map$'
}

log "Comparing live reference $(basename "$LIVE_REF_ZIP") to $(basename "$CURRENT_ZIP")"
if [[ "$MODE" == "placeholder" ]]; then check_placeholder_deploy; else check_full_deploy; fi

check_live_category "root Apache rules" '(^|/)[.]htaccess$' '^[.]htaccess$'
check_live_category "robots.txt" '(^|/)robots[.]txt$' '^robots[.]txt$'
check_live_category "sitemap.xml" '(^|/)sitemap[.]xml$' '^sitemap[.]xml$'
check_live_category "web manifest" '(^|/)(manifest|site[.]webmanifest|asset-manifest)[.]json$' '(^|/)(manifest|site[.]webmanifest|asset-manifest)[.]json$'
check_live_category "favicons and touch icons" '(^|/)(favicon|apple-touch-icon|android-chrome|mstile|browserconfig)' '(^|/)(favicon|apple-touch-icon|android-chrome|mstile|browserconfig)'
check_live_category "Open Graph/share image" '(^|/)(og-image|share-logo|og/)' '(^|/)(og-image|share-logo|og/)'
check_live_category "brand/logo assets" '(^|/).*(logo|brand|bow|wow|dog|spa).*' '(^|/).*(logo|brand|bow|wow|dog|spa).*'
check_live_category "legal pages" '(^|/)(privacy|terms)([.]html|/index[.]html)$' '(^|/)(privacy|terms)([.]html|/index[.]html)$'
check_live_category "fonts" '^fonts/' '^fonts/'
check_live_category "splash/PWA images" '^splash/' '^splash/'
check_live_category "branded error pages" '(^|/)(403|404|500|503)[.]html$|(^|/)error-documents/(403|404|500|503)[.]html$' '(^|/)(403|404|500|503)[.]html$|(^|/)error-documents/(403|404|500|503)[.]html$'

log "Live-reference audit passed"
