#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"
BACKUP_FILE=""

if [[ ! -f "$ENV_FILE" ]]; then
  >&2 echo "[test-all][error] backend/.env is required."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for required in npm php; do
  if ! command -v "$required" >/dev/null 2>&1; then
    >&2 echo "[test-all][error] Command '$required' is required."
    exit 1
  fi
done

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
    echo "[test-all] Restoring $DB_NAME from backup..."
    restore_configured_db "$BACKUP_FILE"
    rm -f "$BACKUP_FILE"
  fi
}

trap cleanup EXIT

mkdir -p "$ROOT_DIR/.dev"
echo "[test-all] Backing up $DB_NAME..."
BACKUP_FILE="$(backup_configured_db)"

echo "[test-all] Running backend integration tests..."
BOWWOW_TEST_REUSE_CONFIGURED_DB=1 \
BOWWOW_TEST_SKIP_BACKUP_RESTORE=1 \
DB_TEST_NAME="$DB_NAME" \
php "$ROOT_DIR/backend/tests/run.php"

echo "[test-all] Running public frontend tests..."
(cd "$ROOT_DIR/frontend/public-app" && npm test && npm run build)

echo "[test-all] Running admin frontend tests..."
(cd "$ROOT_DIR/frontend/admin-app" && npm test && npm run build)

echo "[test-all] Running browser E2E suite..."
(cd "$ROOT_DIR" && npm run test:e2e)

echo "[test-all] All checks passed."
