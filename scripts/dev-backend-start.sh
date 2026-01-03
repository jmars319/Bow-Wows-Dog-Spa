#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

ensure_not_running "backend"
log_status "backend" "info" "Starting PHP server on ${DEV_HOST}:${BACKEND_PORT}"

pushd "$BACKEND_DIR" >/dev/null
nohup php -S "${DEV_HOST}:${BACKEND_PORT}" -t "$BACKEND_PUBLIC_DIR" "$BACKEND_PUBLIC_DIR/index.php" > "$(log_file backend)" 2>&1 &
PID=$!
popd >/dev/null

write_pid "backend" "$PID"

if wait_for_url "http://${DEV_HOST}:${BACKEND_PORT}/api/public/site" 30; then
  log_status "backend" "success" "Ready (PID $PID)"
else
  log_status "backend" "error" "Health check failed"
  stop_service "backend"
  exit 1
fi
