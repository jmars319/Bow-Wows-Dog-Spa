#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ZIP="$ROOT_DIR/backend-deploy.zip"
FRONTEND_ZIP="$ROOT_DIR/frontend-deploy.zip"
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

if [[ ! -f "$BACKEND_ZIP" ]] || [[ ! -f "$FRONTEND_ZIP" ]]; then
  fail "Missing deploy zips. Run scripts/make-deploy-zips.sh first."
fi

log_info "Frontend zip summary: $FRONTEND_ZIP"
ls -lh "$FRONTEND_ZIP"
FRONTEND_LIST="$(unzip -l "$FRONTEND_ZIP")"
FRONTEND_FILES="$(unzip -Z1 "$FRONTEND_ZIP")"
echo "$FRONTEND_LIST" | head -n 40

log_info "Backend zip summary: $BACKEND_ZIP"
ls -lh "$BACKEND_ZIP"
BACKEND_LIST="$(unzip -l "$BACKEND_ZIP")"
BACKEND_FILES="$(unzip -Z1 "$BACKEND_ZIP")"
echo "$BACKEND_LIST" | head -n 40

if echo "$BACKEND_FILES" | grep -Eq '^backend/config/config(\.example)?\.php$'; then
  fail "backend zip should not include config/config.php or config/config.example.php"
fi

if echo "$BACKEND_FILES" | grep -Eq '(^|/)\\.env($|[./])'; then
  fail "backend zip should not include .env files or examples"
fi

if echo "$BACKEND_FILES" | grep -Fx 'backend/public/seed_admin.php'; then
  fail "backend zip must not include backend/public/seed_admin.php"
fi

if echo "$BACKEND_FILES" | grep -Eq '(^|/)[.]gitignore$|(^|/)[.]git/|(^|/)[.]DS_Store$|[.]map$'; then
  fail "backend zip contains git metadata, macOS metadata, or source maps"
fi

if echo "$BACKEND_FILES" | grep -Eq 'backend/(logs|cache|tmp)(/|$)'; then
  fail "backend zip should not include logs/cache/tmp runtime directories"
fi

if echo "$BACKEND_FILES" | grep -Eq 'backend/(tests)(/|$)'; then
  fail "backend zip should not include tests"
fi

if is_true "$INCLUDE_CLI_TOOLS_IN_DEPLOY"; then
  if ! echo "$BACKEND_FILES" | grep -Fx 'backend/scripts/seed_admin.php'; then
    fail "backend zip should include backend/scripts/seed_admin.php when INCLUDE_CLI_TOOLS_IN_DEPLOY=true"
  fi

  if ! echo "$BACKEND_FILES" | grep -Fx 'backend/scripts/run_migrations.php'; then
    fail "backend zip should include backend/scripts/run_migrations.php when INCLUDE_CLI_TOOLS_IN_DEPLOY=true"
  fi
else
  if echo "$BACKEND_FILES" | grep -Eq '^backend/scripts/'; then
    fail "backend zip should not include backend/scripts/ by default"
  fi

  if echo "$BACKEND_FILES" | grep -Eq '^backend/migrations/|^backend/db/.*\\.sql$'; then
    fail "backend zip should not include migrations or schema SQL by default"
  fi
fi

if ! echo "$BACKEND_FILES" | grep -Fx 'backend/uploads/.htaccess'; then
  fail "backend zip should include backend/uploads/.htaccess guard"
fi

UPLOAD_ENTRIES="$(echo "$BACKEND_FILES" | grep -E '^backend/uploads/' || true)"
if echo "$UPLOAD_ENTRIES" | grep -Ev '^backend/uploads/?$|^backend/uploads/[.]htaccess$' >/dev/null; then
  fail "backend zip should not include uploaded media; only backend/uploads/.htaccess is allowed"
fi

if echo "$FRONTEND_FILES" | grep -Eq '^placeholder(/|$)'; then
  fail "frontend zip should not include placeholder/"
fi

if echo "$FRONTEND_FILES" | grep -Eq '^current(/|$)'; then
  fail "frontend zip should not include current/"
fi

if echo "$FRONTEND_FILES" | grep -Eiq '(^|/)gate\.php$'; then
  fail "frontend zip should not include gate.php"
fi

if echo "$FRONTEND_FILES" | grep -Eq '(^|/)[.]env($|[./])|(^|/)[.]gitignore$|(^|/)[.]git/|(^|/)[.]DS_Store$|[.]map$'; then
  fail "frontend zip contains secrets, git metadata, macOS metadata, or source maps"
fi

FRONTEND_CONTENT="$(unzip -p "$FRONTEND_ZIP" 2>/dev/null || true)"
if grep -E -q 'https?://(localhost|127\.0\.0\.1):[0-9]+' <<< "$FRONTEND_CONTENT"; then
  fail "frontend zip contains a localhost URL with a port"
fi

for required_frontend_file in \
  ".htaccess" \
  "index.php" \
  "error-documents/403.html" \
  "error-documents/404.html" \
  "error-documents/500.html" \
  "error-documents/503.html" \
  "error-documents/styles.css" \
  "error-documents/app.js"
do
  if ! echo "$FRONTEND_FILES" | grep -Fx "$required_frontend_file"; then
    fail "frontend zip must include $required_frontend_file"
  fi
done

log_success "Deploy archives look good."
