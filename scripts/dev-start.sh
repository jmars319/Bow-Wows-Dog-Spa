#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"

"$ROOT_DIR/scripts/dev-backend-start.sh"
"$ROOT_DIR/scripts/dev-frontend-start.sh"
"$ROOT_DIR/scripts/dev-admin-start.sh"

PUBLIC_URL="http://$(browser_host):${FRONTEND_PORT}"
ALTERNATE_PUBLIC_URL=""

if [[ "$(browser_host)" == "127.0.0.1" ]]; then
  ALTERNATE_PUBLIC_URL="http://localhost:${FRONTEND_PORT}"
elif [[ "$(browser_host)" == "localhost" ]]; then
  ALTERNATE_PUBLIC_URL="http://127.0.0.1:${FRONTEND_PORT}"
fi

ensure_browser_tab "$PUBLIC_URL" "$ALTERNATE_PUBLIC_URL"
