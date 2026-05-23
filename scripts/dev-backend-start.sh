#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

ensure_not_running "backend"
log_status "backend" "info" "Starting PHP server on ${DEV_HOST}:${BACKEND_PORT}"

start_detached_service "backend" "$BACKEND_DIR" \
  php -S "${DEV_HOST}:${BACKEND_PORT}" -t "$BACKEND_PUBLIC_DIR" "$BACKEND_PUBLIC_DIR/index.php"
PID="$(read_pid backend)"

if wait_for_url "http://${DEV_HOST}:${BACKEND_PORT}/api/public/site" 30; then
  log_status "backend" "success" "Ready (PID $PID)"
else
  log_status "backend" "error" "Health check failed"
  stop_service "backend"
  exit 1
fi
