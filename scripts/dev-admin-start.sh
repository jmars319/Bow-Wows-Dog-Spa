#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

ensure_not_running "admin"
log_status "admin" "info" "Starting admin SPA on ${DEV_HOST}:${ADMIN_PORT}"

if command -v screen >/dev/null 2>&1; then
  SESSION_NAME="bowwow-admin-dev"
  ADMIN_LOG_FILE="$(log_file admin)"
  export FRONTEND_ADMIN_DIR DEV_HOST ADMIN_PORT ADMIN_LOG_FILE
  screen -S "$SESSION_NAME" -X quit >/dev/null 2>&1 || true
  screen -dmS "$SESSION_NAME" bash -lc 'cd "$FRONTEND_ADMIN_DIR" && exec ./node_modules/.bin/vite --host "$DEV_HOST" --port "$ADMIN_PORT" --strictPort > "$ADMIN_LOG_FILE" 2>&1'
  PID="$(screen -ls | awk -v name=".${SESSION_NAME}" '$1 ~ name { split($1, parts, "."); print parts[1]; exit }' || true)"
  if [[ -z "$PID" ]]; then
    PID="$(lsof -tiTCP:"$ADMIN_PORT" -sTCP:LISTEN | head -n 1 || true)"
  fi
else
  pushd "$FRONTEND_ADMIN_DIR" >/dev/null
  trap '' HUP
  ./node_modules/.bin/vite --host "$DEV_HOST" --port "$ADMIN_PORT" --strictPort > "$(log_file admin)" 2>&1 &
  PID=$!
  popd >/dev/null
fi

write_pid "admin" "$PID"

if wait_for_url "http://${DEV_HOST}:${ADMIN_PORT}/admin/login" 45; then
  log_status "admin" "success" "Ready (PID $PID)"
else
  log_status "admin" "error" "Failed to start"
  stop_service "admin"
  exit 1
fi
