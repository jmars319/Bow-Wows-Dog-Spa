#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_ZIP="$ROOT_DIR/site-deploy.zip"
INCLUDE_CLI_TOOLS_IN_DEPLOY="${INCLUDE_CLI_TOOLS_IN_DEPLOY:-false}"

COLOR_RESET="\033[0m"
COLOR_BLUE="\033[0;34m"
COLOR_GREEN="\033[0;32m"
COLOR_YELLOW="\033[0;33m"
COLOR_RED="\033[0;31m"

log_info() { printf "%b[INFO]%b %s\n" "$COLOR_BLUE" "$COLOR_RESET" "$*"; }
log_success() { printf "%b[OK]%b %s\n" "$COLOR_GREEN" "$COLOR_RESET" "$*"; }
log_warn() { printf "%b[WARN]%b %s\n" "$COLOR_YELLOW" "$COLOR_RESET" "$*" >&2; }
log_error() { printf "%b[ERROR]%b %s\n" "$COLOR_RED" "$COLOR_RESET" "$*" >&2; }
fail() {
  log_error "$*"
  exit 1
}

is_true() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

if [[ ! -f "$SITE_ZIP" ]]; then
  fail "Missing site-deploy.zip. Run scripts/make-deploy-zips.sh first."
fi

log_info "Site zip summary: $SITE_ZIP"
ls -lh "$SITE_ZIP"
SITE_FILES="$(unzip -Z1 "$SITE_ZIP")"
unzip -l "$SITE_ZIP" | head -n 50

zip_has() {
  local entry="$1"
  echo "$SITE_FILES" | grep -Fx "$entry" >/dev/null
}

zip_match() {
  local pattern="$1"
  echo "$SITE_FILES" | grep -Eq "$pattern"
}

for required_file in \
  ".htaccess" \
  "index.php" \
  "index.html" \
  "admin/index.html" \
  "api/index.php" \
  "api/.env" \
  "api/.htaccess" \
  "api/bootstrap/app.php" \
  "api/bootstrap/autoload.php" \
  "api/src/Application.php" \
  "api/uploads/.htaccess" \
  "error-documents/403.html" \
  "error-documents/404.html" \
  "error-documents/500.html" \
  "error-documents/503.html" \
  "error-documents/styles.css" \
  "error-documents/app.js"
do
  if ! zip_has "$required_file"; then
    fail "site-deploy.zip must include $required_file"
  fi
done

ENV_ENTRIES="$(echo "$SITE_FILES" | grep -E '(^|/)[.]env($|[./])' || true)"
if echo "$ENV_ENTRIES" | grep -Ev '^api/[.]env$' >/dev/null; then
  fail "site zip should not include unexpected .env files or examples"
fi

if zip_match '(^|/)[.]gitignore$|(^|/)[.]git/|(^|/)[.]DS_Store$|[.]map$'; then
  fail "site zip contains git metadata, macOS metadata, or source maps"
fi

if zip_match '^(backend|frontend)(/|$)|^src/|^node_modules/'; then
  fail "site zip contains source-layout directories outside api/"
fi

if zip_match '^api/config/config(\.example)?\.php$'; then
  fail "site zip should not include config/config.php or config/config.example.php"
fi

if zip_match '^api/public/'; then
  fail "site zip should not include api/public indirection"
fi

if zip_match '^api/(logs|cache|tmp|sessions)(/|$)'; then
  fail "site zip should not include logs/cache/tmp/session runtime directories"
fi

if zip_match '^api/(tests)(/|$)'; then
  fail "site zip should not include tests"
fi

if is_true "$INCLUDE_CLI_TOOLS_IN_DEPLOY"; then
  if ! zip_has "api/scripts/seed_admin.php"; then
    fail "site zip should include api/scripts/seed_admin.php when INCLUDE_CLI_TOOLS_IN_DEPLOY=true"
  fi

  if ! zip_has "api/scripts/run_migrations.php"; then
    fail "site zip should include api/scripts/run_migrations.php when INCLUDE_CLI_TOOLS_IN_DEPLOY=true"
  fi
else
  if zip_match '^api/scripts/'; then
    fail "site zip should not include api/scripts/ by default"
  fi

  if zip_match '^api/migrations/|^api/db/.*[.]sql$'; then
    fail "site zip should not include migrations or schema SQL by default"
  fi
fi

UPLOAD_ENTRIES="$(echo "$SITE_FILES" | grep -E '^api/uploads/' || true)"
if echo "$UPLOAD_ENTRIES" | grep -Ev '^api/uploads/?$|^api/uploads/[.]htaccess$' >/dev/null; then
  fail "site zip should not include uploaded media; only api/uploads/.htaccess is allowed"
fi

if zip_match '^api/storage/'; then
  fail "site zip should not include runtime storage directories"
fi

if zip_match '^placeholder(/|$)|^current(/|$)|(^|/)gate[.]php$'; then
  fail "site zip should not include placeholder/current launch artifacts"
fi

SITE_CONTENT="$(unzip -p "$SITE_ZIP" 2>/dev/null || true)"
if grep -E -q 'https?://(localhost|127\.0\.0\.1):[0-9]+' <<< "$SITE_CONTENT"; then
  fail "site zip contains a localhost URL with a port"
fi

root_htaccess="$(unzip -p "$SITE_ZIP" .htaccess 2>/dev/null || true)"
if ! grep -Eq 'api/index[.]php|api/[$]1' <<< "$root_htaccess"; then
  fail "root .htaccess must route /api to api/"
fi
if grep -Eq 'backend/public|api/public' <<< "$root_htaccess"; then
  fail "root .htaccess still references old backend/public routing"
fi

api_htaccess="$(unzip -p "$SITE_ZIP" api/.htaccess 2>/dev/null || true)"
if ! grep -Eq 'bootstrap|config|db|migrations|scripts|src|tests' <<< "$api_htaccess"; then
  fail "api/.htaccess is missing internal path blocking"
fi

node "$ROOT_DIR/scripts/verify-permanent-assets.mjs" --site-zip "$SITE_ZIP"

log_success "site-deploy.zip looks good."
