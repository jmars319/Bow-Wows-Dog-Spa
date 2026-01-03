#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

function check_backend() {
  if curl -fsS "http://${DEV_HOST}:${BACKEND_PORT}/api/public/site" >/dev/null; then
    log_status "backend" "success" "Health OK"
  else
    log_status "backend" "error" "Health check failed"
    exit 1
  fi
}

function check_frontend() {
  if curl -fsS "http://${DEV_HOST}:${FRONTEND_PORT}" >/dev/null; then
    log_status "frontend" "success" "Health OK"
  else
    log_status "frontend" "error" "Health check failed"
    exit 1
  fi
}

function check_admin() {
  if curl -fsS "http://${DEV_HOST}:${ADMIN_PORT}/admin/login" >/dev/null; then
    log_status "admin" "success" "Health OK"
  else
    log_status "admin" "error" "Health check failed"
    exit 1
  fi
}

"$ROOT_DIR/scripts/dev-stop.sh" || true
"$ROOT_DIR/scripts/dev-start.sh"
check_backend
check_frontend
check_admin

"$ROOT_DIR/scripts/dev-restart.sh"
check_backend
check_frontend
check_admin

"$ROOT_DIR/scripts/dev-stop.sh"
log_status "dev" "success" "Environment verified."
