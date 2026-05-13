#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_SOURCE="$ROOT_DIR/backend/.env"
ZIP_PATH="$ROOT_DIR/server-config-deploy.zip"
ARCHIVE_ENV_PATH="api/.env"

if [[ "${ALLOW_SECRET_CONFIG_ZIP:-}" != "true" && "${1:-}" != "--i-understand-this-contains-secrets" ]]; then
  printf 'ERROR: server-config-deploy.zip contains production secrets.\n' >&2
  printf 'Run with ALLOW_SECRET_CONFIG_ZIP=true only when restoring server config.\n' >&2
  exit 1
fi

if [[ ! -f "$ENV_SOURCE" ]]; then
  printf 'ERROR: missing %s\n' "$ENV_SOURCE" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bowwow-server-config.XXXXXX")"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TMP_DIR/$(dirname "$ARCHIVE_ENV_PATH")"
cp "$ENV_SOURCE" "$TMP_DIR/$ARCHIVE_ENV_PATH"
chmod 600 "$TMP_DIR/$ARCHIVE_ENV_PATH"

rm -f "$ZIP_PATH"
(
  cd "$TMP_DIR"
  zip -rq "$ZIP_PATH" "$ARCHIVE_ENV_PATH"
)
chmod 600 "$ZIP_PATH"

zip_entries="$(unzip -Z1 "$ZIP_PATH")"
if [[ "$zip_entries" != "$ARCHIVE_ENV_PATH" ]]; then
  printf 'ERROR: unexpected entries in server-config-deploy.zip\n' >&2
  exit 1
fi

printf 'Created %s containing only %s.\n' "$ZIP_PATH" "$ARCHIVE_ENV_PATH"
printf 'Upload only for setup/recovery, then delete the zip from your machine and hosting file manager.\n'
