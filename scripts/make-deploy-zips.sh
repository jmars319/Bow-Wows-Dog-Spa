#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build/deploy"
SITE_STAGING="$BUILD_DIR/site"
API_STAGING="$SITE_STAGING/api"
INCLUDE_CLI_TOOLS_IN_DEPLOY="${INCLUDE_CLI_TOOLS_IN_DEPLOY:-false}"
SITE_ZIP="$ROOT_DIR/site-deploy.zip"
PROD_ENV_FILE="$ROOT_DIR/backend/.env.production"

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

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Missing required command: $1"
    exit 1
  fi
}

require_cmd php
require_cmd rsync
require_cmd zip

if [ ! -f "$PROD_ENV_FILE" ]; then
  log_error "backend/.env.production is required so site-deploy.zip can include api/.env"
  exit 1
fi
if grep -Eiq '^[A-Za-z_][A-Za-z0-9_]*=.*(REPLACE_WITH|CHANGE_ME|<your_|your_|cpanel_|YOUR_|TODO|TBD)' "$PROD_ENV_FILE"; then
  log_error "backend/.env.production contains placeholder values; update it before building site-deploy.zip"
  exit 1
fi

log "Cleaning previous artifacts"
rm -f "$ROOT_DIR"/frontend-deploy*.zip "$ROOT_DIR"/backend-deploy*.zip "$SITE_ZIP"
rm -rf "$BUILD_DIR"
mkdir -p "$API_STAGING"

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

log "Preparing web root"
rsync -a --delete --exclude '.DS_Store' --exclude '*.map' "$ROOT_DIR/frontend/public-app/dist/" "$SITE_STAGING/"
rsync -a --delete --exclude '.DS_Store' --exclude '*.map' "$ROOT_DIR/frontend/admin-app/dist/" "$SITE_STAGING/admin/"
cp "$ROOT_DIR/index.php" "$SITE_STAGING/index.php"
cp "$ROOT_DIR/.htaccess" "$SITE_STAGING/.htaccess"
if [ -d "$ROOT_DIR/public-root" ]; then
  rsync -a --exclude '.gitignore' --exclude '.DS_Store' "$ROOT_DIR/public-root/" "$SITE_STAGING/"
fi
find "$SITE_STAGING" -type f -name '*.map' -delete

log "Preparing backend under api/"
BACKEND_EXCLUDES=(
  --exclude 'public/'
  --exclude 'config/config.php'
  --exclude 'config/config.example.php'
  --exclude '.env*'
  --exclude 'uploads/'
  --exclude 'storage/'
  --exclude 'tests/'
  --exclude 'logs/'
  --exclude 'cache/'
  --exclude 'tmp/'
  --exclude 'sessions/'
  --exclude '.git/'
  --exclude '.DS_Store'
  --exclude '.gitignore'
  --exclude '*.map'
)

if is_true "$INCLUDE_CLI_TOOLS_IN_DEPLOY"; then
  log_warn "Including backend CLI/schema tools in site-deploy.zip by explicit request"
else
  log "Excluding backend CLI/schema tools from site-deploy.zip (default)"
  BACKEND_EXCLUDES+=(--exclude 'scripts/')
  BACKEND_EXCLUDES+=(--exclude 'migrations/')
  BACKEND_EXCLUDES+=(--exclude 'db/*.sql')
fi

rsync -a \
  "${BACKEND_EXCLUDES[@]}" \
  "$ROOT_DIR/backend/" "$API_STAGING/"

cp "$PROD_ENV_FILE" "$API_STAGING/.env"
cp "$ROOT_DIR/backend/public/index.php" "$API_STAGING/index.php"
cp "$ROOT_DIR/backend/public/.htaccess" "$API_STAGING/.htaccess"

if [ -f "$ROOT_DIR/backend/uploads/.htaccess" ]; then
  mkdir -p "$API_STAGING/uploads"
  cp "$ROOT_DIR/backend/uploads/.htaccess" "$API_STAGING/uploads/.htaccess"
fi

log "Creating site-deploy.zip"
pushd "$SITE_STAGING" >/dev/null
zip -rq "$SITE_ZIP" .
popd >/dev/null

bash "$ROOT_DIR/scripts/check-deploy-zips.sh"
log_success "Created site-deploy.zip"
