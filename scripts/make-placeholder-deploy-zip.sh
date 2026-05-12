#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build/placeholder-deploy"
STAGING="$BUILD_DIR/public"

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

log "Cleaning previous placeholder deploy artifact"
rm -f "$ROOT_DIR/deploy-placeholder.zip"
rm -rf "$BUILD_DIR"
mkdir -p "$STAGING/assets"

log "Refreshing placeholder brand assets"
php "$ROOT_DIR/scripts/generate-logo-webp.php" --sync-placeholder || log_warn "Skipping logo WebP regeneration (GD extension required)"

log "Copying placeholder surface"
rsync -a --exclude '.gitignore' --exclude '.DS_Store' "$ROOT_DIR/placeholder/assets/" "$STAGING/assets/"
cp "$ROOT_DIR/placeholder/index.php" "$STAGING/index.php"
cp "$ROOT_DIR/placeholder/root.htaccess" "$STAGING/.htaccess"
cp "$ROOT_DIR/placeholder/robots.txt" "$STAGING/robots.txt"
cp "$ROOT_DIR/privacy.html" "$STAGING/privacy.html"
cp "$ROOT_DIR/terms.html" "$STAGING/terms.html"

if [ -d "$ROOT_DIR/public-root" ]; then
  rsync -a --exclude '.gitignore' --exclude '.DS_Store' "$ROOT_DIR/public-root/" "$STAGING/"
fi

log "Creating deploy-placeholder.zip"
pushd "$STAGING" >/dev/null
zip -rq "$ROOT_DIR/deploy-placeholder.zip" .
popd >/dev/null

if grep -E -q 'https?://(localhost|127\.0\.0\.1):[0-9]+' < <(unzip -p "$ROOT_DIR/deploy-placeholder.zip" 2>/dev/null || true); then
  log_error "deploy-placeholder.zip contains a localhost URL with a port. Fix the artifact before deploying."
  exit 1
fi

PLACEHOLDER_FILES="$(unzip -Z1 "$ROOT_DIR/deploy-placeholder.zip")"
if grep -E -q '(^|/)\.env($|[./])|(^|/)\.gitignore$|(^|/)\.git/|(^|/)\.DS_Store$|\.map$' <<< "$PLACEHOLDER_FILES"; then
  log_error "deploy-placeholder.zip contains secrets, git metadata, macOS metadata, or source maps."
  exit 1
fi

if grep -E -q '(^|/)(backend|src|node_modules|uploads|logs|cache|tmp)(/|$)' <<< "$PLACEHOLDER_FILES"; then
  log_error "deploy-placeholder.zip contains non-placeholder runtime/source directories."
  exit 1
fi

log_success "Created deploy-placeholder.zip"
