#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

ensure_not_running "frontend"
log_status "frontend" "info" "Starting public SPA on ${DEV_HOST}:${FRONTEND_PORT}"

start_detached_service "frontend" "$FRONTEND_PUBLIC_DIR" \
  env VITE_ADMIN_PROXY_TARGET="http://${DEV_HOST}:${ADMIN_PORT}" \
  npm run dev -- --host "$DEV_HOST" --port "$FRONTEND_PORT" --strictPort
PID="$(read_pid frontend)"

if wait_for_url "http://${DEV_HOST}:${FRONTEND_PORT}" 45; then
  log_status "frontend" "success" "Ready (PID $PID)"
else
  log_status "frontend" "error" "Failed to start"
  stop_service "frontend"
  exit 1
fi
