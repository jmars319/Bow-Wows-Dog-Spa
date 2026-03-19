#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build/deploy"
FRONT_STAGING="$BUILD_DIR/frontend"
BACKEND_STAGING="$BUILD_DIR/backend"
INCLUDE_CLI_TOOLS_IN_DEPLOY="${INCLUDE_CLI_TOOLS_IN_DEPLOY:-false}"

log() { printf '[deploy] %s\n' "$*"; }

is_true() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

log "Cleaning previous artifacts"
rm -f "$ROOT_DIR"/deploy-*.zip
rm -rf "$BUILD_DIR"
mkdir -p "$FRONT_STAGING" "$BACKEND_STAGING"

log "Refreshing brand assets"
php "$ROOT_DIR/scripts/generate-logo-webp.php" || log "Skipping logo WebP regeneration (GD extension required)"

log "Building public SPA"
pushd "$ROOT_DIR/frontend/public-app" >/dev/null
npm run build
popd >/dev/null

log "Building admin SPA"
pushd "$ROOT_DIR/frontend/admin-app" >/dev/null
npm run build
popd >/dev/null

log "Preparing frontend bundle"
rsync -a --exclude '.gitignore' --exclude '.DS_Store' "$ROOT_DIR/placeholder/" "$FRONT_STAGING/placeholder/"
rsync -a "$ROOT_DIR/frontend/public-app/dist/" "$FRONT_STAGING/"
rsync -a "$ROOT_DIR/frontend/admin-app/dist/" "$FRONT_STAGING/admin/"
cp "$ROOT_DIR/placeholder/index.php" "$FRONT_STAGING/placeholder/index.php"
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
  log "Including backend CLI tools in deploy-backend.zip by explicit request"
else
  log "Excluding backend CLI tools from deploy-backend.zip (default)"
  BACKEND_EXCLUDES+=(--exclude 'scripts/')
fi

rsync -a \
  "${BACKEND_EXCLUDES[@]}" \
  "$ROOT_DIR/backend/" "$BACKEND_STAGING/backend/"

log "Creating deploy-frontend.zip"
pushd "$FRONT_STAGING" >/dev/null
zip -rq "$ROOT_DIR/deploy-frontend.zip" .
popd >/dev/null

log "Creating deploy-backend.zip"
pushd "$BACKEND_STAGING" >/dev/null
zip -rq "$ROOT_DIR/deploy-backend.zip" backend
popd >/dev/null

bash "$ROOT_DIR/scripts/check-deploy-zips.sh"
