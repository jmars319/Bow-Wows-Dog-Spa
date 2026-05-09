#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build/deploy"
FRONT_STAGING="$BUILD_DIR/frontend"
BACKEND_STAGING="$BUILD_DIR/backend"
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
log() { log_info "$*"; }

is_true() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

log "Cleaning previous artifacts"
rm -f "$ROOT_DIR"/frontend-deploy*.zip "$ROOT_DIR"/backend-deploy*.zip "$ROOT_DIR"/deploy-*.zip
rm -rf "$BUILD_DIR"
mkdir -p "$FRONT_STAGING" "$BACKEND_STAGING"

log "Refreshing brand assets"
php "$ROOT_DIR/scripts/generate-logo-webp.php" || log_warn "Skipping logo WebP regeneration (GD extension required)"

log "Building public SPA"
pushd "$ROOT_DIR/frontend/public-app" >/dev/null
npm run build
popd >/dev/null

log "Building admin SPA"
pushd "$ROOT_DIR/frontend/admin-app" >/dev/null
npm run build
popd >/dev/null

log "Preparing frontend bundle"
rsync -a "$ROOT_DIR/frontend/public-app/dist/" "$FRONT_STAGING/"
rsync -a "$ROOT_DIR/frontend/admin-app/dist/" "$FRONT_STAGING/admin/"
cp "$ROOT_DIR/index.php" "$FRONT_STAGING/index.php"
cp "$ROOT_DIR/.htaccess" "$FRONT_STAGING/.htaccess"
if [ -d "$ROOT_DIR/public-root" ]; then
  rsync -a --exclude '.gitignore' --exclude '.DS_Store' "$ROOT_DIR/public-root/" "$FRONT_STAGING/"
fi

log "Preparing backend bundle"
BACKEND_EXCLUDES=(
  --exclude 'config/config.php'
  --exclude '.env'
  --exclude '.env.production'
  --exclude 'uploads/'
  --exclude 'storage/media/'
  --exclude 'public/seed_admin.php'
  --exclude '.DS_Store'
  --exclude '.gitignore'
)

if is_true "$INCLUDE_CLI_TOOLS_IN_DEPLOY"; then
  log_warn "Including backend CLI tools in backend-deploy.zip by explicit request"
else
  log "Excluding backend CLI tools from backend-deploy.zip (default)"
  BACKEND_EXCLUDES+=(--exclude 'scripts/')
fi

rsync -a \
  "${BACKEND_EXCLUDES[@]}" \
  "$ROOT_DIR/backend/" "$BACKEND_STAGING/backend/"

log "Creating frontend-deploy.zip"
pushd "$FRONT_STAGING" >/dev/null
zip -rq "$ROOT_DIR/frontend-deploy.zip" .
popd >/dev/null

log "Creating backend-deploy.zip"
pushd "$BACKEND_STAGING" >/dev/null
zip -rq "$ROOT_DIR/backend-deploy.zip" backend
popd >/dev/null

bash "$ROOT_DIR/scripts/check-deploy-zips.sh"
log_success "Created frontend-deploy.zip and backend-deploy.zip"
