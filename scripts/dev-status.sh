#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

printf '%-10s %-8s %-8s %s\n' "service" "pid" "state" "port"
service_status "backend" "$BACKEND_PORT"
service_status "frontend" "$FRONTEND_PORT"
service_status "admin" "$ADMIN_PORT"
