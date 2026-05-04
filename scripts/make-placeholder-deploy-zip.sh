#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build/placeholder-deploy"
STAGING="$BUILD_DIR/public"

log() { printf '[placeholder-deploy] %s\n' "$*"; }

log "Cleaning previous placeholder deploy artifact"
rm -f "$ROOT_DIR/deploy-placeholder.zip"
rm -rf "$BUILD_DIR"
mkdir -p "$STAGING/placeholder"

log "Copying placeholder surface"
rsync -a --exclude '.gitignore' --exclude '.DS_Store' "$ROOT_DIR/placeholder/assets/" "$STAGING/placeholder/assets/"
cp "$ROOT_DIR/placeholder/index.php" "$STAGING/index.php"
cp "$ROOT_DIR/placeholder/index.php" "$STAGING/placeholder/index.php"
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

log "Created deploy-placeholder.zip"
