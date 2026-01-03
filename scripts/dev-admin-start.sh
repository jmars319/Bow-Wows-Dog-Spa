#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

ensure_not_running "admin"
log_status "admin" "info" "Starting admin SPA on ${DEV_HOST}:${ADMIN_PORT}"

pushd "$FRONTEND_ADMIN_DIR" >/dev/null
nohup npm run dev -- --host "$DEV_HOST" --port "$ADMIN_PORT" > "$(log_file admin)" 2>&1 &
PID=$!
popd >/dev/null

write_pid "admin" "$PID"

if wait_for_url "http://${DEV_HOST}:${ADMIN_PORT}/admin/login" 45; then
  log_status "admin" "success" "Ready (PID $PID)"
else
  log_status "admin" "error" "Failed to start"
  stop_service "admin"
  exit 1
fi
