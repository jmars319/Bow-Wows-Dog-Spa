#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck source=dev-test-ports.sh
source "$ROOT_DIR/scripts/dev-test-ports.sh"
# shellcheck source=dev-common.sh
source "$ROOT_DIR/scripts/dev-common.sh"

cleanup() {
  local exit_code=$?
  set +e
  "$ROOT_DIR/scripts/dev-stop.sh" >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap cleanup EXIT

"$ROOT_DIR/scripts/dev-stop.sh" >/dev/null 2>&1 || true
export DEV_BROWSER_OPEN=0
"$ROOT_DIR/scripts/dev-start.sh"
wait_for_url "http://$(browser_host):${FRONTEND_PORT}" 45
wait_for_url "http://$(browser_host):${ADMIN_PORT}/admin/login" 45

if [[ "$#" -gt 0 ]]; then
  "$@"
fi
