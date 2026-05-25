#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"
BACKUP_FILE=""

if [[ ! -f "$ENV_FILE" ]]; then
  >&2 echo "[test:unit][error] backend/.env is required."
  exit 1
fi

for required in npm php composer; do
  if ! command -v "$required" >/dev/null 2>&1; then
    >&2 echo "[test:unit][error] Command '$required' is required."
    exit 1
  fi
done

composer install --working-dir="$ROOT_DIR/backend" --no-dev --prefer-dist --no-interaction

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

backup_configured_db() {
  BOWWOW_TEST_REUSE_CONFIGURED_DB=1 \
  DB_TEST_NAME="$DB_NAME" \
  php -r 'require "backend/tests/bootstrap.php"; $env = \BowWowSpa\Tests\TestEnvironment::boot(); echo $env->backupConfiguredDatabase(), PHP_EOL;'
}

restore_configured_db() {
  local backup_path="$1"
  BOWWOW_TEST_REUSE_CONFIGURED_DB=1 \
  DB_TEST_NAME="$DB_NAME" \
  php -r 'require "backend/tests/bootstrap.php"; $env = \BowWowSpa\Tests\TestEnvironment::boot(); $env->restoreConfiguredDatabase($argv[1]);' "$backup_path"
}

cleanup() {
  set +e
  bash "$ROOT_DIR/scripts/dev-stop.sh" >/dev/null 2>&1 || true
  if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
    echo "[test:unit] Restoring $DB_NAME from backup..."
    restore_configured_db "$BACKUP_FILE"
    rm -f "$BACKUP_FILE"
  fi
}
trap cleanup EXIT

mkdir -p "$ROOT_DIR/.dev"
echo "[test:unit] Backing up $DB_NAME..."
BACKUP_FILE="$(backup_configured_db)"

echo "[test:unit] Running backend integration tests..."
BOWWOW_TEST_REUSE_CONFIGURED_DB=1 \
BOWWOW_TEST_SKIP_BACKUP_RESTORE=1 \
DB_TEST_NAME="$DB_NAME" \
php "$ROOT_DIR/backend/tests/run.php"

echo "[test:unit] Running public frontend tests..."
npm run test:public

echo "[test:unit] Running admin frontend tests..."
npm run test:admin

echo "[test:unit] Unit/integration checks passed"
